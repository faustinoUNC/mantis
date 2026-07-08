"use client";

import Link from "next/link";
import { useState } from "react";
import { EnvioDocumento } from "@/components/gestiones/envio-documento.client";
import { EtapaStepper } from "@/components/gestiones/etapa-stepper.client";
import { PresenciaGestion } from "@/components/gestiones/presencia.client";
import { FinanzasAcciones } from "@/components/gestiones/finanzas.client";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputArchivo } from "@/components/ui/input-archivo.client";
import { urlGoogleMaps } from "@/components/ui/mapa";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { UsuarioActual } from "@/features/auth/types";
import {
  descargarPresupuestoPDF,
  enviarPresupuestoEmail,
} from "@/features/finanzas/service";
import {
  asignarTecnico,
  avanzarEtapa,
  calificarTecnico,
  cancelarGestion,
  cancelarSolicitudAsignacion,
  enviarPresupuesto,
  reasignarGestor,
  registrarAvance,
  resolverConformidad,
  resolverPresupuesto,
  responderAsignacion,
  subirConformidad,
} from "@/features/gestiones/service";
import type {
  GestionDetalle,
  Pagador,
  Presupuesto,
  TecnicoDisponible,
} from "@/features/gestiones/types";
import { ETAPAS, LABEL_CAUSA } from "@/features/gestiones/types";

const LABEL_EVENTO: Record<string, string> = {
  creada: "Gestión creada",
  transicion: "Cambio de etapa",
  asignacion_solicitada: "Asignación enviada al técnico",
  asignacion_aceptada: "El técnico aceptó el trabajo",
  asignacion_rechazada: "El técnico rechazó la asignación",
  asignacion_cancelada: "Solicitud de asignación cancelada por el gestor",
  presupuesto_enviado: "Presupuesto enviado",
  presupuesto_aprobado: "Presupuesto aprobado",
  presupuesto_rechazado: "Presupuesto rechazado",
  presupuesto_enviado_pagador: "Presupuesto enviado por email al pagador",
  conformidad_aprobada: "Conformidad aprobada",
  conformidad_rechazada: "Conformidad rechazada",
  gestor_reasignado: "Gestor reasignado",
  nota_cobro_enviada: "Nota de cobro enviada",
  cobro_registrado: "Cobro registrado",
  liquidacion_registrada: "Liquidación registrada",
};

// Formato manual determinístico: toLocaleString mete un espacio invisible
// (U+202F) distinto entre Node y el navegador → error de hidratación.
function fechaHora(f: string) {
  const d = new Date(f);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1}, ${hh}:${mi}`;
}

function plata(n: number) {
  return `$ ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

function etiquetaEtapa(id: string | null) {
  return ETAPAS.find((e) => e.id === id)?.label ?? id ?? "";
}

function useAccion() {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  async function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setCargando(true);
    const r = await fn();
    setCargando(false);
    if (!r.ok) setError(r.error ?? "Error");
    return r.ok;
  }
  return { error, cargando, correr };
}

// ── Datos de la gestión (grid estructurado — rediseño STORY-902) ──

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-muted">
        {label}
      </p>
      <div className="mt-0.5 text-[15px] font-medium truncate">{children}</div>
    </div>
  );
}

