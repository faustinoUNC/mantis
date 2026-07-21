"use client";

// STORY-1026 — Gráfico dentro del chat de Walter. Dibuja el output de la tool
// `graficar` (serie calculada server-side; acá no se computa ningún número).
// Una sola serie → sin leyenda (el título la nombra). Colores del contract:
// esmeralda = dato, grid sutil, tooltip con la caja de Informes. Se importa
// con next/dynamic desde walter.client — recharts queda fuera del bundle común.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND = "#059669";
const GRID = "#e4e4e7";
const INK_MUTED = "#71717a";

export type GraficoWalter = {
  titulo: string;
  tipo: "barras" | "linea";
  unidad: string;
  serie: { label: string; valor: number }[];
  mostrando_top?: number;
};

const num = (v: number) =>
  Number.isInteger(v) ? v.toLocaleString("es-AR") : v.toFixed(1).replace(".", ",");

function valorLegible(v: number, unidad: string) {
  return unidad === "$" ? `$ ${Math.round(v).toLocaleString("es-AR")}` : num(v);
}

// Ejes sin ruido: la plata se abrevia (12k / 1,2M) para que entre en 330px.
function corto(v: number, unidad: string) {
  if (unidad !== "$") return num(v);
  if (Math.abs(v) >= 1_000_000) return `${Math.round(v / 100000) / 10}M`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
}

function CajaTooltip({
  active,
  payload,
  label,
  unidad,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unidad: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-md shadow-overlay px-3 py-2 text-sm">
      {label && <p className="font-medium mb-0.5">{label}</p>}
      <p className="text-muted">
        {valorLegible(payload[0].value, unidad)}
        {unidad !== "$" && ` ${unidad}`}
      </p>
    </div>
  );
}

export default function GraficoWalter({ grafico }: { grafico: GraficoWalter }) {
  const { titulo, tipo, unidad, serie, mostrando_top } = grafico;
  if (!serie?.length) return null;

  return (
    <div className="w-full pt-1">
      <p className="text-[13px] font-semibold mb-1.5">{titulo}</p>
      {tipo === "linea" ? (
        <ResponsiveContainer width="100%" height={170}>
          <LineChart data={serie} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: INK_MUTED }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              interval="preserveStartEnd"
            />
            <YAxis
              width={38}
              tick={{ fontSize: 11, fill: INK_MUTED }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => corto(v, unidad)}
            />
            <Tooltip content={<CajaTooltip unidad={unidad} />} cursor={{ stroke: GRID }} />
            <Line
              dataKey="valor"
              stroke={BRAND}
              strokeWidth={2}
              dot={{ r: 2.5, fill: BRAND, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        // Barras horizontales: los nombres (técnicos, gestores) se leen enteros
        // en el ancho del panel. Alto proporcional a la cantidad de grupos.
        <ResponsiveContainer width="100%" height={Math.max(90, serie.length * 28 + 24)}>
          <BarChart
            data={serie}
            layout="vertical"
            margin={{ top: 0, right: 44, bottom: 0, left: 0 }}
            barCategoryGap={6}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={104}
              tick={{ fontSize: 11, fill: INK_MUTED }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
            />
            <Tooltip content={<CajaTooltip unidad={unidad} />} cursor={{ fill: "transparent" }} />
            <Bar dataKey="valor" fill={BRAND} radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
              <LabelList
                dataKey="valor"
                position="right"
                formatter={(v) => (typeof v === "number" ? corto(v, unidad) : v)}
                style={{ fontSize: 11, fill: INK_MUTED }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
      <p className="text-[11px] text-muted mt-1">
        {unidad === "$" ? "Montos en pesos" : `En ${unidad}`}
        {mostrando_top ? ` · top ${mostrando_top}` : ""} · mismos datos que Informes
      </p>
    </div>
  );
}
