import { InicioRol } from "@/components/paneles/inicio-rol";
import { obtenerUsuarioActual } from "@/features/auth/service";
import { obtenerMetricas } from "@/features/metricas/service";

export default async function AdministracionInicio() {
  const [usuario, metricas] = await Promise.all([
    obtenerUsuarioActual(),
    obtenerMetricas(),
  ]);

  return (
    <InicioRol
      nombre={usuario!.nombre}
      tiles={[
        {
          label: "Por cobrar",
          valor: `$ ${(metricas?.montoPorCobrar ?? 0).toLocaleString("es-AR")}`,
          alerta: (metricas?.pendientesCobro ?? 0) > 0,
          href: "/tablero",
        },
        {
          label: "Por liquidar a técnicos",
          valor: `$ ${(metricas?.montoPorLiquidar ?? 0).toLocaleString("es-AR")}`,
          alerta: (metricas?.pendientesLiquidacion ?? 0) > 0,
          href: "/tablero",
        },
      ]}
      metricas={metricas}
    />
  );
}
