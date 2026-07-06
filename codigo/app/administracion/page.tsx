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
          label: "Por cobrar",
          valor: `${metricas?.pendientesCobro ?? 0} · $ ${(metricas?.montoPorCobrar ?? 0).toLocaleString("es-AR")}`,
          alerta: (metricas?.pendientesCobro ?? 0) > 0,
          href: "/tablero",
        },
        {
          label: "Por liquidar a técnicos",
          valor: `${metricas?.pendientesLiquidacion ?? 0} · $ ${(metricas?.montoPorLiquidar ?? 0).toLocaleString("es-AR")}`,
          alerta: (metricas?.pendientesLiquidacion ?? 0) > 0,
          href: "/tablero",
        },
        {
          label: "Cobrado este mes",
          valor: `$ ${(metricas?.cobradoMes ?? 0).toLocaleString("es-AR")}`,
        },
        {
          label: "Fee inmobiliaria este mes",
          valor: `$ ${(metricas?.feeMes ?? 0).toLocaleString("es-AR")}`,
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
