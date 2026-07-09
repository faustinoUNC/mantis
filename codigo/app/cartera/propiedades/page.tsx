import { PropiedadesAbm } from "@/components/cartera/propiedades.client";
import { listarPropiedades } from "@/features/cartera/service";

export default async function PropiedadesPage() {
  const propiedades = await listarPropiedades();
  return <PropiedadesAbm propiedades={propiedades} />;
}
