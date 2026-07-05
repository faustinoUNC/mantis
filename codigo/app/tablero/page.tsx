import { Tablero } from "@/components/gestiones/tablero.client";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { listarPropiedades } from "@/features/cartera/service";
import { listarEspecialidadesActivas } from "@/features/especialidades/service";
import { tableroGestiones } from "@/features/gestiones/service";

export default async function TableroPage() {
  const [usuario, gestiones, propiedades, especialidades] = await Promise.all([
    obtenerUsuarioActual(),
    tableroGestiones(),
    listarPropiedades(),
    listarEspecialidadesActivas(),
  ]);
  return (
    <Tablero
      rol={usuario!.rol}
      gestiones={gestiones}
      especialidades={especialidades}
      propiedades={propiedades
        .filter((p) => p.activa)
        .map((p) => ({ id: p.id, direccion: p.direccion }))}
    />
  );
}
