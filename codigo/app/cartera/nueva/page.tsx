import { AltaAdministracion } from "@/components/cartera/alta-administracion.client";
import { listarPersonas } from "@/features/cartera/service";

export default async function NuevaAdministracionPage() {
  const [propietarios, inquilinos] = await Promise.all([
    listarPersonas("propietarios"),
    listarPersonas("inquilinos"),
  ]);
  return (
    <AltaAdministracion
      propietarios={propietarios.filter((p) => p.activo)}
      inquilinos={inquilinos.filter((i) => i.activo)}
    />
  );
}
