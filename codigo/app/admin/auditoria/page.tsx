import { Auditoria } from "@/components/auditoria/auditoria.client";
import { historialGlobal, listarActores } from "@/features/auditoria/service";

export default async function AuditoriaPage() {
  const [inicial, actores] = await Promise.all([
    historialGlobal(),
    listarActores(),
  ]);
  return <Auditoria inicial={inicial} actores={actores} />;
}