function DatosGestion({ gestion }: { gestion: GestionDetalle }) {
  return (
    <Card className="p-5 mt-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
        <Dato label="Propiedad">
          <a
            href={urlGoogleMaps(gestion.direccion)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-brand hover:text-brand-hover"
            title="Abrir en Google Maps"
          >
            <span className="truncate">{gestion.direccion}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </a>
        </Dato>
        <Dato label="Gestor">{gestion.gestor_nombre}</Dato>
        <Dato label="Técnico">{gestion.tecnico_nombre ?? "Sin asignar"}</Dato>
        <Dato label="Causa">{LABEL_CAUSA[gestion.causa]}</Dato>
        <Dato label="Paga">
          {gestion.pagador
            ? gestion.pagador === "propietario" ? "Propietario" : "Inquilino"
            : `${gestion.pagador_sugerido === "propietario" ? "Propietario" : "Inquilino"} (sugerido)`}
        </Dato>
        <Dato label={gestion.costo_final != null ? "Costo final" : "Creada"}>
          {gestion.costo_final != null ? (
            <span className="font-mono text-[14px]">{plata(gestion.costo_final)}</span>
          ) : (
            <span className="font-mono text-[13px] text-muted">{fechaHora(gestion.creado_en)}</span>
          )}
        </Dato>
      </div>
    </Card>
  );
}

// ── Bloques de acción por etapa ──

function AccionIngresado({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  return (
    <div>
      <Button
        disabled={cargando}
        onClick={() => correr(() => avanzarEtapa(gestion.id, "asignacion"))}
      >
        Pasar a Asignación →
      </Button>
      {error && <p className="mt-2 text-sm font-medium text-error">{error}</p>}
    </div>
  );
}

// ── Scorecard del técnico (STORY-915): desempeño a golpe de vista ──

const INICIALES_DIA = ["D", "L", "M", "M", "J", "V", "S"];
const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
// Semana laboral: Lun→Sáb y el Domingo al final.
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];

function horariosPorDia(franjas: TecnicoDisponible["franjas"]) {
  const porDia = new Map<number, string[]>();
  for (const f of franjas) {
    const rango = `${f.hora_desde.slice(0, 5)}–${f.hora_hasta.slice(0, 5)}`;
    porDia.set(f.dia_semana, [...(porDia.get(f.dia_semana) ?? []), rango]);
  }
  return ORDEN_SEMANA.filter((d) => porDia.has(d)).map((d) => ({
    dia: DIAS_CORTO[d],
    rangos: (porDia.get(d) ?? []).sort(),
  }));
}

function TiraDias({ franjas }: { franjas: TecnicoDisponible["franjas"] }) {
  const dias = new Set(franjas.map((f) => f.dia_semana));
  if (dias.size === 0) {
    return <span className="text-[12px] text-muted">sin horarios</span>;
  }
  const horarios = horariosPorDia(franjas);
  return (
    <div className="group/dias relative shrink-0">
      <div className="flex gap-0.5 cursor-help">
        {INICIALES_DIA.map((ini, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-sm text-[9px] font-semibold flex items-center justify-center ${
              dias.has(i) ? "bg-brand text-white" : "bg-surface-2 text-muted/40"
            }`}
          >
            {ini}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute right-0 top-full z-20 mt-1.5 w-max rounded-md bg-foreground px-3 py-2 opacity-0 shadow-overlay transition-opacity duration-150 group-hover/dias:opacity-100">
        <p className="text-[10px] uppercase tracking-wide text-background/60 mb-1">
          Horarios de trabajo
        </p>
        <ul className="flex flex-col gap-0.5">
          {horarios.map((h) => (
            <li key={h.dia} className="flex justify-between gap-4 text-[11px] text-background">
              <span className="font-semibold">{h.dia}</span>
              <span className="text-background/80 tabular-nums">{h.rangos.join(", ")}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChipStat({
  label,
  valor,
  ayuda,
  tono = "neutro",
  align = "izq",
}: {
  label: string;
  valor: string;
  ayuda: string;
  tono?: "neutro" | "alerta" | "bien";
  align?: "izq" | "der";
}) {
  const color =
    tono === "alerta"
      ? "text-urgente-fuerte"
      : tono === "bien"
        ? "text-brand"
        : "text-foreground";
  return (
    <div className="group/chip relative flex flex-col cursor-help" title={ayuda}>
      <span className="text-[10px] uppercase tracking-wide text-muted underline decoration-dotted decoration-muted/40 underline-offset-2">
        {label}
      </span>
      <span className={`text-[13px] font-semibold ${color}`}>{valor}</span>
      <span
        className={`pointer-events-none absolute bottom-full z-20 mb-1.5 w-44 rounded-md bg-foreground px-2.5 py-1.5 text-[11px] leading-snug text-background opacity-0 shadow-overlay transition-opacity duration-150 group-hover/chip:opacity-100 ${
          align === "der" ? "right-0" : "left-0"
        }`}
      >
        {ayuda}
      </span>
    </div>
  );
}

function ScorecardTecnico({
  tecnico,
  seleccionado,
  onSelect,
}: {
  tecnico: TecnicoDisponible;
  seleccionado: boolean;
  onSelect: () => void;
}) {
  const s = tecnico.stats;
  const desvio =
    s?.desvioPct == null
      ? { valor: "s/d", tono: "neutro" as const }
      : {
          valor: `${s.desvioPct > 0 ? "+" : ""}${s.desvioPct}%`,
          tono: s.desvioPct > 10 ? ("alerta" as const) : ("bien" as const),
        };
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-3 transition-all ${
        seleccionado
          ? "border-brand bg-brand-soft/40 ring-1 ring-brand"
          : "border-border hover:border-border-strong"
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              seleccionado ? "border-brand" : "border-border-strong"
            }`}
          >
            {seleccionado && <span className="size-2 rounded-full bg-brand" />}
          </span>
          <span className="font-medium truncate">{tecnico.nombre}</span>
        </div>
        <TiraDias franjas={tecnico.franjas} />
      </div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-2.5 pl-6">
        <ChipStat
          label="Calif."
          valor={s?.estrellas != null ? `${s.estrellas.toFixed(1)}★` : "s/d"}
          ayuda="Promedio de estrellas que le pusieron los gestores al terminar sus trabajos."
          tono={s?.estrellas != null && s.estrellas >= 4 ? "bien" : "neutro"}
        />
        <ChipStat
          label="Desvío"
          valor={desvio.valor}
          ayuda="Cuánto se desvió el costo final de lo que presupuestó. ~0% cumple; positivo = se pasó."
          tono={desvio.tono}
        />
        <ChipStat
          label="Hechas"
          valor={s ? String(s.obrasRealizadas) : "0"}
          ayuda="Trabajos que ya finalizó (su experiencia acumulada). Las canceladas no cuentan."
          tono={s && s.obrasRealizadas > 0 ? "bien" : "neutro"}
          align="der"
        />
        <ChipStat
          label="En curso"
          valor={s ? String(s.obrasActivas) : "0"}
          ayuda="Trabajos activos que tiene asignados ahora (su carga actual)."
          tono={s && s.obrasActivas >= 4 ? "alerta" : "neutro"}
        />
        <ChipStat
          label="Rechaza"
          valor={s?.pctRechazoAsig != null ? `${s.pctRechazoAsig}%` : "s/d"}
          ayuda="De las asignaciones que le mandaron, qué porcentaje rechazó."
          tono={s?.pctRechazoAsig != null && s.pctRechazoAsig >= 30 ? "alerta" : "neutro"}
        />
        <ChipStat
          label="Cancela"
          valor={s?.pctCancelacion != null ? `${s.pctCancelacion}%` : "s/d"}
          ayuda="De sus gestiones terminadas, qué porcentaje terminó cancelada."
          tono={s?.pctCancelacion != null && s.pctCancelacion >= 20 ? "alerta" : "neutro"}
          align="der"
        />
      </div>
    </button>
  );
}

function AccionAsignar({
  gestion,
  tecnicos,
}: {
  gestion: GestionDetalle;
  tecnicos: TecnicoDisponible[];
}) {
  const { error, cargando, correr } = useAccion();
  const [elegido, setElegido] = useState(tecnicos[0]?.id ?? "");

  if (gestion.tecnico_id && gestion.asignacion_aceptada === null) {
    // Salida si el técnico no responde: cancelar la solicitud y reelegir
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted">
          Esperando respuesta de{" "}
          <strong className="text-foreground">{gestion.tecnico_nombre}</strong>…
        </p>
        <Button
          variante="secundario"
          disabled={cargando}
          onClick={() => correr(() => cancelarSolicitudAsignacion(gestion.id))}
        >
          Cancelar y elegir otro técnico
        </Button>
        {error && <p className="w-full text-sm font-medium text-error">{error}</p>}
      </div>
    );
  }

  if (tecnicos.length === 0) {
    return (
      <p className="text-sm text-muted">
        No hay técnicos activos de {gestion.especialidad}.{" "}
        <Link href="/tecnicos" className="text-brand font-medium">
          Ver técnicos
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-muted">
        Elegí al técnico viendo su desempeño. <span className="font-medium">s/d</span> = sin
        datos suficientes.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {tecnicos.map((t) => (
          <ScorecardTecnico
            key={t.id}
            tecnico={t}
            seleccionado={elegido === t.id}
            onSelect={() => setElegido(t.id)}
          />
        ))}
      </div>
      <Button
        disabled={cargando || !elegido}
        onClick={() => correr(() => asignarTecnico(gestion.id, elegido))}
        className="self-start"
      >
        Enviar solicitud de asignación
      </Button>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </div>
  );
}

function AccionResponderAsignacion({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [rechazando, setRechazando] = useState(false);

  if (rechazando) {
    return (
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const motivo = String(new FormData(e.currentTarget).get("motivo"));
          correr(() => responderAsignacion(gestion.id, false, motivo));
        }}
      >
        <div className="flex-1 min-w-52">
          <Input label="Motivo" name="motivo" required placeholder="Por qué no podés tomarlo" />
        </div>
        <Button type="submit" disabled={cargando} variante="secundario">
          Confirmar rechazo
        </Button>
      </form>
    );
  }

  return (
    <div className="flex gap-3">
      <Button disabled={cargando} onClick={() => correr(() => responderAsignacion(gestion.id, true))}>
        Aceptar trabajo
      </Button>
      <Button variante="secundario" onClick={() => setRechazando(true)}>
        Rechazar
      </Button>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </div>
  );
}

// Formulario FORMAL de presupuesto del técnico (STORY-902): trabajo a
// realizar y plazo obligatorios — alimenta el PDF descargable/enviable.
function FormPresupuestoTecnico({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const pendiente = gestion.presupuestos.some((p) => p.estado === "enviado");
  // El último presupuesto (vienen ordenados desc): si fue rechazado, el
  // técnico tiene que ver el motivo antes de armar el nuevo
  const ultimo = gestion.presupuestos[0];
  if (pendiente) {
    return <p className="text-sm text-muted">Presupuesto enviado — esperando al gestor.</p>;
  }
  return (
    <form
      className="flex flex-col gap-4 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        correr(() =>
          enviarPresupuesto(gestion.id, {
            monto_materiales: Number(f.get("materiales")),
            monto_mano_obra: Number(f.get("mano_obra")),
            descripcion_trabajo: String(f.get("descripcion_trabajo") ?? ""),
            plazo_dias: Number(f.get("plazo_dias")),
            notas: String(f.get("notas") ?? ""),
          })
        );
      }}
    >
      {ultimo?.estado === "rechazado" && (
        <p className="text-sm text-error bg-error-soft border border-error-soft-border rounded-md px-3 py-2">
          Presupuesto rechazado
          {ultimo.motivo_rechazo ? `: ${ultimo.motivo_rechazo}` : ""} — enviá uno nuevo.
        </p>
      )}
      <Textarea
        label="Trabajo a realizar"
        name="descripcion_trabajo"
        required
        placeholder="Qué vas a hacer, materiales principales y cómo lo vas a resolver"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Input label="Materiales ($)" name="materiales" type="number" min="0" step="0.01" required />
        <Input label="Mano de obra ($)" name="mano_obra" type="number" min="0" step="0.01" required />
        <div className="col-span-2 sm:col-span-1">
          <Input label="Plazo (días)" name="plazo_dias" type="number" min="1" required />
        </div>
      </div>
      <Input label="Observaciones" name="notas" placeholder="Aclaraciones para el gestor (opcional)" />
      <Button type="submit" disabled={cargando} className="w-full sm:w-auto sm:self-start">
        Enviar presupuesto
      </Button>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </form>
  );
}

