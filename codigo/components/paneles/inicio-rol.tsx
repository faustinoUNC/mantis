import Link from "next/link";
import { PanelMetricas } from "@/components/metricas/panel-metricas.client";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Card } from "@/components/ui/card";
import { Icono } from "@/components/ui/iconos";
import type { Metricas } from "@/features/metricas/service";

export interface TileInicio {
  label: string;
  valor: string;
  alerta?: boolean;
  href?: string;
  hint?: string; // explicación al pasar el mouse
}

const TZ = "America/Argentina/Buenos_Aires";

function saludo() {
  const hora = Number(
    new Intl.DateTimeFormat("es-AR", {
      hour: "numeric",
      hour12: false,
      timeZone: TZ,
    }).format(new Date())
  );
  if (hora >= 6 && hora < 13) return "Buen día";
  if (hora >= 13 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fechaHoy() {
  const f = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
  return f.charAt(0).toUpperCase() + f.slice(1);
}

// Dashboard de Inicio por rol (STORY-901 + STORY-912): saludo + tiles
// accionables + bloque de Rendimiento (gráficos y métricas, antes en /metricas).
export function InicioRol({
  nombre,
  tiles,
  metricas,
}: {
  nombre: string;
  tiles: TileInicio[];
  metricas: Metricas | null;
}) {
  return (
    <div className="animate-aparecer">
      <RefrescoVivo tabla="gestiones" />

      <p className="text-[13px] font-medium text-muted">{fechaHoy()}</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-6">
        {saludo()}, {nombre}
      </h1>

      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {tiles.map((t) => {
          const contenido = (
            <Card
              className={`p-4 h-full ${
                t.href
                  ? "group-hover:border-border-strong group-focus-visible:border-border-strong group-hover:-translate-y-px transition-all duration-150"
                  : ""
              }`}
            >
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-medium text-muted flex items-center">
                  {t.label}
                  {t.hint && (
                    <span className="relative group/tip ml-1 inline-flex">
                      <span className="text-muted/50 cursor-help">ⓘ</span>
                      <span className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-1.5 hidden group-hover/tip:block w-max max-w-[220px] -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] font-normal leading-snug text-foreground shadow-overlay">
                        {t.hint}
                      </span>
                    </span>
                  )}
                </p>
                {t.href && (
                  <span className="ml-auto text-muted/50 group-hover:text-brand transition-colors">
                    <Icono id="chevron" size={14} strokeWidth={2} />
                  </span>
                )}
              </div>
              <p
                className={`text-2xl font-semibold tracking-tight mt-1 ${
                  t.alerta ? "text-urgente-fuerte" : ""
                }`}
              >
                {t.valor}
              </p>
            </Card>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="group rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {contenido}
            </Link>
          ) : (
            <div key={t.label}>{contenido}</div>
          );
        })}
      </div>

      {metricas && <PanelMetricas metricas={metricas} />}
    </div>
  );
}
