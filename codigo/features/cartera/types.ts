export interface Persona {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  documento: string | null; // cuil (CUIT/CUIL para propietarios, que pueden ser empresa)
  activo: boolean;
}

export type TipoPersona = "propietarios" | "inquilinos";

export const TIPOS_INMUEBLE = [
  "Departamento",
  "Casa",
  "PH",
  "Duplex",
  "Local",
  "Oficina",
  "Cochera",
] as const;

export type TipoInmueble = (typeof TIPOS_INMUEBLE)[number];

// Referencia de persona para el alta de administración: existente o nueva.
export type RefPersona =
  | { id: string }
  | { nueva: { nombre: string; email: string; telefono: string; cuil: string } };

export interface Propiedad {
  id: string;
  direccion: string;
  tipo: string | null;
  // STORY-999: sub-descripción opcional de ubicación (piso/depto, casa en
  // complejo, nº de local…). Un único campo libre para todos los casos.
  unidad: string | null;
  propietario_id: string;
  propietario_nombre: string;
  activa: boolean;
  ocupada: boolean;
  inquilino_nombre: string | null; // del legajo vigente; null si está libre
}

export interface Legajo {
  id: string;
  propiedad_id: string;
  inquilino_id: string;
  inquilino_nombre: string;
  // Datos completos del inquilino, para editarlos desde la propiedad
  // (STORY-941 — reemplaza al ABM suelto).
  inquilino: Persona | null;
  fecha_inicio: string;
  fecha_fin: string | null;
}
