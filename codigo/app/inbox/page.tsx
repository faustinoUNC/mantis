import { Inbox } from "@/components/inbox/inbox.client";
import { listarPropiedades } from "@/features/cartera/service";
import { listarEspecialidadesActivas } from "@/features/especialidades/service";
import { listarInbox } from "@/features/inbox/service";

export default async function InboxPage() {
  const [reportes, propiedades, especialidades] = await Promise.all([
    listarInbox(),
    listarPropiedades(),
    listarEspecialidadesActivas(),
  ]);
  return (
    <Inbox
      reportes={reportes}
      propiedades={propiedades
        .filter((p) => p.activa)
        .map((p) => ({ id: p.id, direccion: p.direccion }))}
      especialidades={especialidades}
    />
  );
}