// Ficha completa del presupuesto — lo que el gestor lee al evaluar.
function FichaPresupuesto({ presupuesto }: { presupuesto: Presupuesto }) {
  const total = Number(presupuesto.monto_materiales) + Number(presupuesto.monto_mano_obra);
  return (
    <div className="rounded-md border border-border bg-surface-2/50 p-4 flex flex-col gap-3">
      {presupuesto.descripcion_trabajo && (
        <div>
          <p className="text-[13px] font-medium text-muted">
            Trabajo a realizar
          </p>
          <p className="text-sm mt-1 leading-relaxed whitespace-pre-line">
            {presupuesto.descripcion_trabajo}
          </p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[13px] font-medium text-muted">Materiales</p>
          <p className="font-mono mt-0.5">{plata(presupuesto.monto_materiales)}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-muted">Mano de obra</p>
          <p className="font-mono mt-0.5">{plata(presupuesto.monto_mano_obra)}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-muted">Total</p>
          <p className="font-mono mt-0.5 font-semibold">{plata(total)}</p>
        </div>
      </div>
      {(presupuesto.plazo_dias != null || presupuesto.notas) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {presupuesto.plazo_dias != null && (
            <div>
              <p className="text-[13px] font-medium text-muted">Plazo estimado</p>
              <p className="mt-0.5">{presupuesto.plazo_dias} día{presupuesto.plazo_dias === 1 ? "" : "s"}</p>
            </div>
          )}
          {presupuesto.notas && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-muted">Observaciones</p>
              <p className="mt-0.5 text-muted">{presupuesto.notas}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvaluacionPresupuesto({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [pagador, setPagador] = useState<Pagador>(
    gestion.pagador ?? gestion.pagador_sugerido
  );
  const [rechazando, setRechazando] = useState(false);
  const [cargoAdmin, setCargoAdmin] = useState<number>(
    Number(gestion.cargo_admin ?? 0)
  );
  // Resincronizar con lo que otro usuario dejó en la base (el refresh vivo
  // trae props nuevas pero React conserva el estado local). Ajuste durante
  // el render — patrón oficial, sin useEffect.
  const [cargoPrevio, setCargoPrevio] = useState(gestion.cargo_admin);
  if (cargoPrevio !== gestion.cargo_admin) {
    setCargoPrevio(gestion.cargo_admin);
    setCargoAdmin(Number(gestion.cargo_admin ?? 0));
  }
  const [pagadorPrevio, setPagadorPrevio] = useState(gestion.pagador);
  if (pagadorPrevio !== gestion.pagador) {
    setPagadorPrevio(gestion.pagador);
    if (gestion.pagador) setPagador(gestion.pagador);
  }
  const enviado = gestion.presupuestos.find((p) => p.estado === "enviado");
  const inspecciones = gestion.avances.filter((a) => a.tipo === "inspeccion");

  if (!enviado) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-muted">Esperando presupuesto del técnico.</p>
        <Button
          variante="secundario"
          disabled={cargando}
          onClick={() => correr(() => avanzarEtapa(gestion.id, "asignacion", { motivo: "reasignar" }))}
        >
          ← Volver a Asignación
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {inspecciones.length > 0 && (
        <div>
          <p className="text-[13px] font-medium text-muted mb-1">
            Inspección del técnico
          </p>
          {inspecciones.map((i) => (
            <p key={i.id} className="text-sm leading-relaxed">{i.nota}</p>
          ))}
        </div>
      )}
      <FichaPresupuesto presupuesto={enviado} />

      {/* El fee de la inmobiliaria se define ACÁ: el pagador aprueba
          conociendo el total real (pedido Fausti) */}
      <div className="max-w-md flex flex-col gap-3">
        <Input
          label="Gestión administrativa ($) — fee de la inmobiliaria"
          type="number"
          min="0"
          step="0.01"
          value={cargoAdmin || ""}
          placeholder="0"
          onChange={(e) => setCargoAdmin(Number(e.target.value) || 0)}
        />
        <div className="rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-muted">Presupuesto del técnico</span>
            <span className="font-mono">
              {plata(Number(enviado.monto_materiales) + Number(enviado.monto_mano_obra))}
            </span>
          </div>
          {cargoAdmin > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Gestión administrativa</span>
              <span className="font-mono">{plata(cargoAdmin)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-border font-semibold">
            {/* Mismo pagador que el Select de abajo: una sola verdad en pantalla */}
            <span>Total al {pagador}</span>
            <span className="font-mono">
              {plata(Number(enviado.monto_materiales) + Number(enviado.monto_mano_obra) + cargoAdmin)}
            </span>
          </div>
        </div>
      </div>

      <EnvioDocumento
        etiqueta="presupuesto"
        destinatarioEtiqueta={pagador}
        generar={() => descargarPresupuestoPDF(gestion.id, { cargoAdmin, pagador })}
        enviar={() => enviarPresupuestoEmail(gestion.id, cargoAdmin, pagador)}
      />

      {rechazando ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const motivo = String(new FormData(e.currentTarget).get("motivo"));
            correr(() => resolverPresupuesto(enviado.id, gestion.id, false, { motivo }));
          }}
        >
          <div className="flex-1 min-w-52">
            <Input label="Motivo del rechazo" name="motivo" required />
          </div>
          <Button type="submit" disabled={cargando} variante="secundario">
            Confirmar rechazo
          </Button>
          <Button type="button" variante="fantasma" onClick={() => setRechazando(false)}>
            Cancelar
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-border">
          <Select
            label={`Paga (sugerido: ${gestion.pagador_sugerido})`}
            value={pagador}
            onChange={(e) => setPagador(e.target.value as Pagador)}
          >
            <option value="propietario">Propietario</option>
            <option value="inquilino">Inquilino</option>
          </Select>
          <Button
            disabled={cargando}
            onClick={() =>
              correr(() =>
                resolverPresupuesto(enviado.id, gestion.id, true, {
                  pagador,
                  cargo_admin: cargoAdmin,
                })
              )
            }
          >
            Aprobar y ejecutar →
          </Button>
          <Button variante="secundario" onClick={() => setRechazando(true)}>
            Rechazar
          </Button>
        </div>
      )}
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </div>
  );
}

function FormAvance({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  return (
    <form
      className="flex flex-col gap-3 max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const ok = await correr(() => registrarAvance(gestion.id, new FormData(form)));
        if (ok) form.reset();
      }}
    >
      <Input
        label={gestion.etapa === "presupuesto" ? "Nota de inspección" : "Nota de avance"}
        name="nota"
        required
        placeholder="Qué hiciste / qué encontraste"
      />
      <InputArchivo label="Foto (opcional)" name="foto" capture="environment" />
      <Button type="submit" disabled={cargando} className="self-start">
        Registrar
      </Button>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </form>
  );
}

function AccionConformidadTecnico({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const ultima = gestion.conformidades[0];
  const esperando = ultima?.estado === "subida";

  if (esperando) {
    return <p className="text-sm text-muted">Conformidad subida — esperando revisión del gestor.</p>;
  }

  return (
    <form
      className="flex flex-col gap-3 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        correr(() => subirConformidad(gestion.id, new FormData(e.currentTarget)));
      }}
    >
      {ultima?.estado === "rechazada" && (
        <p className="text-sm text-error bg-error-soft border border-error-soft-border rounded-md px-3 py-2">
          Rechazada{ultima.motivo_rechazo ? `: ${ultima.motivo_rechazo}` : ""} — subí una nueva.
        </p>
      )}
      <InputArchivo
        label="Foto de la conformidad firmada"
        name="foto"
        capture="environment"
        required
      />
      <Button type="submit" disabled={cargando} className="self-start">
        {gestion.etapa === "en_ejecucion" ? "Terminar y subir conformidad →" : "Resubir conformidad"}
      </Button>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </form>
  );
}

function AccionConformidadGestor({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [rechazando, setRechazando] = useState(false);
  const subida = gestion.conformidades.find((c) => c.estado === "subida");
  const aprobado = gestion.presupuestos.find((p) => p.estado === "aprobado");
  const sugerido = aprobado
    ? Number(aprobado.monto_materiales) + Number(aprobado.monto_mano_obra)
    : 0;

  if (!subida) {
    return <p className="text-sm text-muted">Esperando que el técnico suba la conformidad.</p>;
  }

  if (rechazando) {
    return (
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const motivo = String(new FormData(e.currentTarget).get("motivo"));
          correr(() => resolverConformidad(subida.id, gestion.id, false, { motivo }));
        }}
      >
        <div className="flex-1 min-w-52">
          <Input label="Motivo (ilegible, incompleta…)" name="motivo" required />
        </div>
        <Button type="submit" disabled={cargando} variante="secundario">
          Confirmar rechazo
        </Button>
        <Button type="button" variante="fantasma" onClick={() => setRechazando(false)}>
          Cancelar
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {subida.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={subida.foto_url}
          alt="Conformidad firmada"
          className="rounded-md max-h-56 border border-border self-start"
        />
      )}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const costo = Number(new FormData(e.currentTarget).get("costo_final"));
          correr(() => resolverConformidad(subida.id, gestion.id, true, { costo_final: costo }));
        }}
      >
        <Input
          label="Costo final ($)"
          name="costo_final"
          type="number"
          min="0"
          step="0.01"
          defaultValue={sugerido || undefined}
          required
        />
        <Button type="submit" disabled={cargando}>
          Aprobar → Facturación
        </Button>
        <Button type="button" variante="secundario" onClick={() => setRechazando(true)}>
          Rechazar
        </Button>
      </form>
      {error && <p className="text-sm font-medium text-error w-full">{error}</p>}
    </div>
  );
}

