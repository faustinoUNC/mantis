"use server";

import { emailRecuperarContrasena } from "@/features/email/service";
import { createClient } from "@/shared/lib/supabase/server";
import { linkCrearContrasena } from "./recovery";
import type { UsuarioActual } from "./types";

// Usuario autenticado + su fila de `usuarios`. Null si no hay sesión,
// no tiene fila o está inactivo (RLS solo le deja ver su propia fila).
export async function obtenerUsuarioActual(): Promise<UsuarioActual | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol, esta_activo")
    .eq("id", user.id)
    .single();

  if (!data || !data.esta_activo) return null;
  return data as UsuarioActual;
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

// Freno simple en memoria (mismo criterio que enrolarTecnico): la acción es
// pública y dispara emails — sin esto es spameable.
const pedidosRecupero: number[] = [];
const RECUPERO_MAX = 10;
const RECUPERO_VENTANA_MS = 60 * 60 * 1000;

// PÚBLICA (sin sesión): "¿Olvidaste tu contraseña?" (STORY-955). Siempre
// responde éxito — no revela si el email existe (anti-enumeración). Sirve
// para cualquier usuario con cuenta: técnicos y empleados.
export async function recuperarContrasena(email: string): Promise<{ ok: true }> {
  const ahora = Date.now();
  while (pedidosRecupero.length && ahora - pedidosRecupero[0] > RECUPERO_VENTANA_MS) {
    pedidosRecupero.shift();
  }
  if (pedidosRecupero.length >= RECUPERO_MAX) return { ok: true };
  pedidosRecupero.push(ahora);

  const limpio = email.trim().toLowerCase();
  if (!limpio) return { ok: true };

  // Si el email no existe, generateLink falla y no se envía nada.
  const link = await linkCrearContrasena(limpio);
  if (link) {
    await emailRecuperarContrasena({ email: limpio }, link);
  }
  return { ok: true };
}
