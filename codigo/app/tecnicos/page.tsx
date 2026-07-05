import { Tecnicos } from "@/components/tecnicos/tecnicos.client";
import { listarEspecialidadesActivas } from "@/features/especialidades/service";
import { listarTecnicos } from "@/features/tecnicos/service";

export default async function TecnicosPage() {
  const [tecnicos, especialidades] = await Promise.all([
    listarTecnicos(),
    listarEspecialidadesActivas(),
  ]);
  return <Tecnicos tecnicos={tecnicos} especialidades={especialidades} />;
}
