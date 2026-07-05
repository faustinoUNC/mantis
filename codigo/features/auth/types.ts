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

export const NAV_POR_ROL: Record<Rol, { href: string; label: string }[]> = {
  administrador: [
    { href: "/admin", label: "Inicio" },
    { href: "/cartera/propiedades", label: "Cartera" },
    { href: "/admin/empleados", label: "Empleados" },
    { href: "/admin/especialidades", label: "Especialidades" },
  ],
  gestor_mantenimiento: [
    { href: "/gestion", label: "Inicio" },
    { href: "/cartera/propiedades", label: "Cartera" },
  ],
  gestor_administrativo: [
    { href: "/administracion", label: "Inicio" },
    { href: "/cartera/propiedades", label: "Cartera" },
  ],
  tecnico: [{ href: "/tecnico", label: "Mis trabajos" }],
};

export const NOMBRE_ROL: Record<Rol, string> = {
  administrador: "Administrador",
  gestor_mantenimiento: "Gestor de mantenimiento",
  gestor_administrativo: "Gestor administrativo",
  tecnico: "Técnico",
};
