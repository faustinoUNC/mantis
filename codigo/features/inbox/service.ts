"use server";

import { revalidatePath } from "next/cache";
import { obtenerUsuarioActual } from "@/features/auth/service";
import type { ActionResult } from "@/features/empleados/types";
import { crearGestion } from "@/features/gestiones/service";
import type { Causa, Urgencia } from "@/features/gestiones/types";
import { createClient } from "@/shared/lib/supabase/server";

export interface Reporte {
  id: string;
  canal: string;
  remitente: string | null;
  asunto: string | null;
  cuerpo: string | null;
  recibido_en: string | null;
  estado: "pendiente" | "gestionado" | "descartado";
  motivo_descarte: string | null;
  gestion_id: string | null;
}

async function exigirStaffMantenimiento() {
  const actual = await obtenerUsuarioActual();
  if (
    actual?.rol !== "administrador" &&
    actual?.rol !== "gestor_mantenimiento"
  ) {
    return null;
  }
  return actual;
}

// Sincronización desde la UI (rol verificado). El sondeo automático corre
// cada 1 minuto vía pg_cron → /api/cron/inbox (mismo núcleo, features/inbox/sync.ts).
export async function sincronizarInbox(): Promise<ActionResult<{ nuevos: number }>> {
  const actual = await exigirStaffMantenimiento();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const { ejecutarSincronizacion } = await import("./sync");
  const r = await ejecutarSincronizacion();
  revalidatePath("/inbox");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { nuevos: r.nuevos } };
}

export async function listarInbox(): Promise<Reporte[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inbox_reportes")
    .select(
      "id, canal, remitente, asunto, cuerpo, recibido_en, estado, motivo_descarte, gestion_id"
    )
    .eq("estado", "pendiente") // lo procesado vive en sus gestiones/auditoría
    .order("creado_en", { ascending: false })
    .limit(50);
  return (data ?? []) as Reporte[];
}

export async function descartarReporte(
  id: string,
  motivo: string
): Promise<ActionResult> {
  const actual = await exigirStaffMantenimiento();
  if (!actual) return { ok: false, error: "No tenés permiso." };
  if (!motivo.trim()) return { ok: false, error: "Indicá el motivo." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("inbox_reportes")
    .update({
      estado: "descartado",
      motivo_descarte: motivo.trim(),
      procesado_por: actual.id,
    })
    .eq("id", id)
    .eq("estado", "pendiente");
  if (error) return { ok: false, error: "No se pudo descartar." };

  revalidatePath("/inbox");
  return { ok: true };
}

// Crear gestión desde el reporte (manual — form prefilled) y vincular.
export async function crearDesdeReporte(
  reporteId: string,
  datos: {
    descripcion: string;
    propiedad_id: string;
    especialidad_id: string;
    urgencia: Urgencia;
    causa: Causa;
  }
): Promise<ActionResult<{ gestionId: string }>> {
  const actual = await exigirStaffMantenimiento();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const r = await crearGestion(datos);
  if (!r.ok) return r;

  // Vincular el reporte con la gestión recién creada (la más nueva del gestor)
  const supabase = await createClient();
  const { data: gestion } = await supabase
    .from("gestiones")
    .select("id")
    .eq("gestor_id", actual.id)
    .order("creado_en", { ascending: false })
    .limit(1)
    .single();

  await supabase
    .from("inbox_reportes")
    .update({
      estado: "gestionado",
      gestion_id: gestion?.id ?? null,
      procesado_por: actual.id,
    })
    .eq("id", reporteId);

  revalidatePath("/inbox");
  return { ok: true, data: { gestionId: gestion?.id ?? "" } };
}
