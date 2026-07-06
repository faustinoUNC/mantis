"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { Metricas } from "@/features/metricas/service";

// Reglas dataviz aplicadas: serie única esmeralda (paleta validada), sin
// leyenda (el título nombra la serie), barras finas con punta redondeada,
// grid recesivo, texto SIEMPRE en tokens de tinta, tooltip por barra.

const BRAND = "#059669";
const GRID = "#e4e4e7";
const INK_MUTED = "#71717a";

function TooltipCaja({
  active,
  payload,
  label,
  sufijo,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  sufijo: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-md shadow-overlay px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted">
        {payload[0].value} {sufijo}
      </p>
    </div>
  );
}

function Tile({
  label,
  valor,
  alerta,
}: {
  label: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p
        className={`text-2xl font-semibold tracking-tight mt-1 ${
          alerta ? "text-urgente-fuerte" : ""
        }`}
      >
        {valor}
      </p>
    </Card>
  );
}

function plata(n: number) {
  return `$ ${n.toLocaleString("es-AR")}`;
}

export function Dashboard({ metricas }: { metricas: Metricas }) {
  const esAdmin = metricas.rol === "administrador";
  const operativa = esAdmin || metricas.rol === "gestor_mantenimiento";
  const finanzas = esAdmin || metricas.rol === "gestor_administrativo";

  return (
    <div className="animate-aparecer">
      <p className="text-[13px] font-medium text-muted">
        {metricas.rol === "gestor_mantenimiento" ? "Tus gestiones" : "Panorama"}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-5">
        Métricas
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {operativa && (
          <>
            <Tile label="Gestiones activas" valor={String(metricas.activas)} />
            <Tile
              label="Urgentes +24 h sin técnico"
              valor={String(metricas.urgentesDemoradas)}
              alerta={metricas.urgentesDemoradas > 0}
            />
            <Tile
              label="Primera respuesta (mediana)"
              valor={
                metricas.primeraRespuestaHs != null
                  ? `${Math.round(metricas.primeraRespuestaHs * 10) / 10} h`
                  : "—"
              }
            />
            <Tile
              label="Resolución (mediana)"
              valor={
                metricas.resolucionDias != null
                  ? `${Math.round(metricas.resolucionDias * 10) / 10} días`
                  : "—"
              }
            />
          </>
        )}
        {finanzas && (
          <>
            <Tile
              label="Por cobrar"
              valor={`${metricas.pendientesCobro} · ${plata(metricas.montoPorCobrar)}`}
              alerta={metricas.pendientesCobro > 0}
            />
            <Tile
              label="Por liquidar a técnicos"
              valor={`${metricas.pendientesLiquidacion} · ${plata(metricas.montoPorLiquidar)}`}
              alerta={metricas.pendientesLiquidacion > 0}
            />
            <Tile label="Resueltas este mes" valor={String(metricas.resueltasMes)} />
            <Tile label="Cobrado este mes" valor={plata(metricas.cobradoMes)} />
            <Tile label="Fee inmobiliaria este mes" valor={plata(metricas.feeMes)} />
          </>
        )}
      </div>

      {operativa && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold tracking-tight mb-4">
              Gestiones por etapa
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metricas.porEtapa} margin={{ left: -24, right: 4 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="etapa"
                  tick={{ fontSize: 11, fill: INK_MUTED }}
                  tickLine={false}
                  axisLine={{ stroke: GRID }}
                  interval={0}
                  angle={-28}
                  textAnchor="end"
                  height={54}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: INK_MUTED }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(24,24,27,0.04)" }}
                  content={<TooltipCaja sufijo="gestiones" />}
                />
                <Bar
                  dataKey="cantidad"
                  fill={BRAND}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={26}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold tracking-tight mb-4">
              Resolución mediana por especialidad (días)
            </h2>
            {metricas.porEspecialidad.length === 0 ? (
              <p className="text-sm text-muted py-16 text-center">
                Todavía no hay gestiones finalizadas para medir.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={metricas.porEspecialidad}
                  layout="vertical"
                  margin={{ left: 12, right: 12 }}
                >
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: INK_MUTED }}
                    tickLine={false}
                    axisLine={{ stroke: GRID }}
                  />
                  <YAxis
                    type="category"
                    dataKey="especialidad"
                    width={110}
                    tick={{ fontSize: 11, fill: INK_MUTED }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(24,24,27,0.04)" }}
                    content={<TooltipCaja sufijo="días" />}
                  />
                  <Bar
                    dataKey="dias"
                    fill={BRAND}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={18}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
