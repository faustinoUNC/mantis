"use server";

// STORY-1051 — Acciones de la bandeja "Para revisar de fondo". La detección y
// el orden se computan client-side sobre `metricas.filas` (features/patrones-fondo/
// patrones.ts); acá viven las ESCRITURAS, la lectura de las revisiones y el
// análisis de Walter (Fase 2).

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { MODELO_ANALISIS } from "@/features/asistente/config";
import { estadoObra } from "@/features/cartera/historial";
import { createClient } from "@/shared/lib/supabase/server";
import type { ActionResult } from "@/features/empleados/types";
import type { RevisionFondo } from "./patrones";

// Las revisiones que ya existen, para derivar el ciclo de vida (ocultar/
// reaparecer). RLS scopea por rol; el alcance fino lo pone la bandeja al cruzar
// contra las gestiones que el usuario ve.
export async function listarRevisionesFondo(): Promise<RevisionFondo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("revisiones_fondo")
    .select("propiedad_id, especialidad_id, atendida_en, resultado, gestion_fondo_id");
  return (data ?? []).map((r) => ({
    propiedadId: r.propiedad_id as string,
    especialidadId: r.especialidad_id as string,
    atendidaEn: r.atendida_en as string,
    resultado: r.resultado as RevisionFondo["resultado"],
    gestionFondoId: (r.gestion_fondo_id as string | null) ?? null,
  }));
}

// "No están relacionadas / coincidencia": marca el patrón como atendido. La fila
// sale de la bandeja y solo vuelve si entra una obra nueva de ese rubro después.
export async function descartarPatron(
  propiedadId: string,
  especialidadId: string
): Promise<ActionResult> {
  const actual = await obtenerUsuarioActual();
  if (!actual) return { ok: false, error: "Sin sesión." };

  const supabase = await createClient();
  const { error } = await supabase.from("revisiones_fondo").insert({
    propiedad_id: propiedadId,
    especialidad_id: especialidadId,
    resultado: "descartada",
    actor_id: actual.id,
  });
  if (error) return { ok: false, error: "No se pudo descartar el patrón." };
  return { ok: true };
}

// ── Fase 2: el análisis de Walter ──
// Junta las notas de INSPECCIÓN (el diagnóstico del técnico) de las obras de una
// propiedad+rubro y le pide a Sonnet 5 un veredicto ESTRUCTURADO con cita textual
// obligatoria por obra. El riesgo es la fidelidad (afirmar algo que la fuente no
// dice): sin cita, no hay evidencia; "insuficiente" es un veredicto de primera
// clase (abstención). No ve fotos.

const MS_ANIO_ANALISIS = 365 * 24 * 3600 * 1000;

export interface AnalisisFondo {
  ok: boolean;
  error?: string;
  veredicto?: "fondo" | "coincidencia" | "insuficiente";
  confianza?: number;
  razonamiento?: string;
  sugerencia?: string | null;
  obras?: { numero: number; cita_textual: string }[];
}

const schemaAnalisis = z.object({
  veredicto: z.enum(["fondo", "coincidencia", "insuficiente"]),
  confianza: z.number().min(0).max(1),
  razonamiento: z.string(),
  // Por cada obra que sostiene "fondo": la frase TEXTUAL de la nota de inspección
  // que la conecta. Vacío si coincidencia/insuficiente.
  obras: z.array(z.object({ numero: z.number(), cita_textual: z.string() })),
  // Si es de fondo: la acción concreta y de bajo riesgo leída de las notas
  // (ej. "cambiar el picaporte en vez de reajustarlo"). null si no aplica.
  sugerencia: z.string().nullable(),
});

const PROMPT_ANALISIS = `Sos un analista de mantenimiento inmobiliario. Te paso las obras de UN mismo rubro en UNA misma propiedad. Decidí si son el MISMO problema de fondo (misma causa raíz) o coincidencias.

Reglas innegociables:
- Basate SOLO en las NOTAS DE INSPECCIÓN del técnico (el diagnóstico). El "reporte" es el síntoma que contó el inquilino: NO alcanza para afirmar la causa.
- Para el veredicto "fondo" tenés que CITAR TEXTUAL la frase de la nota de inspección de cada obra que lo sostiene. Si no podés citar una frase que lo diga, NO es "fondo".
- Si las notas no dejan ver la causa (genéricas, vacías, o la evidencia estaría en una foto que no ves), veredicto "insuficiente". Es una respuesta válida y honesta — mejor eso que inventar.
- Si el rubro se repite pero las causas son distintas (artefactos/componentes distintos), veredicto "coincidencia".
- Tu default es la duda. No afirmes de más. No ves fotos: si la evidencia clave estaría en una foto, decilo en el razonamiento.
- "sugerencia": solo si es "fondo" — una acción concreta y de bajo riesgo que se lee de las notas (cambiar el componente que se re-arregla una y otra vez), nunca un peritaje de ingeniería.
- razonamiento y sugerencia en español rioplatense, breve.`;

