import { InicioRol } from "@/components/paneles/inicio-rol";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { listarInbox } from "@/features/inbox/service";
import { obtenerMetricas } from "@/features/metricas/service";
import { listarTecnicos } from "@/features/tecnicos/service";

export default async function AdminInicio() {
  const [usuario, metricas, inbox, tecnicos] = await Promise.all([
    obtenerUsuarioActual(),
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
          label: "Urgentes sin asignar",
          valor: String(metricas?.urgentesSinAsignar ?? 0),
          alerta: (metricas?.urgentesSinAsignar ?? 0) > 0,
          href: "/tablero",
          hint: "Gestiones urgentes en Ingresado o Asignación — todavía sin arrancar.",
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
        // Los importes de caja pendiente viven en Métricas → "Dinero pendiente".
      ]}
      metricas={metricas}
    />
  );
}
