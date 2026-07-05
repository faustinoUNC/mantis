import { MisTrabajos } from "@/components/gestiones/mis-trabajos.client";
import { tableroGestiones } from "@/features/gestiones/service";

export default async function TecnicoPage() {
  // RLS: el técnico solo recibe sus gestiones asignadas.
  const gestiones = await tableroGestiones();
  return <MisTrabajos gestiones={gestiones} />;
}