export async function analizarPatronFondo(
  direccion: string,
  especialidad: string,
  plazoAnios?: number | null
): Promise<AnalisisFondo> {
  const actual = await obtenerUsuarioActual();
  if (!actual || actual.rol === "tecnico") return { ok: false, error: "Sin acceso." };

  const supabase = await createClient();
  // Resolver propiedad (RLS scopea) y especialidad por nombre.
  const { data: props } = await supabase
    .from("propiedades")
    .select("id, direccion")
    .ilike("direccion", direccion.trim());
  const propiedad = props?.[0];
  if (!propiedad) return { ok: false, error: `No encontré la propiedad "${direccion}".` };

  const { data: esps } = await supabase
    .from("especialidades")
    .select("id, nombre")
    .ilike("nombre", especialidad.trim());
  const esp = esps?.[0];
  if (!esp) return { ok: false, error: `No encontré el rubro "${especialidad}".` };

  const { data: gestiones } = await supabase
    .from("gestiones")
    .select(
      "numero, descripcion, etapa, cargo_cancelacion, materiales_total, creado_en, avances(tipo, nota), presupuestos(descripcion_trabajo, estado)"
    )
    .eq("propiedad_id", propiedad.id)
    .eq("especialidad_id", esp.id)
    .order("creado_en");

  type G = {
    numero: number;
    descripcion: string;
    etapa: string;
    cargo_cancelacion: number | null;
    materiales_total: number | null;
    creado_en: string;
    avances: { tipo: string; nota: string }[] | null;
    presupuestos: { descripcion_trabajo: string | null; estado: string }[] | null;
  };
  const desde = plazoAnios != null ? Date.now() - plazoAnios * MS_ANIO_ANALISIS : null;
  const obras = ((gestiones ?? []) as unknown as G[])
    .filter((g) => estadoObra(g.etapa, g.cargo_cancelacion) !== "cancelada")
    .filter((g) => desde == null || new Date(g.creado_en).getTime() >= desde)
    .slice(-12); // techo de tokens

  if (obras.length < 2) {
    return { ok: false, error: "No hay suficientes obras de ese rubro en esa propiedad para analizar." };
  }

  // Evidencia: reporte (síntoma) + notas de inspección (diagnóstico, TEXTUAL) +
  // trabajo presupuestado + rendición. Sin fotos.
  const evidencia = obras
    .map((g) => {
      const inspecciones = (g.avances ?? [])
        .filter((a) => a.tipo === "inspeccion" && a.nota?.trim())
        .map((a) => `    · inspección: "${a.nota.trim()}"`)
        .join("\n");
      const trabajo = (g.presupuestos ?? []).find((p) => p.estado === "aprobado")?.descripcion_trabajo;
      const rendicion = g.materiales_total != null ? `\n    · rendición materiales: $${g.materiales_total}` : "";
      return [
        `- Obra #${g.numero} (${new Date(g.creado_en).toLocaleDateString("es-AR")})`,
        `    · reporte (síntoma): "${g.descripcion}"`,
        inspecciones || "    · inspección: (sin nota)",
        trabajo ? `    · trabajo presupuestado: "${trabajo}"` : "",
      ]
        .filter(Boolean)
        .join("\n") + rendicion;
    })
    .join("\n");

  try {
    const { object } = await generateObject({
      model: anthropic(MODELO_ANALISIS),
      schema: schemaAnalisis,
      system: PROMPT_ANALISIS,
      prompt: `Propiedad: ${propiedad.direccion} · Rubro: ${esp.nombre} · ${obras.length} obras.\n\n${evidencia}`,
      // generateObject fuerza tool-choice y eso choca con el thinking (que
      // Sonnet 5 trae prendido por default) → 400. Se apaga para esta llamada.
      providerOptions: { anthropic: { thinking: { type: "disabled" } } },
    });
    return { ok: true, ...object };
  } catch {
    return { ok: false, error: "No pude completar el análisis ahora." };
  }
}
