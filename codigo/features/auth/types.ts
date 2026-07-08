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

export interface ItemNav {
  href: string;
  label: string;
  icono: string;
}

export const NAV_POR_ROL: Record<Rol, ItemNav[]> = {
  administrador: [
    { href: "/admin", label: "Inicio", icono: "inicio" },
    { href: "/tablero", label: "Tablero", icono: "tablero" },
    { href: "/inbox", label: "Inbox", icono: "inbox" },
    { href: "/cartera/propiedades", label: "Cartera", icono: "cartera" },
    { href: "/tecnicos", label: "Técnicos", icono: "tecnicos" },
    { href: "/admin/auditoria", label: "Auditoría", icono: "auditoria" },
    { href: "/admin/empleados", label: "Empleados", icono: "empleados" },
    { href: "/admin/especialidades", label: "Especialidades", icono: "especialidades" },
  ],
  gestor_mantenimiento: [
    { href: "/gestion", label: "Inicio", icono: "inicio" },
    { href: "/tablero", label: "Tablero", icono: "tablero" },
    { href: "/inbox", label: "Inbox", icono: "inbox" },
    { href: "/cartera/propiedades", label: "Cartera", icono: "cartera" },
    { href: "/tecnicos", label: "Técnicos", icono: "tecnicos" },
  ],
  gestor_administrativo: [
    { href: "/administracion", label: "Inicio", icono: "inicio" },
    { href: "/tablero", label: "Tablero", icono: "tablero" },
    { href: "/cartera/propiedades", label: "Cartera", icono: "cartera" },
  ],
  tecnico: [
    { href: "/tecnico", label: "Trabajos", icono: "tecnicos" },
    { href: "/tecnico/agenda", label: "Horarios", icono: "agenda" },
    { href: "/tecnico/perfil", label: "Perfil", icono: "perfil" },
  ],
};

export const NOMBRE_ROL: Record<Rol, string> = {
  administrador: "Administrador",
  gestor_mantenimiento: "Gestor Comercial",
  gestor_administrativo: "Gestor Financiero",
  tecnico: "Técnico",
};
