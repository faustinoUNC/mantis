import { notFound, redirect } from "next/navigation";
import { DetalleGestion } from "@/components/gestiones/detalle.client";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { listarEmpleados } from "@/features/empleados/service";
import {
  adelantosAResolverDeTecnico,
  cobrosParcialesDeGestion,
} from "@/features/finanzas/consultas";
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
  // STORY-1019: al liquidar, aviso si el técnico tiene adelantos a resolver
  // (de cualquier gestión) — misma derivación única de features/finanzas.
  const necesitaDeudas =
    gestion.etapa === "liquidacion_tecnico" &&
    gestion.tecnico_id != null &&
    (usuario.rol === "administrador" || usuario.rol === "gestor_administrativo");
  // STORY-1036/1039: cobro dividido — qué partes ya se cobraron (derivado en el
  // server desde los eventos; devuelve [] si no hay cobros por parte). Se pide
  // en facturación para cualquier gestión: si no se cobra dividida, es [].
  const necesitaCobrosParciales =
    gestion.etapa === "facturacion_cobro" &&
    (usuario.rol === "administrador" || usuario.rol === "gestor_administrativo");
  const [tecnicos, empleados, deudasTecnico, cobrosParciales] = await Promise.all([
    necesitaTecnicos ? tecnicosDisponibles(gestion.especialidad_id) : [],
    usuario.rol === "administrador" ? listarEmpleados() : [],
    necesitaDeudas ? adelantosAResolverDeTecnico(gestion.tecnico_id!) : [],
    necesitaCobrosParciales ? cobrosParcialesDeGestion(gestion.id) : [],
  ]);

  return (
    <DetalleGestion
      gestion={gestion}
      usuario={usuario}
      tecnicos={tecnicos}
      gestores={empleados
        .filter((e) => e.rol === "gestor_mantenimiento" && e.esta_activo)
        .map((e) => ({ id: e.id, nombre: e.nombre }))}
      deudasTecnico={deudasTecnico}
      cobrosParciales={cobrosParciales}
    />
  );
}
