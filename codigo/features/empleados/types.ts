import type { Rol, UsuarioActual } from "@/features/auth/types";

export type Empleado = UsuarioActual & { creado_en: string };

export interface NuevoEmpleado {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };
