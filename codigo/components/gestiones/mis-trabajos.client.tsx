"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icono } from "@/components/ui/iconos";
import { Input } from "@/components/ui/input";
import type { GestionResumen } from "@/features/gestiones/types";
import { cn } from "@/shared/utils/cn";
import { coincideTexto } from "@/shared/utils/filtros";

const POR_PAGINA = 5;

// Etapas del técnico — mutuamente excluyentes, en orden del funnel. Los estados
// de seguimiento (sin acción del técnico) van desglosados, no amontonados.
// La primera cuyo `match` da true es la etapa de la gestión.
type TipoEtapa = "accion" | "seguimiento";
interface DefEtapa {
  id: string;
  label: string;
  tipo: TipoEtapa;
  cta: string | null;
  match: (g: GestionResumen) => boolean;
}

const ETAPAS_TEC: DefEtapa[] = [
  { id: "responder", label: "Por responder", tipo: "accion", cta: "Responder solicitud",
    match: (g) => g.etapa === "asignacion" && g.asignacion_aceptada === null },
  { id: "presupuestar", label: "A presupuestar", tipo: "accion", cta: "Cargar presupuesto",
    match: (g) => g.etapa === "presupuesto" && !g.presupuesto_pendiente },
  { id: "obra", label: "En obra", tipo: "accion", cta: "Registrar avance",
    match: (g) => g.etapa === "en_ejecucion" },
  { id: "corregir", label: "A corregir", tipo: "accion", cta: "Resubir conformidad",
    match: (g) => g.etapa === "conformidad" && g.conformidad_rechazada },
  { id: "presup_enviado", label: "Presupuesto enviado", tipo: "seguimiento", cta: null,
    match: (g) => g.etapa === "presupuesto" && g.presupuesto_pendiente },
  { id: "esperando", label: "Esperando aprobación", tipo: "seguimiento", cta: null,
    match: (g) => g.etapa === "conformidad" },
  { id: "facturacion", label: "En facturación", tipo: "seguimiento", cta: null,
    match: (g) => g.etapa === "facturacion_cobro" },
  { id: "liquidacion", label: "En liquidación", tipo: "seguimiento", cta: null,
    match: (g) => g.etapa === "liquidacion_tecnico" },
  // Catch-all (p. ej. asignación ya respondida a la espera de avanzar): que nada desaparezca.
  { id: "otras", label: "Otras", tipo: "seguimiento", cta: null, match: () => true },
];

