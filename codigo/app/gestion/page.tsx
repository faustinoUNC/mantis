import { Tablero } from "@/components/gestiones/tablero.client";
import { listarEspecialidadesActivas } from "@/features/especialidades/service";
import { listarPropiedades } from "@/features/cartera/service";
import { tableroGestiones } from "@/features/gestiones/service";
import type { Rol } from "@/features/auth/types";

async function datosTablero() {
  const [gestiones, propiedades, especialidades] = await Promise.all([
    tableroGestiones(),
    listarPropiedades(),
    listarEspecialidadesActivas(),
  ]);
  return {
    gestiones,
    especialidades,
    propiedades: propiedades
      .filter((p) => p.activa)
      .map((p) => ({ id: p.id, direccion: p.direccion })),
  };
}

export default async function Page() {
  const datos = await datosTablero();
  return <Tablero rol={"gestor_mantenimiento" as Rol} {...datos} />;
}
