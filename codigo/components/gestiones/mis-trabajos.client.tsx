"use client";

import Link from "next/link";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icono } from "@/components/ui/iconos";
import type { GestionResumen } from "@/features/gestiones/types";
import { ETAPAS } from "@/features/gestiones/types";
import { cn } from "@/shared/utils/cn";

// CTA del técnico según etapa (una acción clara por tarjeta — EXPERIENCE.md).
// Mismo criterio que el detalle: si ya envió el presupuesto no hay acción,
// y una conformidad rechazada SÍ pide resubir.
function ctaTecnico(g: GestionResumen): string | null {
  if (g.etapa === "asignacion" && g.asignacion_aceptada === null)
    return "Responder solicitud";
  if (g.etapa === "presupuesto" && !g.presupuesto_pendiente)
    return "Cargar presupuesto";
  if (g.etapa === "en_ejecucion") return "Registrar avance";
  if (g.etapa === "conformidad" && g.conformidad_rechazada)
    return "Resubir conformidad";
  return null;
}

function hace(fecha: string) {
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 60) return "hoy";
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

function etiquetaEtapa(id: string) {
  return ETAPAS.find((e) => e.id === id)?.label ?? id;
}

const urgentesPrimero = (a: GestionResumen, b: GestionResumen) =>
  Number(b.urgencia === "urgente") - Number(a.urgencia === "urgente");

function TarjetaConAccion({ g, cta }: { g: GestionResumen; cta: string }) {
  return (
    <Link href={`/gestiones/${g.id}`} className="block group">
      <Card
        className={cn(
          "p-4 transition-all duration-150 group-hover:border-border-strong group-active:scale-[0.985]",
          g.urgencia === "urgente" && "border-l-2 border-l-urgente"
        )}
      >
        <div className="flex items-center gap-2">
          <Badge tono="neutro">{g.especialidad}</Badge>
          {g.urgencia === "urgente" && <Badge tono="urgente">Urgente</Badge>}
          <span className="ml-auto font-mono text-[11px] text-muted shrink-0">
            {hace(g.creado_en)}
          </span>
        </div>
        <p className="font-medium leading-snug mt-2.5">{g.descripcion}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted mt-1.5">
          <Icono id="pin" size={14} />
          <span className="truncate">{g.direccion}</span>
        </p>
        <span className="flex items-center justify-center gap-1.5 w-full min-h-tap mt-3.5 rounded-md bg-brand text-white text-sm font-semibold transition-colors group-hover:bg-brand-hover group-active:bg-brand-active">
          {cta}
          <Icono id="chevron" size={15} strokeWidth={2.2} />
        </span>
      </Card>
    </Link>
  );
}

function TarjetaEnEspera({ g }: { g: GestionResumen }) {
  return (
    <Link href={`/gestiones/${g.id}`} className="block group">
      <Card className="p-3.5 flex items-center gap-3 transition-all duration-150 group-hover:border-border-strong group-active:scale-[0.985]">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug truncate">
            {g.descripcion}
          </p>
          <p className="flex items-center gap-1 text-[13px] text-muted mt-0.5">
            <Icono id="pin" size={12} />
            <span className="truncate">{g.direccion}</span>
          </p>
        </div>
        <Badge tono={g.urgencia === "urgente" ? "urgente" : "neutro"} className="shrink-0">
          {etiquetaEtapa(g.etapa)}
        </Badge>
        <span className="text-muted">
          <Icono id="chevron" size={15} strokeWidth={2} />
        </span>
      </Card>
    </Link>
  );
}

export function MisTrabajos({
  gestiones,
  nombre,
}: {
  gestiones: GestionResumen[];
  nombre: string;
}) {
  const activos = gestiones.filter((g) => g.etapa !== "finalizado");
  const conAccion = activos.filter((g) => ctaTecnico(g)).sort(urgentesPrimero);
  const enEspera = activos.filter((g) => !ctaTecnico(g)).sort(urgentesPrimero);
  const urgentes = conAccion.filter((g) => g.urgencia === "urgente").length;

  const fechaCruda = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fecha = fechaCruda.charAt(0).toUpperCase() + fechaCruda.slice(1);

  const resumen =
    conAccion.length > 0
      ? `Tenés ${conAccion.length === 1 ? "1 trabajo que te espera" : `${conAccion.length} trabajos que te esperan`}${urgentes > 0 ? ` — ${urgentes === 1 ? "1 urgente" : `${urgentes} urgentes`}` : ""}.`
      : activos.length > 0
        ? "Nada pendiente de tu lado — todo en marcha."
        : null;

  return (
    <div className="animate-aparecer max-w-lg">
      <RefrescoVivo tabla="gestiones" />
      <p className="text-[13px] font-medium text-muted">{fecha}</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
        Hola, {nombre.split(" ")[0]}
      </h1>
      {resumen && <p className="text-sm text-muted mt-1">{resumen}</p>}

      {activos.length === 0 && (
        <Card className="fondo-tecnico p-10 mt-6 text-center">
          <span className="mx-auto flex items-center justify-center size-11 rounded-pill bg-brand-soft border border-brand-soft-border text-brand-active">
            <Icono id="check" size={20} strokeWidth={2} />
          </span>
          <p className="font-medium mt-3">Estás al día</p>
          <p className="text-sm text-muted mt-1 max-w-xs mx-auto">
            No tenés trabajos asignados por ahora. Cuando te asignen uno, te
            llega una notificación.
          </p>
        </Card>
      )}

      {conAccion.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-6 mb-3">
            <h2 className="text-[15px] font-semibold tracking-tight">
              Te esperan
            </h2>
            <span className="font-mono text-[11px] min-w-5 h-5 px-1.5 rounded-pill bg-brand-soft border border-brand-soft-border text-brand-active inline-flex items-center justify-center">
              {conAccion.length}
            </span>
          </div>
          <div className="stagger flex flex-col gap-3">
            {conAccion.map((g) => (
              <TarjetaConAccion key={g.id} g={g} cta={ctaTecnico(g)!} />
            ))}
          </div>
        </>
      )}

      {enEspera.length > 0 && (
        <>
          <h2 className="text-[15px] font-semibold tracking-tight text-muted mt-7 mb-3">
            En espera
          </h2>
          <div className="stagger flex flex-col gap-2.5">
            {enEspera.map((g) => (
              <TarjetaEnEspera key={g.id} g={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
