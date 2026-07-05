import { Auditoria } from "@/components/auditoria/auditoria.client";
import { historialGlobal } from "@/features/auditoria/service";

export default async function AuditoriaPage() {
  const eventos = await historialGlobal();
  return <Auditoria eventos={eventos} />;
}