// ── Calificación del técnico (STORY-914) — la carga el gestor al finalizar ──

function Estrellas({
  valor,
  onChange,
}: {
  valor: number;
  onChange?: (n: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          className={`text-3xl leading-none transition-colors ${
            n <= valor ? "text-urgente" : "text-border-strong"
          } ${onChange ? "cursor-pointer hover:text-urgente" : "cursor-default"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function CalificarTecnico({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");

  if (gestion.calificacion) {
    return (
      <div className="rounded-md border border-border bg-surface-2/50 px-4 py-3">
        <p className="text-[13px] font-medium text-muted mb-1.5">
          Calificación del técnico
        </p>
        <Estrellas valor={gestion.calificacion.estrellas} />
        {gestion.calificacion.comentario && (
          <p className="text-sm text-muted mt-1.5">{gestion.calificacion.comentario}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-brand-soft-border bg-brand-soft/40 px-4 py-4 flex flex-col gap-3">
      <div>
        <p className="text-[13px] font-semibold text-brand-active">
          ¿Cómo estuvo el técnico?
        </p>
        <p className="text-[12px] text-muted">
          Queda registrado para las métricas de calidad del equipo.
        </p>
      </div>
      <Estrellas valor={estrellas} onChange={setEstrellas} />
      <Textarea
        label="Comentario (opcional)"
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Puntualidad, prolijidad, trato…"
      />
      <Button
        disabled={cargando || estrellas === 0}
        onClick={() => correr(() => calificarTecnico(gestion.id, estrellas, comentario))}
        className="self-start"
      >
        Guardar calificación
      </Button>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </div>
  );
}

// ── Cancelar gestión (STORY-914) — estado terminal con motivo obligatorio ──

function CancelarGestion({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Card className="p-4 mt-4 border-dashed">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">¿Esta gestión no va a continuar?</p>
          <Button variante="fantasma" onClick={() => setAbierto(true)}>
            Cancelar gestión
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mt-4 border-dashed border-error-soft-border">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const motivo = String(new FormData(e.currentTarget).get("motivo"));
          correr(() => cancelarGestion(gestion.id, motivo));
        }}
      >
        <p className="text-[13px] font-medium text-muted">
          Cancelar la gestión — queda registrada con su motivo (no se borra).
        </p>
        <Input label="Motivo de la cancelación" name="motivo" required placeholder="Por qué no continúa" />
        <div className="flex gap-2">
          <Button type="submit" variante="secundario" disabled={cargando}>
            Confirmar cancelación
          </Button>
          <Button type="button" variante="fantasma" onClick={() => setAbierto(false)}>
            No cancelar
          </Button>
        </div>
        {error && <p className="text-sm font-medium text-error">{error}</p>}
      </form>
    </Card>
  );
}

function ReasignarGestor({
  gestion,
  gestores,
}: {
  gestion: GestionDetalle;
  gestores: { id: string; nombre: string }[];
}) {
  const { error, cargando, correr } = useAccion();
  const [nuevo, setNuevo] = useState("");
  const otros = gestores.filter((g) => g.id !== gestion.gestor_id);
  if (otros.length === 0) return null;
  return (
    <Card className="p-4 mt-4 border-dashed">
      <p className="text-[13px] font-medium text-muted mb-2">
        Reasignar gestor responsable (solo admin — el anterior deja de verla)
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52">
          <Select label="Nuevo gestor" value={nuevo} onChange={(e) => setNuevo(e.target.value)}>
            <option value="">Elegir…</option>
            {otros.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nombre}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variante="secundario"
          disabled={cargando || !nuevo}
          onClick={() => correr(() => reasignarGestor(gestion.id, nuevo))}
        >
          Reasignar
        </Button>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-error">{error}</p>}
    </Card>
  );
}

// ── Actividad: línea de tiempo única (STORY-905) ──
// Todo lo que pasó, en orden, en un solo lugar: cambios de etapa como
// separadores, notas del técnico con foto, decisiones con su motivo.

const SELLO_NOTA: Record<string, string> = {
  inspeccion: "Inspección",
  avance: "Avance de obra",
};

// Datos pertinentes del evento, legibles ("Técnico: X · Total: $ Y")
function detalleLegible(detalle: Record<string, unknown> | null): string | null {
  if (!detalle) return null;
  const plataD = (v: unknown) => `$ ${Number(v).toLocaleString("es-AR")}`;
  const partes: string[] = [];
  if (detalle.tecnico) partes.push(`Técnico: ${detalle.tecnico}`);
  if (detalle.nuevo_gestor) partes.push(`Nuevo gestor: ${detalle.nuevo_gestor}`);
  if (detalle.total != null) partes.push(`Total: ${plataD(detalle.total)}`);
  if (detalle.costo_final != null) partes.push(`Costo final: ${plataD(detalle.costo_final)}`);
  if (detalle.monto != null) partes.push(`Monto: ${plataD(detalle.monto)}`);
  if (detalle.plazo_dias != null) partes.push(`Plazo: ${detalle.plazo_dias} día${Number(detalle.plazo_dias) === 1 ? "" : "s"}`);
  if (detalle.pagador) partes.push(`Paga: ${detalle.pagador}`);
  if (detalle.medio) partes.push(`Medio: ${detalle.medio}`);
  if (detalle.factura_ref) partes.push(`Factura: ${detalle.factura_ref}`);
  if (detalle.para) partes.push(`Para: ${detalle.para}`);
  if (detalle.motivo && detalle.motivo !== "reasignar") partes.push(String(detalle.motivo));
  return partes.length ? partes.join(" · ") : null;
}

type ItemActividad =
  | { clase: "etapa"; etapa: string; fecha: string }
  | { clase: "evento"; texto: string; detalle: string | null; actor: string | null; fecha: string }
  | { clase: "nota"; sello: string; nota: string; foto: string | null; fecha: string }
  | { clase: "conformidad"; estado: string; motivo: string | null; foto: string | null; fecha: string };

function FechaItem({ fecha }: { fecha: string }) {
  return (
    <span className="font-mono text-[11px] text-muted shrink-0">
      {fechaHora(fecha)}
    </span>
  );
}

function Actividad({ gestion }: { gestion: GestionDetalle }) {
  const items: ItemActividad[] = [
    ...gestion.eventos.map((e): ItemActividad =>
      e.tipo === "transicion" && e.a_etapa === "cancelada"
        ? {
            clase: "evento",
            texto: "Gestión cancelada",
            detalle: detalleLegible(e.detalle),
            actor: e.actor?.nombre ?? null,
            fecha: e.creado_en,
          }
        : e.tipo === "transicion"
        ? { clase: "etapa", etapa: etiquetaEtapa(e.a_etapa), fecha: e.creado_en }
        : {
            clase: "evento",
            texto: LABEL_EVENTO[e.tipo] ?? e.tipo,
            detalle: detalleLegible(e.detalle),
            actor: e.actor?.nombre ?? null,
            fecha: e.creado_en,
          }
    ),
    ...gestion.avances.map((a): ItemActividad => ({
      clase: "nota",
      sello: SELLO_NOTA[a.tipo] ?? a.tipo,
      nota: a.nota,
      foto: a.foto_url,
      fecha: a.creado_en,
    })),
    ...gestion.conformidades.map((c): ItemActividad => ({
      clase: "conformidad",
      estado: c.estado,
      motivo: c.motivo_rechazo,
      foto: c.foto_url,
      fecha: c.creado_en,
    })),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <section className="mt-7">
      <h2 className="text-[15px] font-semibold tracking-tight mb-3">
        Actividad
      </h2>
      <ol className="relative flex flex-col gap-4 pl-5 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-border">
        {items.map((item, i) => {
          if (item.clase === "etapa") {
            return (
              <li key={i} className="relative">
                <span className="absolute -left-[19.5px] top-1 size-2.5 rounded-pill bg-brand ring-4 ring-background" aria-hidden />
                <div className="flex items-center gap-2">
                  <span className="rounded-pill border border-brand-soft-border bg-brand-soft px-2.5 py-0.5 text-[12px] font-semibold text-brand-active">
                    → {item.etapa}
                  </span>
                  <FechaItem fecha={item.fecha} />
                </div>
              </li>
            );
          }
          if (item.clase === "nota") {
            return (
              <li key={i} className="relative">
                <span className="absolute -left-[17.5px] top-1.5 size-1.5 rounded-pill bg-border-strong" aria-hidden />
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm leading-relaxed">
                    <span className="text-[12px] font-semibold text-brand-active mr-2">
                      {item.sello}
                    </span>
                    {item.nota}
                  </p>
                  <FechaItem fecha={item.fecha} />
                </div>
                {item.foto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.foto}
                    alt="Foto del registro"
                    className="mt-2 rounded-md max-h-44 border border-border"
                  />
                )}
              </li>
            );
          }
          if (item.clase === "conformidad") {
            return (
              <li key={i} className="relative">
                <span className="absolute -left-[17.5px] top-1.5 size-1.5 rounded-pill bg-border-strong" aria-hidden />
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm">
                    <span className="text-[12px] font-semibold text-brand-active mr-2">
                      Conformidad
                    </span>
                    {item.estado === "subida"
                      ? "Subida por el técnico"
                      : item.estado === "aprobada"
                        ? "Subida y aprobada"
                        : "Subida (luego rechazada)"}
                    {item.motivo && <span className="text-muted"> · {item.motivo}</span>}
                  </p>
                  <FechaItem fecha={item.fecha} />
                </div>
                {item.foto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.foto}
                    alt="Conformidad firmada"
                    className="mt-2 rounded-md max-h-44 border border-border"
                  />
                )}
              </li>
            );
          }
          return (
            <li key={i} className="relative">
              <span className="absolute -left-[17.5px] top-1.5 size-1.5 rounded-pill bg-border-strong" aria-hidden />
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    {item.texto}
                    {item.actor && (
                      <span className="text-muted text-[13px]"> — {item.actor}</span>
                    )}
                  </p>
                  {item.detalle && (
                    <p className="text-[13px] text-muted mt-0.5">{item.detalle}</p>
                  )}
                </div>
                <FechaItem fecha={item.fecha} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}


// ── Detalle ──

export function DetalleGestion({
  gestion,
  usuario,
  tecnicos,
  gestores,
}: {
  gestion: GestionDetalle;
  usuario: UsuarioActual;
  tecnicos: TecnicoDisponible[];
  gestores: { id: string; nombre: string }[];
}) {
  const esAdmin = usuario.rol === "administrador";
  const esGestorOwner =
    esAdmin || (usuario.rol === "gestor_mantenimiento" && gestion.gestor_id === usuario.id);
  const esAdministrativo = esAdmin || usuario.rol === "gestor_administrativo";
  const esTecnicoAsignado = usuario.rol === "tecnico" && gestion.tecnico_id === usuario.id;

  // STORY-916: se vuelve al lugar de origen (el tablero, de donde se abren las
  // gestiones), no al Inicio. El técnico vuelve a su home (su lista de trabajos).
  const volver = usuario.rol === "tecnico" ? "/tecnico" : "/tablero";

  return (
    <div className="animate-aparecer max-w-3xl">
      {/* Detalle 100% vivo: los avances/presupuestos/conformidades del
          técnico refrescan la pantalla del gestor apenas se registran.
          Filtrado a ESTA gestión: actividad ajena no refresca nada. */}
      <RefrescoVivo tabla="gestiones" filtro={`id=eq.${gestion.id}`} />
      <RefrescoVivo tabla="avances" filtro={`gestion_id=eq.${gestion.id}`} />
      <RefrescoVivo tabla="presupuestos" filtro={`gestion_id=eq.${gestion.id}`} />
      <RefrescoVivo tabla="conformidades" filtro={`gestion_id=eq.${gestion.id}`} />

      <div className="flex items-center justify-between gap-3">
        <Link href={volver} className="text-sm font-medium text-muted hover:text-foreground">
          ← Volver
        </Link>
        <span className="font-mono text-[11px] text-muted">
          N° {gestion.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {gestion.etapa === "cancelada" ? (
          <Badge tono="neutro">Cancelada</Badge>
        ) : (
          <Badge tono="brand">{etiquetaEtapa(gestion.etapa)}</Badge>
        )}
        {gestion.urgencia === "urgente" && <Badge tono="urgente">Urgente</Badge>}
        <Badge tono="neutro">{gestion.especialidad}</Badge>
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight leading-snug">
        {gestion.descripcion}
      </h1>

      {gestion.etapa !== "cancelada" && <EtapaStepper etapa={gestion.etapa} />}

      <DatosGestion gestion={gestion} />

      <PresenciaGestion
        gestionId={gestion.id}
        usuarioId={usuario.id}
        nombre={usuario.nombre}
      >
      <Card className="p-5 mt-4 border-brand-soft-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-2 rounded-pill bg-brand" aria-hidden />
          <p className="text-[13px] font-semibold text-brand-active">
            Acción · {etiquetaEtapa(gestion.etapa)}
          </p>
        </div>
        {gestion.etapa === "ingresado" && esGestorOwner && <AccionIngresado gestion={gestion} />}
        {gestion.etapa === "asignacion" && esGestorOwner && (
          <AccionAsignar gestion={gestion} tecnicos={tecnicos} />
        )}
        {gestion.etapa === "asignacion" && esTecnicoAsignado && gestion.asignacion_aceptada === null && (
          <AccionResponderAsignacion gestion={gestion} />
        )}
        {gestion.etapa === "presupuesto" && esTecnicoAsignado && (
          gestion.presupuestos.some((p) => p.estado === "enviado") ? (
            // Presupuesto enviado: al técnico solo le queda esperar al gestor
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                Presupuesto enviado — esperando la evaluación del gestor.
              </p>
              <FichaPresupuesto
                presupuesto={gestion.presupuestos.find((p) => p.estado === "enviado")!}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-[13px] font-medium text-muted mb-3">
                  Inspección <span className="text-muted/50 font-normal">· opcional</span>
                </p>
                <FormAvance gestion={gestion} />
              </div>
              <div className="border-t border-border pt-5">
                <p className="text-[13px] font-medium text-muted mb-3">Tu presupuesto</p>
                <FormPresupuestoTecnico gestion={gestion} />
              </div>
            </div>
          )
        )}
        {gestion.etapa === "presupuesto" && esGestorOwner && (
          <EvaluacionPresupuesto gestion={gestion} />
        )}
        {gestion.etapa === "en_ejecucion" && esTecnicoAsignado && (
          <div className="flex flex-col gap-6">
            <FormAvance gestion={gestion} />
            <AccionConformidadTecnico gestion={gestion} />
          </div>
        )}
        {gestion.etapa === "en_ejecucion" && esGestorOwner && (
          <p className="text-sm text-muted">
            El técnico está trabajando — los avances aparecen abajo apenas los registra.
          </p>
        )}
        {gestion.etapa === "conformidad" && esGestorOwner && (
          <AccionConformidadGestor gestion={gestion} />
        )}
        {gestion.etapa === "conformidad" && esTecnicoAsignado && (
          <AccionConformidadTecnico gestion={gestion} />
        )}
        {(gestion.etapa === "facturacion_cobro" || gestion.etapa === "liquidacion_tecnico") &&
          esAdministrativo && <FinanzasAcciones gestion={gestion} />}
        {(gestion.etapa === "facturacion_cobro" || gestion.etapa === "liquidacion_tecnico") &&
          !esAdministrativo && (esGestorOwner || esTecnicoAsignado) && (
            <p className="text-sm text-muted">
              En manos de la administración — cobro y liquidación se registran ahí.
            </p>
          )}
        {gestion.etapa === "finalizado" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">Gestión finalizada — quedó en el legajo.</p>
            {esGestorOwner && gestion.tecnico_id && <CalificarTecnico gestion={gestion} />}
            {esAdministrativo && <FinanzasAcciones gestion={gestion} />}
          </div>
        )}
        {gestion.etapa === "cancelada" && (
          <p className="text-sm text-muted">
            Gestión cancelada — el motivo quedó registrado en la actividad.
          </p>
        )}
        {/* Gestor administrativo antes de Facturación: sin acciones todavía */}
        {esAdministrativo && !esGestorOwner && !esTecnicoAsignado &&
          !["facturacion_cobro", "liquidacion_tecnico", "finalizado"].includes(gestion.etapa) && (
            <p className="text-sm text-muted">
              Sin acciones para tu rol en esta etapa — interviene en Facturación, cuando se apruebe la conformidad.
            </p>
          )}
        {!esGestorOwner && !esTecnicoAsignado && !esAdministrativo && (
          <p className="text-sm text-muted">Solo lectura para tu rol.</p>
        )}
      </Card>
      </PresenciaGestion>

      {esGestorOwner &&
        ["ingresado", "asignacion", "presupuesto", "en_ejecucion", "conformidad"].includes(
          gestion.etapa
        ) && <CancelarGestion gestion={gestion} />}

      {esAdmin && <ReasignarGestor gestion={gestion} gestores={gestores} />}

      <Actividad gestion={gestion} />
    </div>
  );
}
