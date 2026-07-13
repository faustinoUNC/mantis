import { AltaAdministracion } from "@/components/cartera/alta-administracion.client";
import { listarPersonas } from "@/features/cartera/service";

export default async function NuevaAdministracionPage() {
  const propietarios = await listarPersonas("propietarios");
  return <AltaAdministracion propietarios={propietarios.filter((p) => p.activo)} />;
}
