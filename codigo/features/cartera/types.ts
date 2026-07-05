export interface Persona {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  documento: string | null; // cuit (propietarios) o dni (inquilinos)
  activo: boolean;
}

export type TipoPersona = "propietarios" | "inquilinos";

export interface Propiedad {
  id: string;
  direccion: string;
  tipo: string | null;
  propietario_id: string;
  propietario_nombre: string;
  activa: boolean;
  ocupada: boolean;
}

export interface Legajo {
  id: string;
  propiedad_id: string;
  inquilino_id: string;
  inquilino_nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
}
