export type EstadoTecnico = "pendiente" | "aprobado" | "rechazado";

export interface TecnicoResumen {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  estado: EstadoTecnico;
  // false + pendiente = reintento tras rechazo esperando verificación
  // (las solicitudes nuevas sin verificar no llegan al staff, STORY-955/958).
  email_verificado: boolean;
  especialidades: string[];
  esta_activo: boolean | null; // null = sin fila en usuarios (pendiente/rechazado)
  creado_en: string; // fecha de registro/alta del técnico
}

export interface TecnicoDetalle extends TecnicoResumen {
  cuil: string | null;
  motivo_rechazo: string | null;
  especialidad_ids: string[];
  tieneMatricula: boolean;
  docs: { tipo: string; url: string }[]; // "DNI", "Matrícula" o "Matrícula N"
}

export interface Franja {
  id: string;
  dia_semana: number;
  hora_desde: string;
  hora_hasta: string;
}

export const DIAS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
