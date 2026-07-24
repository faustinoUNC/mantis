import { Tablero } from "@/components/gestiones/tablero.client";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { listarPropiedades } from "@/features/cartera/service";
import { listarEspecialidadesActivas } from "@/features/especialidades/service";
import { tableroGestiones } from "@/features/gestiones/service";

export default async function TableroPage({
  searchParams,
}: {
  // STORY-1051: la bandeja "Para revisar de fondo" abre Nueva Gestión
  // pre-cargada (propiedad + especialidad + descripción con antecedentes) con
  // fondo=1 → la gestión creada marca el patrón como atendido.
  searchParams: Promise<{
    propiedad?: string;
    especialidad?: string;
    descripcion?: string;
    fondo?: string;
  }>;
}) {
  const [{ propiedad, especialidad, descripcion, fondo }, usuario, gestiones, propiedades, especialidades] =
    await Promise.all([
      searchParams,
      obtenerUsuarioActual(),
      tableroGestiones(),
      listarPropiedades(),
      listarEspecialidadesActivas(),
    ]);
  const prefill = propiedad
    ? {
        propiedadId: propiedad,
        especialidadId: especialidad ?? "",
        descripcion: descripcion ?? "",
        esFondo: fondo === "1",
      }
    : undefined;
  return (
    <Tablero
      rol={usuario!.rol}
      gestiones={gestiones}
      especialidades={especialidades}
      propiedades={propiedades
        .filter((p) => p.activa)
        .map((p) => ({ id: p.id, direccion: p.direccion }))}
      prefill={prefill}
    />
  );
}
