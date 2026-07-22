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
  en_vacaciones: boolean; // STORY-1034: lo prende/apaga el propio técnico
  creado_en: string; // fecha de registro/alta del técnico
}

export interface TecnicoDetalle extends TecnicoResumen {
  cuil: string | null;
  motivo_rechazo: string | null;
  especialidad_ids: string[];
  // "DNI", "Matrícula" o "Matrícula N". `path` solo viene en las matrículas
  // (permite borrarlas); el DNI no se puede eliminar desde acá.
  docs: { tipo: string; url: string; path?: string }[];
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

// STORY-1025: franja sin id (la carga del enrolamiento y las validaciones
// comparten esta forma). Horas "HH:MM" — comparan bien como strings.
export interface FranjaNueva {
  dia_semana: number;
  hora_desde: string;
  hora_hasta: string;
}

// Validación compartida cliente/server: fin > inicio y sin pisarse con las
// existentes del mismo día. Devuelve el mensaje de error o null.
export function errorFranja(
  nueva: FranjaNueva,
  existentes: FranjaNueva[]
): string | null {
  if (nueva.hora_hasta <= nueva.hora_desde) {
    return "La hora de fin debe ser mayor a la de inicio.";
  }
  const pisada = existentes.find(
    (f) =>
      f.dia_semana === nueva.dia_semana &&
      nueva.hora_desde < f.hora_hasta.slice(0, 5) &&
      f.hora_desde.slice(0, 5) < nueva.hora_hasta
  );
  if (pisada) {
    return `Se pisa con tu franja de ${pisada.hora_desde.slice(0, 5)}–${pisada.hora_hasta.slice(0, 5)} del ${DIAS[nueva.dia_semana].toLowerCase()}.`;
  }
  return null;
}
