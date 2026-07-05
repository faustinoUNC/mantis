export type Rol =
  | "administrador"
  | "gestor_mantenimiento"
  | "gestor_administrativo"
  | "tecnico";

export interface UsuarioActual {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  esta_activo: boolean;
}

export const RUTA_POR_ROL: Record<Rol, string> = {
  administrador: "/admin",
  gestor_mantenimiento: "/gestion",
  gestor_administrativo: "/administracion",
  tecnico: "/tecnico",
};

export const NOMBRE_ROL: Record<Rol, string> = {
  administrador: "Administrador",
  gestor_mantenimiento: "Gestor de mantenimiento",
  gestor_administrativo: "Gestor administrativo",
  tecnico: "Técnico",
};
