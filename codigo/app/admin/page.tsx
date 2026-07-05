import { InicioRol } from "@/components/paneles/inicio-rol";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { tableroGestiones } from "@/features/gestiones/service";
import { listarInbox } from "@/features/inbox/service";
import { obtenerMetricas } from "@/features/metricas/service";
import { listarTecnicos } from "@/features/tecnicos/service";

export default async function AdminInicio() {
  const [usuario, gestiones, metricas, inbox, tecnicos] = await Promise.all([
    obtenerUsuarioActual(),
    tableroGestiones(),
    obtenerMetricas(),
    listarInbox(),
    listarTecnicos(),
  ]);
  const solicitudes = tecnicos.filter((t) => t.estado === "pendiente").length;

  return (
    <InicioRol
      nombre={usuario!.nombre}
      tiles={[
        { label: "Gestiones activas", valor: String(metricas?.activas ?? 0), href: "/tablero" },
        {
          label: "Urgentes +24 h sin técnico",
          valor: String(metricas?.urgentesDemoradas ?? 0),
          alerta: (metricas?.urgentesDemoradas ?? 0) > 0,
          href: "/tablero",
        },
        {
          label: "Reportes en el inbox",
          valor: String(inbox.length),
          alerta: inbox.length > 0,
          href: "/inbox",
        },
        {
          label: "Solicitudes de técnicos",
          valor: String(solicitudes),
          alerta: solicitudes > 0,
          href: "/tecnicos",
        },
      ]}
      acciones={gestiones.filter((g) => g.etapa !== "finalizado").slice(0, 6)}
      tituloAcciones="Gestiones en curso"
      vacioAcciones="No hay gestiones en curso — el funnel está al día."
    />
  );
}
