import { Especialidades } from "@/components/especialidades/especialidades.client";
import { listarEspecialidades } from "@/features/especialidades/service";

export default async function EspecialidadesPage() {
  const especialidades = await listarEspecialidades();
  return <Especialidades especialidades={especialidades} />;
}
