import { Agenda } from "@/components/tecnicos/agenda.client";
import { misFranjas } from "@/features/tecnicos/service";

export default async function AgendaPage() {
  const franjas = await misFranjas();
  return <Agenda franjas={franjas} />;
}
