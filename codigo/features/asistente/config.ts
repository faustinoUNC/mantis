// STORY-1007 — Walter, asistente IA. Configuración compartida (datos puros,
// sin 'use server': la importan el route handler y el cliente).
import type { Rol } from "@/features/auth/types";
import { NAV_POR_ROL } from "@/features/auth/types";

// Modelo en UN solo lugar. Si Haiku eligiera mal las tools en preguntas
// compuestas, el upgrade path es "claude-sonnet-5" (decisión party 2026-07-19).
export const MODELO_ASISTENTE = "claude-haiku-4-5";

export const LIMITES = {
  pasosMaximos: 5, // corta loops de tools (stopWhen)
  tokensSalida: 1200,
  caracteresInput: 2000,
  mensajesHistorial: 20, // solo los últimos N viajan al modelo
  mensajesPorHora: 30, // rate limit por usuario
} as const;

// ── Whitelist de deep links ──
// La seguridad de `sugerir_navegacion`: el modelo SOLO puede ofrecer rutas de
// esta lista (estáticas de NAV_POR_ROL + extras donde corresponde) o los
// patrones dinámicos del rol. Nada fuera de acá llega al cliente.
// STORY-1007 v1.2: las pestañas de Finanzas viven en ?tab= (STORY-1020) — sin
// estas entradas un botón "Ver liquidaciones/adelantos" caía en Cobros (mismo
// defecto que el ranking de la card #147).
const FINANZAS_TABS = [
  { href: "/finanzas?tab=liquidaciones", label: "Finanzas · Liquidaciones" },
  { href: "/finanzas?tab=adelantos", label: "Finanzas · Adelantos" },
];
const EXTRA_POR_ROL: Record<Rol, { href: string; label: string }[]> = {
  administrador: [{ href: "/metricas", label: "Informes" }, ...FINANZAS_TABS],
  gestor_mantenimiento: [{ href: "/metricas", label: "Informes" }],
  gestor_administrativo: [{ href: "/metricas", label: "Informes" }, ...FINANZAS_TABS],
  tecnico: [],
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATRONES_POR_ROL: Record<Rol, RegExp[]> = {
  administrador: [
    new RegExp(`^/gestiones/${UUID}$`),
    new RegExp(`^/tecnicos/${UUID}$`),
    new RegExp(`^/cartera/propiedades/${UUID}$`),
  ],
  gestor_mantenimiento: [
    new RegExp(`^/gestiones/${UUID}$`),
    new RegExp(`^/tecnicos/${UUID}$`),
    new RegExp(`^/cartera/propiedades/${UUID}$`),
  ],
  gestor_administrativo: [
    new RegExp(`^/gestiones/${UUID}$`),
    new RegExp(`^/cartera/propiedades/${UUID}$`),
  ],
  tecnico: [new RegExp(`^/gestiones/${UUID}$`)],
};

export function rutasEstaticas(rol: Rol): { href: string; label: string }[] {
  return [
    ...NAV_POR_ROL[rol].map(({ href, label }) => ({ href, label })),
    ...EXTRA_POR_ROL[rol],
  ];
}

export function rutaPermitida(rol: Rol, ruta: string): boolean {
  if (rutasEstaticas(rol).some((r) => r.href === ruta)) return true;
  return PATRONES_POR_ROL[rol].some((p) => p.test(ruta));
}

// ── Chips de arranque (empty state del chat, por rol) ──
export const CHIPS_POR_ROL: Record<Rol, string[]> = {
  administrador: [
    "¿Cómo viene el negocio este mes?",
    "¿Cuál es el técnico mejor calificado?",
    "¿Qué gestiones necesitan atención?",
    "¿Cuánta plata hay por cobrar?",
  ],
  gestor_mantenimiento: [
    "¿Qué tengo pendiente hoy?",
    "¿Cuál es el técnico mejor calificado?",
    "¿Qué gestiones tengo en presupuesto?",
    "¿Cómo asigno un técnico?",
  ],
  gestor_administrativo: [
    "¿Cuánto hay por cobrar?",
    "¿Qué liquidaciones están pendientes?",
    "¿Cómo registro un cobro?",
    "¿Cómo viene la facturación?",
  ],
  tecnico: [
    "¿Qué me toca hoy?",
    "¿Cómo subo la conformidad?",
    "¿Qué trabajos tengo en ejecución?",
    "¿Cómo aviso que no puedo continuar?",
  ],
};
