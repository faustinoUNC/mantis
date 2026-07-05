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

      <p className="text-[13px] font-medium text-muted">Inicio</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-6">
        Hola, {nombre}
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {tiles.map((t) => {
          const contenido = (
            <Card
              className={`p-4 h-full ${t.href ? "hover:border-border-strong transition-colors" : ""}`}
            >
              <p className="text-[13px] font-medium text-muted">{t.label}</p>
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
            <Link key={t.label} href={t.href}>
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
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">{vacioAcciones}</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {acciones.map((g) => (
            <Link key={g.id} href={`/gestiones/${g.id}`}>
              <Card
                className={`p-4 h-full hover:border-border-strong transition-colors ${
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
                <p className="text-[13px] text-muted mt-1.5 truncate">
                  {g.direccion} · {g.especialidad}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
