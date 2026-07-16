"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  archivarGestion,
  asignarTecnico,
  avanzarEtapa,
  calificarTecnico,
  cancelarGestion,
  cancelarSolicitudAsignacion,
  avisarNoPuedoContinuar,
  resolverAvisoTecnico,
  desasignarTecnico,
  enviarPresupuesto,
  reasignarGestor,
  registrarAvance,
  resolverConformidad,
  resolverPresupuesto,
  responderAsignacion,
  subirConformidad,
} from "@/features/gestiones/service";
import {
  LABEL_EVENTO,
  detalleLegible,
  etiquetaEtapa,
} from "@/features/gestiones/eventos";
import type {
  GestionDetalle,
  Pagador,
  Presupuesto,
  TecnicoDisponible,
} from "@/features/gestiones/types";

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
        {gestion.contacto_cliente && (
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">
              {gestion.contacto_cliente.tipo === "inquilino" ? "Inquilino" : "Propietario"}
            </p>
            <p className="mt-0.5 text-[15px] font-medium truncate">
              {gestion.contacto_cliente.nombre}
            </p>
            {(gestion.contacto_cliente.telefono || gestion.contacto_cliente.email) && (
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13px] font-normal">
                {gestion.contacto_cliente.telefono && (
                  <a
                    href={`tel:${gestion.contacto_cliente.telefono}`}
                    className="text-brand hover:text-brand-hover"
                  >
                    {gestion.contacto_cliente.telefono}
                  </a>
                )}
                {gestion.contacto_cliente.email && (
                  <a
                    href={`mailto:${gestion.contacto_cliente.email}`}
                    className="truncate text-brand hover:text-brand-hover"
                  >
                    {gestion.contacto_cliente.email}
                  </a>
                )}
              </p>
            )}
          </div>
        )}
        <Dato label="Gestor">{gestion.gestor_nombre}</Dato>
        <Dato label="Técnico">{gestion.tecnico_nombre ?? "Sin asignar"}</Dato>
        {/* STORY-943: "Paga" recién existe cuando la inmobiliaria lo decidió
            en Presupuesto (con la inspección del técnico a la vista) */}
        <Dato label="Paga">
          {gestion.pagador
            ? gestion.pagador === "propietario" ? "Propietario" : "Inquilino"
            : <span className="text-muted font-normal">Se define al presupuestar</span>}
        </Dato>
        <Dato label={gestion.costo_final != null ? "Costo final" : "Creada"}>
          {gestion.costo_final != null ? (
            <span className="font-mono text-[14px]">{plata(gestion.costo_final)}</span>
          ) : (
            <span className="font-mono text-[13px] text-muted">{fechaHora(gestion.creado_en)}</span>
          )}
        </Dato>
        {/* STORY-977: visible para TODOS los roles (incl. el técnico) — es
            plata que ya recibió, se refleja en su propia gestión. */}
        {Boolean(gestion.adelanto_materiales) && (
          <Dato label="Adelanto de materiales">
            <span className="font-mono text-[14px]">{plata(gestion.adelanto_materiales!)}</span>
          </Dato>
        )}
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
  // STORY-966: mismo dato y mismo nombre que la card "Cumplimiento de plazo"
  // de Informes — "Desvío" a secas confundía (¿presupuesto o plazo?).
  const plazo =
    s?.desvioPlazoPct == null
      ? { valor: "s/d", tono: "neutro" as const }
      : {
          valor: `${s.desvioPlazoPct > 0 ? "+" : ""}${s.desvioPlazoPct}%`,
          tono: s.desvioPlazoPct > 10 ? ("alerta" as const) : ("bien" as const),
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
          <div className="min-w-0">
            <span className="font-medium truncate block">{tecnico.nombre}</span>
            {tecnico.especialidades.length > 0 && (
              <span className="text-[11px] text-muted truncate block">
                {tecnico.especialidades.join(" · ")}
              </span>
            )}
          </div>
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
          label="Presupuesto"
          valor={desvio.valor}
          ayuda="Cumplimiento de presupuesto (igual que en Informes): materiales que rindió vs. los que presupuestó, en $. Ej.: +20% = cada $100 presupuestados salieron $120. La mano de obra no entra (es fija)."
          tono={desvio.tono}
        />
        <ChipStat
          label="Plazo"
          valor={plazo.valor}
          ayuda="Cumplimiento de plazo (igual que en Informes): días reales de obra vs. el plazo que comprometió en el presupuesto. Ej.: +30% = una obra de 10 días le llevó 13."
          tono={plazo.tono}
          align="der"
        />
        <ChipStat
          label="Hechas"
          valor={s ? String(s.obrasRealizadas) : "0"}
          ayuda="Trabajos que ya finalizó (su experiencia acumulada). Las canceladas no cuentan."
          tono={s && s.obrasRealizadas > 0 ? "bien" : "neutro"}
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
          label="Abandonó"
          valor={s ? String(s.abandonos) : "0"}
          ayuda="Trabajos que dejó a mitad de camino (el gestor tuvo que desasignarlo y otro técnico rehízo la obra)."
          tono={s && s.abandonos > 0 ? "alerta" : "neutro"}
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
  const router = useRouter();

  if (rechazando) {
    return (
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const motivo = String(new FormData(e.currentTarget).get("motivo"));
          // Tras el rechazo esta gestión deja de ser visible para el técnico
          // (RLS): hay que salir del detalle antes de que se re-renderice.
          const ok = await correr(() => responderAsignacion(gestion.id, false, motivo));
          if (ok) router.push("/tecnico");
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
  // STORY-943: sin inspección registrada no hay presupuesto — el gestor
  // decide quién paga en base a lo que el técnico encontró.
  const hayInspeccion = gestion.avances.some((a) => a.tipo === "inspeccion");
  // El último presupuesto (vienen ordenados desc): si fue rechazado, el
  // técnico tiene que ver el motivo antes de armar el nuevo
  const ultimo = gestion.presupuestos[0];
  if (pendiente) {
    return <p className="text-sm text-muted">Presupuesto enviado — esperando al gestor.</p>;
  }
  if (!hayInspeccion) {
    return (
      <p className="text-sm text-muted">
        Registrá primero la inspección (arriba) — contá qué encontraste y, si
        podés, subí una foto. El presupuesto se habilita con eso.
      </p>
    );
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
          <Input label="Plazo de obra (días)" name="plazo_dias" type="number" min="1" required />
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
  // STORY-943: sin sugerido — el gestor elige explícitamente en base a la
  // inspección. "" = todavía no decidió (bloquea enviar y aprobar).
  const [pagador, setPagador] = useState<Pagador | "">(gestion.pagador ?? "");
  // Sin inquilino en la propiedad, la opción ni se ofrece
  const hayInquilino = Boolean(gestion.inquilino_nombre);
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
  // STORY-935: sin email enviado al pagador no se aprueba. Nunca degrada a
  // false: un envío local vale aunque el refresh vivo tarde en confirmarlo.
  const [mailEnviado, setMailEnviado] = useState(
    Boolean(gestion.presupuesto_enviado_en)
  );
  const [envioPrevio, setEnvioPrevio] = useState(gestion.presupuesto_enviado_en);
  if (envioPrevio !== gestion.presupuesto_enviado_en) {
    setEnvioPrevio(gestion.presupuesto_enviado_en);
    if (gestion.presupuesto_enviado_en) setMailEnviado(true);
  }
  const enviado = gestion.presupuestos.find((p) => p.estado === "enviado");
  const inspecciones = gestion.avances.filter((a) => a.tipo === "inspeccion");

  if (!enviado) {
    // STORY-966: el botón "Volver a Asignación" que vivía acá se unificó en la
    // card "Desasignar técnico" (abajo) — un solo camino, con motivo.
    return <p className="text-sm text-muted">Esperando presupuesto del técnico.</p>;
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
            <span>Total al {pagador || "pagador"}</span>
            <span className="font-mono">
              {plata(Number(enviado.monto_materiales) + Number(enviado.monto_mano_obra) + cargoAdmin)}
            </span>
          </div>
        </div>
      </div>

      {pagador ? (
        <EnvioDocumento
          etiqueta="presupuesto"
          destinatarioEtiqueta={pagador}
          generar={() => descargarPresupuestoPDF(gestion.id, { cargoAdmin, pagador })}
          enviar={() => enviarPresupuestoEmail(gestion.id, cargoAdmin, pagador)}
          yaEnviado={Boolean(gestion.presupuesto_enviado_en)}
          onEnviado={() => setMailEnviado(true)}
        />
      ) : (
        <p className="text-sm text-muted">
          Elegí quién paga la obra (abajo) para generar y enviar el presupuesto.
        </p>
      )}

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
            label="Paga"
            value={pagador}
            onChange={(e) => setPagador(e.target.value as Pagador | "")}
          >
            <option value="" disabled>
              Elegí quién paga…
            </option>
            <option value="propietario">Propietario</option>
            {hayInquilino && <option value="inquilino">Inquilino</option>}
          </Select>
          <Button
            disabled={cargando || !mailEnviado || !pagador}
            onClick={() =>
              correr(() =>
                resolverPresupuesto(enviado.id, gestion.id, true, {
                  pagador: pagador || undefined,
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
          {!pagador ? (
            <p className="w-full text-[12px] text-muted">
              Definí quién paga según lo que encontró el técnico en la
              inspección — sin eso no se envía ni se aprueba.
            </p>
          ) : !mailEnviado ? (
            <p className="w-full text-[12px] text-muted">
              Para aprobar, primero enviá el presupuesto al {pagador} por email
              — aprueba lo que recibió.
            </p>
          ) : null}
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
  // STORY-934/964/965: al TERMINAR la obra se rinde el total real gastado +
  // las fotos de los comprobantes (una por ticket). La resubida de una
  // rechazada no lo vuelve a pedir.
  const terminando = gestion.etapa === "en_ejecucion";

  // STORY-936: para terminar hace falta al menos una nota de avance.
  const sinAvance =
    terminando && !gestion.avances.some((a) => a.tipo === "avance");

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
      {terminando && (
        <>
          <p className="text-[13px] font-medium text-muted">
            Rendición de la obra{" "}
            <span className="text-muted/50 font-normal">· con esto se calcula tu liquidación</span>
          </p>
          <Input
            label="Total gastado en la obra ($) — todo lo que gastaste"
            name="materiales_total"
            type="number"
            min="0.01"
            step="0.01"
            required
          />
          {/* STORY-965: una foto por ticket — sin capture para que el celular
              deje elegir varias del rollo de la cámara */}
          <InputArchivo
            label="Fotos de los comprobantes — una por ticket (al menos una)"
            name="fotos_comprobantes"
            multiple
            required
          />
        </>
      )}
      <InputArchivo
        label="Foto de la conformidad firmada"
        name="foto"
        capture="environment"
        required
      />
      {sinAvance && (
        <p className="text-sm text-muted bg-surface-2/50 border border-border rounded-md px-3 py-2">
          Registrá al menos una nota de avance (arriba) antes de terminar la obra.
        </p>
      )}
      <Button type="submit" disabled={cargando || sinAvance} className="self-start">
        {terminando ? "Terminar y subir conformidad →" : "Resubir conformidad"}
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
  // STORY-934: el costo sugerido sale de la obra REAL — materiales rendidos
  // por el técnico + la mano de obra presupuestada. Así lo que paga el
  // pagador y lo que se liquida al técnico son el mismo número (+ el fee).
  const manoObra = aprobado ? Number(aprobado.monto_mano_obra) : 0;
  const matPresupuestados = aprobado ? Number(aprobado.monto_materiales) : 0;
  const rendido = gestion.materiales_total;
  // STORY-964: el costo final se calcula (no se edita) = total gastado en la
  // obra + mano de obra. El server recomputa lo mismo al aprobar.
  const baseMateriales = rendido != null ? rendido : matPresupuestados;
  const costoFinal = baseMateriales + manoObra;
  // "rendido" es todo lo gastado en la obra (materiales + mano de obra, lo
  // rinde el técnico como un solo total) — el desvío se compara contra el
  // presupuesto completo, no solo la parte de materiales.
  const presupuestoTotal = matPresupuestados + manoObra;
  const desvioMat = rendido != null ? rendido - presupuestoTotal : null;

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
      {/* Rendición (STORY-934/965): lo real vs lo presupuestado, con la
          galería de comprobantes (una foto por ticket) como evidencia */}
      {rendido != null && (
        <div className="max-w-md flex flex-col gap-2">
          <p className="text-[13px] font-medium text-muted">
            Rendición del técnico{" "}
            <span className="text-muted/50 font-normal">· comprobantes de lo gastado en la obra</span>
          </p>
          {gestion.materiales_fotos_urls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gestion.materiales_fotos_urls.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Comprobante ${i + 1}`}
                    className="rounded-md h-28 border border-border object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          <div className="rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted">Presupuesto total (materiales + mano de obra)</span>
              <span className="font-mono">{plata(presupuestoTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Gastado real en la obra</span>
              <span className="font-mono font-semibold">{plata(rendido)}</span>
            </div>
            {desvioMat != null && presupuestoTotal > 0 && (
              <div className="flex justify-between pt-1 border-t border-border">
                <span className="text-muted">Desvío sobre presupuesto</span>
                <span
                  className={`font-mono font-semibold ${
                    desvioMat > 0 ? "text-urgente-fuerte" : "text-brand"
                  }`}
                >
                  {desvioMat >= 0 ? "+" : "−"}{plata(Math.abs(desvioMat))} (
                  {desvioMat >= 0 ? "+" : "−"}
                  {Math.abs(Math.round((desvioMat / presupuestoTotal) * 100))}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {subida.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={subida.foto_url}
          alt="Conformidad firmada"
          className="rounded-md max-h-56 border border-border self-start"
        />
      )}
      {/* STORY-964: costo final calculado, no editable = total gastado en la
          obra + mano de obra. */}
      <div className="max-w-md rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
        <div className="flex justify-between">
          <span className="text-muted">
            {rendido != null ? "Total gastado en la obra (rendido)" : "Materiales presupuestados"}
          </span>
          <span className="font-mono">{plata(baseMateriales)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Mano de obra (presupuesto aprobado)</span>
          <span className="font-mono">{plata(manoObra)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-border font-semibold">
          <span>Costo final</span>
          <span className="font-mono">{plata(costoFinal)}</span>
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => resolverConformidad(subida.id, gestion.id, true, {}));
        }}
      >
        <Button type="submit" disabled={cargando}>
          Aprobar → Cobro
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
// STORY-967: post-aceptación del técnico admite un cargo opcional y libre —
// con cargo, la gestión pasa por Cobro y recién ahí cierra en cancelada.

function CancelarGestion({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [abierto, setAbierto] = useState(false);
  // El técnico aceptó = la gestión pasó de Asignación (ahí se ancla el cargo).
  const admiteCargo = ["presupuesto", "en_ejecucion", "conformidad"].includes(gestion.etapa);

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
          const form = new FormData(e.currentTarget);
          const motivo = String(form.get("motivo"));
          const cargo = admiteCargo ? Number(form.get("cargo") || 0) : 0;
          correr(() => cancelarGestion(gestion.id, motivo, cargo));
        }}
      >
        <p className="text-[13px] font-medium text-muted">
          Cancelar la gestión — queda registrada con su motivo (no se borra).
        </p>
        <Input label="Motivo de la cancelación" name="motivo" required placeholder="Por qué no continúa" />
        {admiteCargo && (
          <div className="max-w-xs">
            <Input
              label="Cargo por cancelación ($) — opcional"
              name="cargo"
              type="number"
              min="0"
              step="0.01"
              placeholder="0 = sin cargo"
            />
            <p className="mt-1 text-[12px] text-muted">
              Con cargo, la gestión pasa por Cobro (lo registra la administración) y
              recién ahí queda cancelada. Sin cargo, se cancela ahora.
            </p>
          </div>
        )}
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

// ── Desasignar técnico (STORY-966) — retroceso total a Asignación ──
// Un solo camino para reasignar/abandono: motivo obligatorio; si fue el
// técnico el que dejó el trabajo, queda imputado a él (métricas).

function DesasignarTecnico({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <Card className="p-4 mt-4 border-dashed">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">
            ¿{gestion.tecnico_nombre ?? "El técnico"} no puede seguir con la obra?
          </p>
          <Button variante="fantasma" onClick={() => setAbierto(true)}>
            Desasignar técnico
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
          const form = new FormData(e.currentTarget);
          correr(() =>
            desasignarTecnico(
              gestion.id,
              String(form.get("motivo")),
              form.get("abandono") === "on"
            )
          );
        }}
      >
        <p className="text-[13px] font-medium text-muted">
          La gestión vuelve a Asignación y el nuevo técnico hace su propia
          evaluación, presupuesto y rendición. El historial y las fotos de{" "}
          {gestion.tecnico_nombre ?? "el técnico saliente"} se conservan.
        </p>
        <Input label="Motivo de la desasignación" name="motivo" required placeholder="Por qué no sigue este técnico" />
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="abandono" className="mt-0.5 accent-[var(--color-brand)]" />
          <span>
            El técnico abandonó el trabajo
            <span className="block text-[12px] text-muted">
              Queda registrado en sus estadísticas (chip &quot;Abandonó&quot; e Informes).
            </span>
          </span>
        </label>
        <div className="flex gap-2">
          <Button type="submit" variante="secundario" disabled={cargando}>
            Confirmar desasignación
          </Button>
          <Button type="button" variante="fantasma" onClick={() => setAbierto(false)}>
            No desasignar
          </Button>
        </div>
        {error && <p className="text-sm font-medium text-error">{error}</p>}
      </form>
    </Card>
  );
}

// ── Aviso del técnico (STORY-971) — no cancela ni se desasigna solo: avisa ──

function AvisarNoContinua({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [abierto, setAbierto] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // STORY-976: el aviso quedó persistido en la gestión — recargar la página
  // ya no permite reenviarlo (antes "enviado" era solo estado local).
  if (enviado || gestion.aviso_no_continua_en) {
    return (
      <Card className="p-4 mt-4 border-dashed">
        <p className="text-[13px] text-muted">
          Le avisamos al gestor — va a definir cómo sigue el trabajo. Ante
          cualquier urgencia, contactá a la administración.
        </p>
      </Card>
    );
  }

  if (!abierto) {
    return (
      <Card className="p-4 mt-4 border-dashed">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted">
            ¿No podés continuar con este trabajo?
          </p>
          <Button variante="fantasma" onClick={() => setAbierto(true)}>
            Avisar al gestor
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mt-4 border-dashed">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const ok = await correr(() =>
            avisarNoPuedoContinuar(gestion.id, String(form.get("motivo")))
          );
          if (ok) setEnviado(true);
        }}
      >
        <p className="text-[13px] font-medium text-muted">
          El gestor recibe tu aviso con el motivo y decide cómo sigue la obra.
          El trabajo sigue asignado a vos hasta que lo resuelva.
        </p>
        <Input
          label="¿Por qué no podés continuar?"
          name="motivo"
          required
          placeholder="Contá brevemente el motivo"
        />
        <div className="flex gap-2">
          <Button type="submit" variante="secundario" disabled={cargando}>
            Enviar aviso
          </Button>
          <Button type="button" variante="fantasma" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
        </div>
        {error && <p className="text-sm font-medium text-error">{error}</p>}
      </form>
    </Card>
  );
}

// ── Aviso activo (STORY-976) — banner del gestor: la obra está en pausa ──

function AvisoNoContinuaBanner({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  // dd/mm/aaaa desde el ISO, determinístico (nada de toLocaleString en SSR —
  // lección STORY-973).
  const fecha = gestion.aviso_no_continua_en!.slice(0, 10).split("-").reverse().join("/");
  return (
    <Card className="p-4 mt-4 border-urgente-soft-border bg-urgente-soft" role="alert">
      <div className="flex items-start gap-2.5">
        <span className="size-2 mt-1.5 rounded-pill bg-urgente shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-urgente-fuerte">
            El técnico avisó que no puede continuar ({fecha})
          </p>
          {gestion.aviso_no_continua_motivo && (
            <p className="text-sm mt-1">“{gestion.aviso_no_continua_motivo}”</p>
          )}
          <p className="text-[13px] text-muted mt-2">
            La obra está en pausa para el técnico hasta que decidas cómo sigue:
            desasignalo para reasignar, cancelá la gestión (las dos opciones
            están más abajo) — o, si ya lo resolvieron, marcá que continúa.
          </p>
          <div className="flex items-center gap-3 mt-3">
            <Button
              variante="secundario"
              disabled={cargando}
              onClick={() => correr(() => resolverAvisoTecnico(gestion.id))}
            >
              El técnico continúa
            </Button>
            {error && <p className="text-sm font-medium text-error">{error}</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Archivar (STORY-935) — saca la finalizada del tablero; se ve en Archivo ──

function ArchivarGestion({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const archivada = Boolean(gestion.archivada_en);
  return (
    <Card className="p-4 mt-4 border-dashed">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {archivada
            ? "Archivada — no aparece en el tablero (está en Archivo)."
            : "¿Ya está todo al día? Archivala para despejar el tablero."}
        </p>
        <Button
          variante="fantasma"
          disabled={cargando}
          onClick={() => correr(() => archivarGestion(gestion.id, !archivada))}
        >
          {archivada ? "Desarchivar" : "Archivar gestión"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-error">{error}</p>}
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

type ItemActividad =
  | { clase: "etapa"; etapa: string; fecha: string }
  | { clase: "evento"; texto: string; detalle: string | null; actor: string | null; fecha: string; fotos?: string[] }
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
  // STORY-969: la evidencia de la rendición no desaparece al aprobar la
  // conformidad — el evento de rendición lleva la galería. Solo el MÁS
  // reciente: las fotos de la gestión son las de la última rendición (una
  // vieja de un técnico desasignado ya no las tiene).
  const ultimaRendicion = gestion.eventos
    .filter((e) => e.tipo === "materiales_rendidos")
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))[0];

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
        : // STORY-967: la cancelación con cargo pasa por Cobro — que el
          // historial diga por qué está ahí, no un "→ Cobro" mudo.
          e.tipo === "transicion" && e.detalle?.cancelacion
        ? {
            clase: "evento",
            texto: "Cancelación con cargo — pasó a Cobro",
            detalle: detalleLegible(e.detalle),
            actor: e.actor?.nombre ?? null,
            fecha: e.creado_en,
          }
        : // STORY-966: el retroceso a Asignación con técnico saliente es una
          // desasignación — se cuenta como evento con su motivo, no como un
          // simple cambio de etapa.
          e.tipo === "transicion" && e.a_etapa === "asignacion" && e.detalle?.tecnico_saliente
        ? {
            clase: "evento",
            texto: "Técnico desasignado — la gestión volvió a Asignación",
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
            ...(e === ultimaRendicion &&
              gestion.materiales_fotos_urls.length > 0 && {
                fotos: gestion.materiales_fotos_urls,
              }),
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
              {item.fotos && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.fotos.map((url, j) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Comprobante ${j + 1}`}
                        className="rounded-md h-24 border border-border object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
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
  // STORY-976: avisó que no puede continuar → la obra está en pausa para él
  // (las server actions también lo rechazan; esto es el espejo visual).
  const tecnicoEnPausa = esTecnicoAsignado && Boolean(gestion.aviso_no_continua_en);

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
      {/* STORY-968: si lo desasignan mientras mira el detalle, el UPDATE de
          gestiones no le llega (la fila salió de su alcance RLS). Su propia
          notificación sí: refresca, la gestión ya no está y la página lo
          devuelve a /tecnico. Solo técnico: al gestor le refrescaría el
          detalle por notificaciones de otras gestiones. */}
      {usuario.rol === "tecnico" && (
        <RefrescoVivo tabla="notificaciones" filtro={`usuario_id=eq.${usuario.id}`} />
      )}

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
        {/* STORY-967: en Cobro con cargo de cancelación, que se note que ya
            no es una obra — solo falta cobrar el cargo para cerrarla. */}
        {gestion.etapa === "facturacion_cobro" && gestion.cargo_cancelacion != null && (
          <Badge tono="urgente">Cancelación — cobro del cargo pendiente</Badge>
        )}
        {/* STORY-966: volvió a Asignación con técnico previo — reasignar YA. */}
        {gestion.etapa === "asignacion" && gestion.desasignada_en && (
          <Badge tono="urgente">Reasignar técnico</Badge>
        )}
        {/* STORY-976: aviso "no puedo continuar" activo — obra en pausa. */}
        {gestion.aviso_no_continua_en && (
          <Badge tono="urgente">Técnico no continúa</Badge>
        )}
        {gestion.urgencia === "urgente" && <Badge tono="urgente">Urgente</Badge>}
        <Badge tono="neutro">{gestion.especialidad}</Badge>
        {gestion.archivada_en && <Badge tono="neutro">Archivada</Badge>}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight leading-snug">
        {gestion.descripcion}
      </h1>

      {/* STORY-976: el aviso del técnico no puede depender de que el gestor
          baje hasta la Actividad — banner arriba de todo, con las salidas. */}
      {esGestorOwner && gestion.aviso_no_continua_en && (
        <AvisoNoContinuaBanner gestion={gestion} />
      )}

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
        {tecnicoEnPausa && (
          <p className="text-sm text-muted">
            Avisaste que no podés continuar — el trabajo está en pausa hasta que
            el gestor decida cómo sigue. Si al final podés continuar, avisale al
            gestor o a la administración.
          </p>
        )}
        {gestion.etapa === "presupuesto" && esTecnicoAsignado && !tecnicoEnPausa && (
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
                  Inspección <span className="text-muted/50 font-normal">· obligatoria antes de presupuestar</span>
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
        {gestion.etapa === "en_ejecucion" && esTecnicoAsignado && !tecnicoEnPausa && (
          <div className="flex flex-col gap-6">
            <FormAvance gestion={gestion} />
            <div className="border-t border-border pt-5">
              <AccionConformidadTecnico gestion={gestion} />
            </div>
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
        {gestion.etapa === "conformidad" && esTecnicoAsignado && !tecnicoEnPausa && (
          <AccionConformidadTecnico gestion={gestion} />
        )}
        {/* STORY-977 v1.1: única acción del administrativo en ejecución —
            cargar el adelanto de materiales (presupuesto ya aprobado en esta
            altura). Ya no aplica en conformidad. */}
        {gestion.etapa === "en_ejecucion" && esAdministrativo && (
          <div className="border-t border-border pt-5">
            <FinanzasAcciones gestion={gestion} />
          </div>
        )}
        {gestion.etapa === "conformidad" && esAdministrativo && (
          <p className="text-sm text-muted">
            Sin acciones para tu rol en esta etapa — interviene en Cobro, cuando se apruebe la conformidad.
          </p>
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
        {/* Gestor administrativo antes de Cobro: sin acciones todavía (en
            ejecución ya tiene el adelanto de materiales arriba; conformidad
            tiene su propio mensaje) */}
        {esAdministrativo && !esGestorOwner && !esTecnicoAsignado &&
          !["en_ejecucion", "conformidad", "facturacion_cobro", "liquidacion_tecnico", "finalizado"].includes(gestion.etapa) && (
            <p className="text-sm text-muted">
              Sin acciones para tu rol en esta etapa — interviene en Cobro, cuando se apruebe la conformidad.
            </p>
          )}
        {!esGestorOwner && !esTecnicoAsignado && !esAdministrativo && (
          <p className="text-sm text-muted">Solo lectura para tu rol.</p>
        )}
      </Card>
      </PresenciaGestion>

      {/* STORY-966: desasignar solo con técnico que ya aceptó (en asignación
          pendiente ya existe "Cancelar y elegir otro técnico"). */}
      {esGestorOwner &&
        gestion.tecnico_id &&
        gestion.asignacion_aceptada === true &&
        ["presupuesto", "en_ejecucion", "conformidad"].includes(gestion.etapa) && (
          <DesasignarTecnico gestion={gestion} />
        )}

      {esGestorOwner &&
        ["ingresado", "asignacion", "presupuesto", "en_ejecucion", "conformidad"].includes(
          gestion.etapa
        ) && <CancelarGestion gestion={gestion} />}

      {/* STORY-971: post-aceptación el técnico ya no puede Rechazar — este es
          su canal para avisar que no puede seguir (el gestor decide). */}
      {esTecnicoAsignado &&
        ["presupuesto", "en_ejecucion", "conformidad"].includes(gestion.etapa) && (
          <AvisarNoContinua gestion={gestion} />
        )}

      {(esGestorOwner || esAdministrativo) && gestion.etapa === "finalizado" && (
        <ArchivarGestion gestion={gestion} />
      )}

      {esAdmin && <ReasignarGestor gestion={gestion} gestores={gestores} />}

      <Actividad gestion={gestion} />
    </div>
  );
}
