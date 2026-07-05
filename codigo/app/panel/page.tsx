import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { RUTA_POR_ROL } from "@/features/auth/types";

// Router por rol: único punto que decide a qué panel va cada usuario.
export default async function PanelPage() {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) redirect("/");
  redirect(RUTA_POR_ROL[usuario.rol]);
}
