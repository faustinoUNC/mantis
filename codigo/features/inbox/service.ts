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

// ── Botón IA (PRD §4): Claude clasifica y crea la card ──

export async function crearGestionConIA(
  reporteId: string
): Promise<ActionResult<{ gestionId: string }>> {
  const actual = await exigirStaffMantenimiento();
  if (!actual) return { ok: false, error: "No tenés permiso." };

  const supabase = await createClient();
  const [{ data: reporte }, { data: especialidades }, { data: propiedades }] =
    await Promise.all([
      supabase
        .from("inbox_reportes")
        .select("id, remitente, asunto, cuerpo, estado")
        .eq("id", reporteId)
        .single(),
      supabase
        .from("especialidades")
        .select("id, nombre")
        .eq("activa", true),
      supabase
        .from("propiedades")
        .select("id, direccion")
        .eq("activa", true),
    ]);
  if (!reporte || reporte.estado !== "pendiente") {
    return { ok: false, error: "El reporte ya fue procesado." };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      tools: [
        {
          name: "crear_gestion",
          description:
            "Crea una gestión de mantenimiento a partir del reporte del inquilino.",
          input_schema: {
            type: "object",
            properties: {
              descripcion: {
                type: "string",
                description:
                  "Síntesis clara del problema en 1-2 oraciones, en español rioplatense.",
              },
              especialidad_id: {
                type: "string",
                enum: (especialidades ?? []).map((e) => e.id),
                description: `Especialidad. Opciones: ${(especialidades ?? [])
                  .map((e) => `${e.id} = ${e.nombre}`)
                  .join("; ")}`,
              },
              urgencia: {
                type: "string",
                enum: ["normal", "urgente"],
                description:
                  "urgente SOLO si hay riesgo (gas, electricidad expuesta, inundación, seguridad).",
              },
              causa: {
                type: "string",
                enum: ["desgaste", "dano", "mejora"],
                description:
                  "desgaste = rotura por uso normal/antigüedad; dano = rotura culpable del inquilino; mejora = pedido de algo nuevo.",
              },
              propiedad_id: {
                type: ["string", "null"],
                description: `ID de la propiedad SI el texto menciona una dirección que matchee claramente. Opciones: ${(propiedades ?? [])
                  .map((p) => `${p.id} = ${p.direccion}`)
                  .join("; ")}. Si no hay match claro, null.`,
              },
            },
            required: ["descripcion", "especialidad_id", "urgencia", "causa", "propiedad_id"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "crear_gestion" },
      messages: [
        {
          role: "user",
          content: `Reporte de mantenimiento recibido por email:\n\nDe: ${reporte.remitente ?? "desconocido"}\nAsunto: ${reporte.asunto ?? "(sin asunto)"}\n\n${reporte.cuerpo ?? ""}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    return { ok: false, error: "La IA no respondió — probá de nuevo o creala manual." };
  }

  const data = (await res.json()) as {
    content: { type: string; input?: Record<string, unknown> }[];
  };
  const tool = data.content.find((c) => c.type === "tool_use");
  const input = tool?.input as
    | {
        descripcion: string;
        especialidad_id: string;
        urgencia: Urgencia;
        causa: Causa;
        propiedad_id: string | null;
      }
    | undefined;
  if (!input) {
    return { ok: false, error: "La IA no pudo clasificar el reporte — creala manual." };
  }
  if (!input.propiedad_id) {
    return {
      ok: false,
      error:
        "La IA clasificó el reporte pero no identificó la propiedad — usá “Crear manual” y elegila.",
    };
  }

  return crearDesdeReporte(reporteId, {
    descripcion: input.descripcion,
    propiedad_id: input.propiedad_id,
    especialidad_id: input.especialidad_id,
    urgencia: input.urgencia,
    causa: input.causa,
  });
}