function etapaDe(g: GestionResumen): DefEtapa {
  return ETAPAS_TEC.find((e) => e.match(g))!;
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

function TarjetaSeguimiento({ g, estado }: { g: GestionResumen; estado: string }) {
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
          <Badge tono="neutro">{estado}</Badge>
          <span className="font-mono text-[11px] text-muted">
            {hace(g.creado_en)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

// ── Sección por etapa, con paginación mobile ("Mostrar más") ──────────

function SeccionEtapa({ def, gestiones }: { def: DefEtapa; gestiones: GestionResumen[] }) {
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const restantes = gestiones.length - visibles;
  const acento = def.tipo === "accion";

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn("size-2 rounded-pill shrink-0", acento ? "bg-brand" : "bg-border-strong")}
          aria-hidden
        />
        <h2
          className={cn(
            "text-[13px] font-semibold tracking-wide uppercase",
            acento ? "text-foreground" : "text-muted"
          )}
        >
          {def.label}
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
      <div className={cn("stagger flex flex-col", def.cta ? "gap-3" : "gap-2.5")}>
        {gestiones.slice(0, visibles).map((g) =>
          def.cta ? (
            <TarjetaAccion key={g.id} g={g} cta={def.cta} />
          ) : (
            <TarjetaSeguimiento key={g.id} g={g} estado={def.label} />
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

// ── Selector de etapa (campo + hoja desde abajo) ──────────────────────

function SelectorEtapa({
  opciones,
  valor,
  total,
  onElegir,
}: {
  opciones: { def: DefEtapa; cuenta: number }[];
  valor: string; // "todas" o id de etapa
  total: number;
  onElegir: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const activa = opciones.find((o) => o.def.id === valor);
  // El label sale de la lista estática (así se mantiene aunque la búsqueda deje
  // esa etapa en 0 y desaparezca de las opciones); el contador refleja el filtro.
  const etiqueta =
    valor === "todas" ? "Todas" : (ETAPAS_TEC.find((e) => e.id === valor)?.label ?? "Todas");
  const cuentaActiva = valor === "todas" ? total : (activa?.cuenta ?? 0);

  function elegir(id: string) {
    onElegir(id);
    setAbierto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full min-h-tap flex items-center gap-2 px-3.5 rounded-md border border-border-strong bg-surface text-left transition-colors hover:bg-surface-2"
      >
        <span className="text-[13px] font-medium text-muted">Etapa</span>
        <span className="font-semibold truncate">{etiqueta}</span>
        <span className="font-mono text-[12px] text-muted">({cuentaActiva})</span>
        <span className="ml-auto rotate-90 text-muted" aria-hidden>
          <Icono id="chevron" size={16} />
        </span>
      </button>

      {abierto &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setAbierto(false)}
              className="absolute inset-0 bg-black/40 animate-aparecer"
            />
            <div className="relative w-full max-w-lg mx-auto bg-surface rounded-t-xl border-t border-x border-border p-4 pb-6 max-h-[70vh] overflow-y-auto animate-subir">
              <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-border-strong" aria-hidden />
              <p className="text-[13px] font-medium text-muted mb-2">Elegí una etapa</p>
              <ul className="flex flex-col">
                <FilaEtapa
                  label="Todas"
                  cuenta={total}
                  punto={null}
                  activa={valor === "todas"}
                  onClick={() => elegir("todas")}
                />
                {opciones.map(({ def, cuenta }) => (
                  <FilaEtapa
                    key={def.id}
                    label={def.label}
                    cuenta={cuenta}
                    punto={def.tipo}
                    activa={valor === def.id}
                    onClick={() => elegir(def.id)}
                  />
                ))}
              </ul>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function FilaEtapa({
  label,
  cuenta,
  punto,
  activa,
  onClick,
}: {
  label: string;
  cuenta: number;
  punto: TipoEtapa | null;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={activa}
        className={cn(
          "w-full min-h-tap flex items-center gap-2.5 px-2 rounded-md transition-colors",
          activa ? "bg-brand-soft" : "hover:bg-surface-2"
        )}
      >
        {punto && (
          <span
            className={cn(
              "size-2 rounded-pill shrink-0",
              punto === "accion" ? "bg-brand" : "bg-border-strong"
            )}
            aria-hidden
          />
        )}
        <span className={cn("font-medium", !punto && "ml-[18px]", activa && "text-brand-active")}>
          {label}
        </span>
        <span className="ml-auto font-mono text-[12px] text-muted tabular-nums">{cuenta}</span>
      </button>
    </li>
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
  const [filtro, setFiltro] = useState("todas"); // "todas" o id de etapa

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

  // Reparte en etapas (una sola cada gestión) y arma las secciones con items.
  const secciones = useMemo(() => {
    const porEtapa = new Map<string, GestionResumen[]>();
    for (const g of buscados) {
      const def = etapaDe(g);
      (porEtapa.get(def.id) ?? porEtapa.set(def.id, []).get(def.id)!).push(g);
    }
    return ETAPAS_TEC.map((def) => ({ def, gestiones: porEtapa.get(def.id) ?? [] }))
      .filter((s) => s.gestiones.length > 0)
      .map((s) => ({ ...s, gestiones: [...s.gestiones].sort(urgentesPrimero) }));
  }, [buscados]);

  const opciones = secciones.map((s) => ({ def: s.def, cuenta: s.gestiones.length }));
  const visibles = filtro === "todas" ? secciones : secciones.filter((s) => s.def.id === filtro);

  const accionables = secciones
    .filter((s) => s.def.tipo === "accion")
    .reduce((n, s) => n + s.gestiones.length, 0);

  const fechaCruda = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fecha = fechaCruda.charAt(0).toUpperCase() + fechaCruda.slice(1);

  const resumen =
    accionables > 0
      ? `Tenés ${accionables === 1 ? "1 trabajo que requiere" : `${accionables} trabajos que requieren`} tu acción.`
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
          <div className="mt-5 flex flex-col gap-2.5">
            <SelectorEtapa
              opciones={opciones}
              valor={filtro}
              total={buscados.length}
              onElegir={setFiltro}
            />
            <Input
              label="Buscar"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Dirección, descripción o especialidad…"
            />
          </div>

          {visibles.length === 0 ? (
            <Card className="p-8 mt-5 text-center">
              <p className="text-sm text-muted">
                {secciones.length === 0
                  ? "Nada coincide con la búsqueda."
                  : "No hay gestiones en esta etapa."}
              </p>
            </Card>
          ) : (
            visibles.map((s) => (
              <SeccionEtapa key={s.def.id} def={s.def} gestiones={s.gestiones} />
            ))
          )}
        </>
      )}
    </div>
  );
}
