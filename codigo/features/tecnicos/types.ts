export type EstadoTecnico = "pendiente" | "aprobado" | "rechazado";

export interface TecnicoResumen {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  estado: EstadoTecnico;
  especialidades: string[];
  esta_activo: boolean | null; // null = sin fila en usuarios (pendiente/rechazado)
}

export interface TecnicoDetalle extends TecnicoResumen {
  dni: string | null;
  motivo_rechazo: string | null;
  docs: { tipo: "DNI" | "Matrícula"; url: string }[];
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
