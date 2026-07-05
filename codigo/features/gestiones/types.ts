export type Etapa =
  | "ingresado"
  | "asignacion"
  | "presupuesto"
  | "en_ejecucion"
  | "conformidad"
  | "facturacion_cobro"
  | "liquidacion_tecnico"
  | "finalizado";

export type Urgencia = "normal" | "urgente";
export type Causa = "desgaste" | "dano" | "mejora";
export type Pagador = "inquilino" | "propietario";

export const ETAPAS: { id: Etapa; label: string }[] = [
  { id: "ingresado", label: "Ingresado" },
  { id: "asignacion", label: "Asignación" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "en_ejecucion", label: "En ejecución" },
  { id: "conformidad", label: "Conformidad" },
  { id: "facturacion_cobro", label: "Facturación y cobro" },
  { id: "liquidacion_tecnico", label: "Liquidación técnico" },
  { id: "finalizado", label: "Finalizado" },
];

export const LABEL_CAUSA: Record<Causa, string> = {
  desgaste: "Desgaste / antigüedad",
  dano: "Daño por uso",
  mejora: "Mejora",
};

// Regla CCyC (supletoria): desgaste → propietario; daño culpable → inquilino.
export const PAGADOR_POR_CAUSA: Record<Causa, Pagador> = {
  desgaste: "propietario",
  dano: "inquilino",
  mejora: "propietario",
};

export interface GestionResumen {
  id: string;
  descripcion: string;
  etapa: Etapa;
  urgencia: Urgencia;
  especialidad: string;
  direccion: string;
  gestor_nombre: string;
  tecnico_nombre: string | null;
  asignacion_aceptada: boolean | null;
  creado_en: string;
}

export interface Evento {
  id: string;
  tipo: string;
  de_etapa: Etapa | null;
  a_etapa: Etapa | null;
  actor_id: string;
  detalle: Record<string, unknown> | null;
  creado_en: string;
}

export interface Presupuesto {
  id: string;
  monto_materiales: number;
  monto_mano_obra: number;
  descripcion_trabajo: string | null;
  plazo_dias: number | null;
  notas: string | null;
  estado: "enviado" | "aprobado" | "rechazado";
  motivo_rechazo: string | null;
  creado_en: string;
}

export interface Avance {
  id: string;
  tipo: "inspeccion" | "avance";
  nota: string;
  foto_url: string | null;
  creado_en: string;
}

export interface Conformidad {
  id: string;
  foto_url: string | null;
  estado: "subida" | "aprobada" | "rechazada";
  motivo_rechazo: string | null;
  creado_en: string;
}

export interface GestionDetalle extends GestionResumen {
  causa: Causa;
  pagador_sugerido: Pagador;
  pagador: Pagador | null;
  costo_final: number | null;
  gestor_id: string;
  tecnico_id: string | null;
  propiedad_id: string;
  especialidad_id: string;
  eventos: Evento[];
  presupuestos: Presupuesto[];
  avances: Avance[];
  conformidades: Conformidad[];
}

export interface TecnicoDisponible {
  id: string;
  nombre: string;
  franjas: { dia_semana: number; hora_desde: string; hora_hasta: string }[];
}
