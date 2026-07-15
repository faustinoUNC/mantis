import { notFound, redirect } from "next/navigation";
import { DetalleGestion } from "@/components/gestiones/detalle.client";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { listarEmpleados } from "@/features/empleados/service";
import {
  obtenerGestion,
  tecnicosDisponibles,
} from "@/features/gestiones/service";

export default async function GestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [gestion, usuario] = await Promise.all([
    obtenerGestion(id),
    obtenerUsuarioActual(),
  ]);
  // STORY-968: para el técnico, una gestión que no ve es (casi siempre) una
  // que le acaban de desasignar — a su home, no a un 404. La campanita le
  // explica qué pasó.
  if (!gestion && usuario?.rol === "tecnico") redirect("/tecnico");
  if (!gestion || !usuario) notFound();

  const necesitaTecnicos =
    gestion.etapa === "asignacion" &&
    (usuario.rol === "administrador" || usuario.rol === "gestor_mantenimiento");
  const [tecnicos, empleados] = await Promise.all([
    necesitaTecnicos ? tecnicosDisponibles(gestion.especialidad_id) : [],
    usuario.rol === "administrador" ? listarEmpleados() : [],
  ]);

  return (
    <DetalleGestion
      gestion={gestion}
      usuario={usuario}
      tecnicos={tecnicos}
      gestores={empleados
        .filter((e) => e.rol === "gestor_mantenimiento" && e.esta_activo)
        .map((e) => ({ id: e.id, nombre: e.nombre }))}
    />
  );
}
