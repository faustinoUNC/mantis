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
        // Contadores accionables; los importes viven en Métricas → "Dinero pendiente".
        {
          label: "Gestiones por cobrar",
          valor: String(metricas?.pendientesCobro ?? 0),
          alerta: (metricas?.pendientesCobro ?? 0) > 0,
          href: "/tablero",
        },
        {
          label: "Por liquidar a técnicos",
          valor: String(metricas?.pendientesLiquidacion ?? 0),
          alerta: (metricas?.pendientesLiquidacion ?? 0) > 0,
          href: "/tablero",
        },
      ]}
      metricas={metricas}
    />
  );
}
