import Link from "next/link";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icono } from "@/components/ui/iconos";
import type { GestionResumen } from "@/features/gestiones/types";
import { ETAPAS } from "@/features/gestiones/types";

export interface TileInicio {
  label: string;
  valor: string;
  alerta?: boolean;
  href?: string;
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

function diasEn(fecha: string) {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  return dias === 0 ? "hoy" : `${dias} d`;
}

// Dashboard de Inicio por rol (STORY-901): saludo + tiles + acción requerida.
export function InicioRol({
  nombre,
  tiles,
  acciones,
  tituloAcciones,
  vacioAcciones,
}: {
  nombre: string;
  tiles: TileInicio[];
  acciones: GestionResumen[];
  tituloAcciones: string;
  vacioAcciones: string;
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
                  ? "group-hover:border-border-strong group-hover:-translate-y-px transition-all duration-150"
                  : ""
              }`}
            >
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-medium text-muted">{t.label}</p>
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
            <Link key={t.label} href={t.href} className="group">
              {contenido}
            </Link>
          ) : (
            <div key={t.label}>{contenido}</div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold tracking-tight">
          {tituloAcciones}
        </h2>
        <Link
          href="/tablero"
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
        >
          <Icono id="tablero" size={15} />
          Ver tablero completo
        </Link>
      </div>

      {acciones.length === 0 ? (
        <Card className="fondo-tecnico p-10 text-center">
          <span className="mx-auto flex items-center justify-center size-11 rounded-pill bg-brand-soft border border-brand-soft-border text-brand-active">
            <Icono id="check" size={20} strokeWidth={2} />
          </span>
          <p className="text-sm text-muted mt-3">{vacioAcciones}</p>
        </Card>
      ) : (
        <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {acciones.map((g) => (
            <Link key={g.id} href={`/gestiones/${g.id}`} className="group">
              <Card
                className={`p-4 h-full flex flex-col transition-all duration-150 group-hover:border-border-strong group-hover:-translate-y-px ${
                  g.urgencia === "urgente" ? "border-l-2 border-l-urgente" : ""
                }`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Badge tono="brand">
                    {ETAPAS.find((e) => e.id === g.etapa)?.label}
                  </Badge>
                  {g.urgencia === "urgente" && <Badge tono="urgente">Urgente</Badge>}
                </div>
                <p className="text-sm font-medium leading-snug line-clamp-2">
                  {g.descripcion}
                </p>
                <div className="flex items-center gap-1.5 text-[13px] text-muted mt-auto pt-2 min-w-0">
                  <Icono id="pin" size={13} />
                  <span className="truncate">
                    {g.direccion} · {g.especialidad}
                  </span>
                  <span className="ml-auto font-mono text-[11px] shrink-0">
                    {diasEn(g.creado_en)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
