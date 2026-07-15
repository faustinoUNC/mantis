import { MisTrabajos } from "@/components/gestiones/mis-trabajos.client";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { tableroGestiones } from "@/features/gestiones/service";

export default async function TecnicoPage() {
  // RLS: el técnico solo recibe sus gestiones asignadas.
  const [usuario, gestiones] = await Promise.all([
    obtenerUsuarioActual(),
    tableroGestiones(),
  ]);
  return (
    <MisTrabajos
      gestiones={gestiones}
      nombre={usuario!.nombre}
      usuarioId={usuario!.id}
    />
  );
}
