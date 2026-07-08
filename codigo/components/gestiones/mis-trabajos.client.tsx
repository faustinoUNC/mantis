"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icono } from "@/components/ui/iconos";
import { Input } from "@/components/ui/input";
import type { GestionResumen } from "@/features/gestiones/types";
import { cn } from "@/shared/utils/cn";
import { coincideTexto } from "@/shared/utils/filtros";

const POR_PAGINA = 5;

// Sub-estado legible para las gestiones en seguimiento (sin acción del técnico).
function subEstado(g: GestionResumen): string {
  if (g.etapa === "presupuesto") return "Presupuesto enviado";
  if (g.etapa === "conformidad") return "Esperando aprobación";
  if (g.etapa === "facturacion_cobro") return "En facturación";
  if (g.etapa === "liquidacion_tecnico") return "En liquidación";
  return "En seguimiento";
}

function hace(fecha: string) {
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 60) return "hoy";
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

const urgentesPrimero = (a: GestionResumen, b: GestionResumen) =>
  Number(b.urgencia === "urgente") - Number(a.urgencia === "urgente");

// ── Cards ────────────────────────────────────────────────────────────

function TarjetaAccion({ g, cta }: { g: GestionResumen; cta: string }) {
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
        <p className="font-semibold leading-snug mt-2.5">{g.descripcion}</p>
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

function TarjetaSeguimiento({ g }: { g: GestionResumen }) {
  return (
    <Link href={`/gestiones/${g.id}`} className="block group">
      <Card
        className={cn(
          "p-3.5 flex items-center gap-3 transition-all duration-150 group-hover:border-border-strong group-active:scale-[0.985]",
          g.urgencia === "urgente" && "border-l-2 border-l-urgente"
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug truncate">
            {g.descripcion}
          </p>
          <p className="flex items-center gap-1 text-[13px] text-muted mt-0.5">
            <Icono id="pin" size={12} />
            <span className="truncate">
              {g.direccion} · {g.especialidad}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {/* El borde izquierdo ya señala la urgencia; el badge queda neutro
              (un acento = un significado: ámbar = urgente, no sub-estado). */}
          <Badge tono="neutro">{subEstado(g)}</Badge>
          <span className="font-mono text-[11px] text-muted">
            {hace(g.creado_en)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

// ── Sección por grupo, con paginación mobile ("Mostrar más") ──────────

function GrupoTareas({
  titulo,
  cta,
  gestiones,
  acento,
}: {
  titulo: string;
  cta: string | null;
  gestiones: GestionResumen[];
  acento: boolean;
}) {
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const restantes = gestiones.length - visibles;

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <h2
          className={cn(
            "text-[13px] font-semibold tracking-wide uppercase",
            acento ? "text-foreground" : "text-muted"
          )}
        >
          {titulo}
        </h2>
        <span
          className={cn(
            "font-mono text-[11px] min-w-5 h-5 px-1.5 rounded-pill inline-flex items-center justify-center border",
            acento
              ? "bg-brand-soft border-brand-soft-border text-brand-active"
              : "bg-surface-2 border-border text-muted"
          )}
        >
          {gestiones.length}
        </span>
      </div>
      <div className={cn("stagger flex flex-col", cta ? "gap-3" : "gap-2.5")}>
        {gestiones.slice(0, visibles).map((g) =>
          cta ? (
            <TarjetaAccion key={g.id} g={g} cta={cta} />
          ) : (
            <TarjetaSeguimiento key={g.id} g={g} />
          )
        )}
      </div>
      {restantes > 0 && (
        <button
          type="button"
          onClick={() => setVisibles((v) => v + POR_PAGINA)}
          className="w-full min-h-tap mt-3 rounded-md border border-border-strong bg-surface text-sm font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
        >
          Mostrar más ({restantes})
        </button>
      )}
    </section>
  );
}

// ── Home ──────────────────────────────────────────────────────────────

export function MisTrabajos({
  gestiones,
  nombre,
}: {
  gestiones: GestionResumen[];
  nombre: string;
}) {
  const [consulta, setConsulta] = useState("");

  const activos = useMemo(
    () => gestiones.filter((g) => g.etapa !== "finalizado"),
    [gestiones]
  );

  const buscados = useMemo(
    () =>
      activos.filter((g) =>
        coincideTexto(consulta, g.descripcion, g.direccion, g.especialidad)
      ),
    [activos, consulta]
  );

  // Cada gestión cae en EXACTAMENTE un grupo (mutuamente excluyentes).
  const grupos = useMemo(() => {
    const b = {
      responder: [] as GestionResumen[],
      presupuestar: [] as GestionResumen[],
      obra: [] as GestionResumen[],
      corregir: [] as GestionResumen[],
      seguimiento: [] as GestionResumen[],
    };
    for (const g of buscados) {
      if (g.etapa === "asignacion" && g.asignacion_aceptada === null)
        b.responder.push(g);
      else if (g.etapa === "presupuesto" && !g.presupuesto_pendiente)
        b.presupuestar.push(g);
      else if (g.etapa === "en_ejecucion") b.obra.push(g);
      else if (g.etapa === "conformidad" && g.conformidad_rechazada)
        b.corregir.push(g);
      else b.seguimiento.push(g);
    }
    const defs: { id: string; titulo: string; cta: string | null; gestiones: GestionResumen[] }[] = [
      { id: "responder", titulo: "Por responder", cta: "Responder solicitud", gestiones: b.responder },
      { id: "presupuestar", titulo: "A presupuestar", cta: "Cargar presupuesto", gestiones: b.presupuestar },
      { id: "obra", titulo: "En obra", cta: "Registrar avance", gestiones: b.obra },
      { id: "corregir", titulo: "A corregir", cta: "Resubir conformidad", gestiones: b.corregir },
      { id: "seguimiento", titulo: "En seguimiento", cta: null, gestiones: b.seguimiento },
    ];
    for (const d of defs) d.gestiones.sort(urgentesPrimero);
    return defs.filter((d) => d.gestiones.length > 0);
  }, [buscados]);

  const accionables = grupos
    .filter((g) => g.cta)
    .reduce((n, g) => n + g.gestiones.length, 0);
  const urgentesAcc = grupos
    .filter((g) => g.cta)
    .reduce((n, g) => n + g.gestiones.filter((x) => x.urgencia === "urgente").length, 0);

  const fechaCruda = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fecha = fechaCruda.charAt(0).toUpperCase() + fechaCruda.slice(1);

  const resumen =
    accionables > 0
      ? `Tenés ${accionables === 1 ? "1 trabajo que te espera" : `${accionables} trabajos que te esperan`}${urgentesAcc > 0 ? ` — ${urgentesAcc === 1 ? "1 urgente" : `${urgentesAcc} urgentes`}` : ""}.`
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

      {activos.length === 0 ? (
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
      ) : (
        <>
          <div className="mt-5">
            <Input
              label="Buscar"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Dirección, descripción o especialidad…"
            />
          </div>

          {grupos.length === 0 ? (
            <Card className="p-8 mt-5 text-center">
              <p className="text-sm text-muted">Nada coincide con la búsqueda.</p>
            </Card>
          ) : (
            grupos.map((g) => (
              <GrupoTareas
                key={g.id}
                titulo={g.titulo}
                cta={g.cta}
                gestiones={g.gestiones}
                acento={g.cta !== null}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
