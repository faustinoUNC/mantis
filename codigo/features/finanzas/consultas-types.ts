// Tipos y helpers puros del módulo Finanzas (vista de consolidación de
// cobros y liquidaciones). Sin "use server": exporta tipos y funciones puras.

// ── Filas de COBROS ──────────────────────────────────────────────────────
export interface FilaCobroPendiente {
  id: string;
  descripcion: string;
  direccion: string;
  pagadorNombre: string;
  pagadorRotulo: string; // "Propietario" | "Inquilino" | "—"
  total: number;
  diasPendiente: number | null;
}

export interface FilaCobroCerrado {
  id: string;
  descripcion: string;
  direccion: string;
  pagadorNombre: string;
  pagadorRotulo: string; // "Propietario" | "Inquilino" | "—"
  monto: number;
  medioLabel: string;
  fecha: string; // ISO (cobrado_en)
}

export interface CobrosData {
  pendientes: FilaCobroPendiente[];
  cerrados: FilaCobroCerrado[];
}

// ── Filas de LIQUIDACIONES ───────────────────────────────────────────────
export interface FilaLiquidacionPendiente {
  id: string;
  descripcion: string;
  direccion: string;
  tecnicoNombre: string;
  monto: number;
  diasPendiente: number | null;
}

export interface FilaLiquidacionCerrada {
  id: string;
  descripcion: string;
  direccion: string;
  tecnicoNombre: string;
  monto: number;
  medioLabel: string;
  fecha: string; // ISO (liq_pagada_en)
}

export interface LiquidacionesData {
  pendientes: FilaLiquidacionPendiente[];
  cerrados: FilaLiquidacionCerrada[];
}

// ── Filas de ADELANTOS (STORY-1019) ──────────────────────────────────────
// Ciclo de vida completo del adelanto, derivado de columna + eventos (cero
// tablas): EN OBRA (curso normal) → se salda solo al liquidar → o queda
// A RESOLVER si la obra no lo concretó (desasignación, cancelación, sobrante).
export type OrigenAdelanto = "desasignacion" | "cancelacion" | "sobrante";

export const ORIGEN_ADELANTO_LABEL: Record<OrigenAdelanto, string> = {
  desasignacion: "Técnico desasignado",
  cancelacion: "Gestión cancelada",
  sobrante: "Sobrante de liquidación",
};

export interface FilaAdelantoEnObra {
  id: string; // gestión
  descripcion: string;
  direccion: string;
  tecnicoNombre: string;
  monto: number;
}

export interface ItemAdelantoAResolver {
  gestionId: string;
  descripcion: string;
  direccion: string;
  tecnicoId: string | null;
  tecnicoNombre: string;
  monto: number; // neto (descuenta devolución en el acto)
  origen: OrigenAdelanto;
  origenEventoId: string | null; // null solo para cancelación
  diasPendiente: number | null;
}

export interface GrupoAdelantosTecnico {
  tecnicoId: string | null;
  tecnicoNombre: string;
  total: number;
  items: ItemAdelantoAResolver[];
}

export interface FilaAdelantoSaldado {
  id: string; // clave única de la fila (evento o `liq-{gestion}`)
  gestionId: string;
  descripcion: string;
  direccion: string;
  tecnicoNombre: string;
  monto: number;
  modo: "liquidacion" | "manual";
  nota: string | null; // solo manual
  fecha: string; // ISO
}

export interface AdelantosData {
  enObra: FilaAdelantoEnObra[];
  aResolver: GrupoAdelantosTecnico[];
  saldados: FilaAdelantoSaldado[];
}

// ── Umbral de alerta de antigüedad ───────────────────────────────────────
// A partir de estos días, la antigüedad de un pendiente se pinta en ámbar
// (token urgente). Lista cerrada, sin configurabilidad (Regla #0).
export const DIAS_ALERTA = 8;

// ── Helpers de fecha/moneda (deterministas, sin Intl) ────────────────────
// Argentina: offset fijo -03:00 (no hay horario de verano).
const MS_AR = 3 * 60 * 60 * 1000;
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function fechaAR(iso: string): Date {
  // Corre la fecha -3h y luego se lee en UTC → equivale a hora argentina,
  // sin depender de la zona horaria del servidor.
  return new Date(new Date(iso).getTime() - MS_AR);
}

// Clave de agrupación "AAAA-MM" (para agrupar cerrados por mes).
export function claveMes(iso: string): string {
  const d = fechaAR(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Etiqueta legible del mes, p. ej. "Julio 2026".
export function mesLabel(iso: string): string {
  const d = fechaAR(iso);
  return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Días transcurridos desde una fecha ISO hasta ahora (entero, >= 0).
export function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

// "hoy" | "hace 1 día" | "hace N días" | "—"
export function antiguedadLegible(dias: number | null): string {
  if (dias == null) return "—";
  if (dias <= 0) return "hoy";
  if (dias === 1) return "hace 1 día";
  return `hace ${dias} días`;
}

// Formato de pesos determinista: "$ 1.234.567" (sin decimales, punto de miles).
export function pesos(n: number): string {
  const r = Math.round(n);
  const abs = String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$ ${r < 0 ? "-" : ""}${abs}`;
}

// La búsqueda client-side usa los helpers compartidos de shared/utils/filtros
// (coincideCampo + CampoBusqueda, patrón STORY-927 — además busca sin tildes).
