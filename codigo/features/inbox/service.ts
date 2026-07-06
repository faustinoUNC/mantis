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

  // Reclamar el reporte PRIMERO (condicionado a 'pendiente'): si dos personas
  // aprietan "Crear gestión" a la vez, solo una gana — nada de gestiones dobles.
  const supabase = await createClient();
  const { data: reclamado } = await supabase
    .from("inbox_reportes")
    .update({ estado: "gestionado", procesado_por: actual.id })
    .eq("id", reporteId)
    .eq("estado", "pendiente")
    .select("id");
  if (!reclamado?.length) {
    revalidatePath("/inbox");
    return { ok: false, error: "El reporte ya fue procesado por otra persona." };
  }

  const r = await crearGestion(datos);
  if (!r.ok || !r.data) {
    // Devolver el reporte al inbox para que no quede colgado
    await supabase
      .from("inbox_reportes")
      .update({ estado: "pendiente", procesado_por: null })
      .eq("id", reporteId);
    return r.ok ? { ok: false, error: "No se pudo crear la gestión." } : r;
  }

  // Vincular con el id REAL de la gestión creada (sin adivinar por fecha)
  await supabase
    .from("inbox_reportes")
    .update({ gestion_id: r.data.gestionId })
    .eq("id", reporteId);

  revalidatePath("/inbox");
  return { ok: true, data: { gestionId: r.data.gestionId } };
}
