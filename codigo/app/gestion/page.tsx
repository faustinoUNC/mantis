import { InicioRol } from "@/components/paneles/inicio-rol";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { tableroGestiones } from "@/features/gestiones/service";
import { listarInbox } from "@/features/inbox/service";
import { obtenerMetricas } from "@/features/metricas/service";
import { listarTecnicos } from "@/features/tecnicos/service";

const MIS_ETAPAS = new Set([
  "ingresado",
  "asignacion",
  "presupuesto",
  "en_ejecucion",
  "conformidad",
]);

export default async function GestionInicio() {
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
        { label: "Mis gestiones activas", valor: String(metricas?.activas ?? 0), href: "/tablero" },
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
      acciones={gestiones.filter((g) => MIS_ETAPAS.has(g.etapa)).slice(0, 6)}
      tituloAcciones="Requieren tu acción"
      vacioAcciones="Nada pendiente de tu lado. ✦"
    />
  );
}
