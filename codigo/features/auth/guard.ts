import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "./service";
import type { Rol, UsuarioActual } from "./types";

// Guard server-side de los layouts de panel: sin sesión → login;
// rol equivocado → su propio panel (AC 3).
export async function exigirRol(rol: Rol): Promise<UsuarioActual> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/");
  if (usuario.rol !== rol) redirect("/panel");
  return usuario;
}
