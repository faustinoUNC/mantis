import { InicioRol } from "@/components/paneles/inicio-rol";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { tableroGestiones } from "@/features/gestiones/service";
import { obtenerMetricas } from "@/features/metricas/service";

export default async function AdministracionInicio() {
  const [usuario, gestiones, metricas] = await Promise.all([
    obtenerUsuarioActual(),
    tableroGestiones(),
    obtenerMetricas(),
  ]);

  return (
    <InicioRol
      nombre={usuario!.nombre}
      tiles={[
        {
          label: "Pendientes de cobro",
          valor: String(metricas?.pendientesCobro ?? 0),
          alerta: (metricas?.pendientesCobro ?? 0) > 0,
          href: "/tablero",
        },
        {
          label: "Por cobrar ($)",
          valor: `$ ${(metricas?.montoPorCobrar ?? 0).toLocaleString("es-AR")}`,
        },
        {
          label: "Pendientes de liquidación",
          valor: String(metricas?.pendientesLiquidacion ?? 0),
          alerta: (metricas?.pendientesLiquidacion ?? 0) > 0,
          href: "/tablero",
        },
        {
          label: "Cobrado acumulado",
          valor: `$ ${(metricas?.cobradoTotal ?? 0).toLocaleString("es-AR")}`,
        },
      ]}
      acciones={gestiones
        .filter((g) => g.etapa === "facturacion_cobro" || g.etapa === "liquidacion_tecnico")
        .slice(0, 6)}
      tituloAcciones="Para facturar o liquidar"
      vacioAcciones="Nada pendiente de cobro ni liquidación. ✦"
    />
  );
}
