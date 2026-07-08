import { redirect } from "next/navigation";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { RUTA_POR_ROL } from "@/features/auth/types";

// STORY-912: Métricas se consolidó en el Inicio de cada rol. Este redirect
// mantiene vivos los enlaces viejos a /metricas.
export default async function MetricasPage() {
  const usuario = await obtenerUsuarioActual();
  redirect(usuario ? RUTA_POR_ROL[usuario.rol] : "/");
}
