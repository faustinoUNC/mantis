export type Etapa =
  | "ingresado"
  | "asignacion"
  | "presupuesto"
  | "en_ejecucion"
  | "conformidad"
  | "facturacion_cobro"
  | "liquidacion_tecnico"
  | "finalizado"
  // STORY-914: estado terminal de cancelación (fuera del funnel/stepper).
  | "cancelada";

export type Urgencia = "normal" | "urgente";
// STORY-943: la "Causa" se eliminó — la responsabilidad de pago la decide la
// inmobiliaria en la etapa Presupuesto, con la inspección del técnico a la vista.
export type Pagador = "inquilino" | "propietario";

export const ETAPAS: { id: Etapa; label: string }[] = [
  { id: "ingresado", label: "Ingresado" },
  { id: "asignacion", label: "Asignación" },
  { id: "presupuesto", label: "Presupuesto" },
  { id: "en_ejecucion", label: "En ejecución" },
  { id: "conformidad", label: "Conformidad" },
  { id: "facturacion_cobro", label: "Cobro" },
  { id: "liquidacion_tecnico", label: "Liquidación técnico" },
  { id: "finalizado", label: "Finalizado" },
];

export interface GestionResumen {
  id: string;
  descripcion: string;
  etapa: Etapa;
  urgencia: Urgencia;
  especialidad: string;
  direccion: string;
  propietario_nombre: string | null;
  inquilino_nombre: string | null; // del legajo snapshot; null si nació con la propiedad libre
  gestor_nombre: string;
  tecnico_nombre: string | null;
  asignacion_aceptada: boolean | null;
  // Para que la lista muestre el MISMO estado que el detalle (CTA del técnico)
  presupuesto_pendiente: boolean;
  conformidad_rechazada: boolean;
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
  actor: { nombre: string } | null;
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

// STORY-938: contacto para coordinar la visita — inquilino si la gestión
// tiene legajo vigente, si no el propietario (propiedad desocupada).
export interface ContactoCliente {
  tipo: "inquilino" | "propietario";
  nombre: string;
  telefono: string | null;
  email: string | null;
}

export interface GestionDetalle extends GestionResumen {
  // null hasta que el gestor lo decide al aprobar/enviar el presupuesto
  pagador: Pagador | null;
  costo_final: number | null;
  cargo_admin: number | null;
  // STORY-934/965: rendición del técnico al terminar la ejecución — total
  // gastado en la obra + fotos de los comprobantes (una por ticket)
  materiales_total: number | null;
  materiales_fotos_urls: string[];
  nota_emitida_en: string | null;
  // STORY-935: marca persistida del envío del presupuesto por email — sin
  // esto no se puede aprobar. Y archivado (null = activa, fuera del tablero).
  presupuesto_enviado_en: string | null;
  archivada_en: string | null;
  gestor_id: string;
  tecnico_id: string | null;
  propiedad_id: string;
  especialidad_id: string;
  eventos: Evento[];
  presupuestos: Presupuesto[];
  avances: Avance[];
  conformidades: Conformidad[];
  // STORY-914: calificación del técnico (una por gestión, se carga al finalizar)
  calificacion: { estrellas: number; comentario: string | null } | null;
  contacto_cliente: ContactoCliente | null;
}

// STORY-915: desempeño del técnico para decidir la asignación a golpe de vista.
// Se calcula agregado across TODAS sus gestiones (admin client) → solo números.
export interface StatsTecnico {
  estrellas: number | null; // promedio de calificaciones
  nCalif: number;
  // STORY-937: materiales reales vs presupuestados, ponderado por plata
  // (Σ reales / Σ presup − 1). La mano de obra es fija y no entra.
  desvioPct: number | null;
  nDesvio: number;
  obrasActivas: number; // gestiones activas asignadas (carga actual)
  obrasRealizadas: number; // gestiones finalizadas (track record; canceladas NO cuentan)
  pctRechazoAsig: number | null; // % de asignaciones que rechazó
  nAsig: number; // asignaciones respondidas (acept + rech)
  pctCancelacion: number | null; // % de sus gestiones TERMINADAS que fueron canceladas
  nTerminadas: number; // terminadas = finalizadas + canceladas
}

export interface TecnicoDisponible {
  id: string;
  nombre: string;
  especialidades: string[];
  franjas: { dia_semana: number; hora_desde: string; hora_hasta: string }[];
  stats: StatsTecnico | null;
}
