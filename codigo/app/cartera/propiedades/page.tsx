import { PropiedadesAbm } from "@/components/cartera/propiedades.client";
import { listarPersonas, listarPropiedades } from "@/features/cartera/service";

export default async function PropiedadesPage() {
  const [propiedades, propietarios] = await Promise.all([
    listarPropiedades(),
    listarPersonas("propietarios"),
  ]);
  return (
    <PropiedadesAbm
      propiedades={propiedades}
      propietariosActivos={propietarios.filter((p) => p.activo)}
    />
  );
}
