"use client";

import Link from "next/link";
import { useState } from "react";
import { EnvioDocumento } from "@/components/gestiones/envio-documento.client";
import { FinanzasAcciones } from "@/components/gestiones/finanzas.client";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { DIAS } from "@/features/tecnicos/types";

const LABEL_EVENTO: Record<string, string> = {
  creada: "Gestión creada",
  transicion: "Cambio de etapa",
  asignacion_solicitada: "Asignación enviada al técnico",
  asignacion_aceptada: "El técnico aceptó el trabajo",
  asignacion_rechazada: "El técnico rechazó la asignación",
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

function fechaHora(f: string) {
  return new Date(f).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function plata(n: number) {
  return `$ ${Number(n).toLocaleString("es-AR")}`;
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
      <p className="text-[12px] font-medium text-muted uppercase tracking-wide">
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

function AccionAsignar({
  gestion,
  tecnicos,
}: {
  gestion: GestionDetalle;
  tecnicos: TecnicoDisponible[];
}) {
  const { error, cargando, correr } = useAccion();
  const [elegido, setElegido] = useState(tecnicos[0]?.id ?? "");
  const tecnico = tecnicos.find((t) => t.id === elegido);

  if (gestion.tecnico_id && gestion.asignacion_aceptada === null) {
    return (
      <p className="text-sm text-muted">
        Esperando respuesta de{" "}
        <strong className="text-foreground">{gestion.tecnico_nombre}</strong>…
      </p>
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
    <div className="flex flex-col gap-3 max-w-md">
      <Select
        label="Técnico (según especialidad)"
        value={elegido}
        onChange={(e) => setElegido(e.target.value)}
      >
        {tecnicos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nombre}
          </option>
        ))}
      </Select>
      {tecnico && (
        <div className="text-[13px] text-muted bg-surface-2 rounded-md px-3 py-2">
          <span className="font-medium text-foreground">Disponibilidad: </span>
          {tecnico.franjas.length === 0
            ? "sin franjas cargadas"
            : tecnico.franjas
                .map((f) => `${DIAS[f.dia_semana]} ${f.hora_desde.slice(0, 5)}–${f.hora_hasta.slice(0, 5)}`)
                .join(" · ")}
        </div>
      )}
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
      <Textarea
        label="Trabajo a realizar"
        name="descripcion_trabajo"
        required
        placeholder="Qué vas a hacer, materiales principales y cómo lo vas a resolver"
      />
      <div className="grid grid-cols-3 gap-3">
        <Input label="Materiales ($)" name="materiales" type="number" min="0" step="0.01" required />
        <Input label="Mano de obra ($)" name="mano_obra" type="number" min="0" step="0.01" required />
        <Input label="Plazo (días)" name="plazo_dias" type="number" min="1" required />
      </div>
      <Input label="Observaciones" name="notas" placeholder="Aclaraciones para el gestor (opcional)" />
      <Button type="submit" disabled={cargando} className="self-start">
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
          <p className="text-[12px] font-medium text-muted uppercase tracking-wide">
            Trabajo a realizar
          </p>
          <p className="text-sm mt-1 leading-relaxed whitespace-pre-line">
            {presupuesto.descripcion_trabajo}
          </p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[12px] font-medium text-muted uppercase tracking-wide">Materiales</p>
          <p className="font-mono mt-0.5">{plata(presupuesto.monto_materiales)}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-muted uppercase tracking-wide">Mano de obra</p>
          <p className="font-mono mt-0.5">{plata(presupuesto.monto_mano_obra)}</p>
        </div>
        <div>
          <p className="text-[12px] font-medium text-muted uppercase tracking-wide">Total</p>
          <p className="font-mono mt-0.5 font-semibold">{plata(total)}</p>
        </div>
      </div>
      {(presupuesto.plazo_dias != null || presupuesto.notas) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {presupuesto.plazo_dias != null && (
            <div>
              <p className="text-[12px] font-medium text-muted uppercase tracking-wide">Plazo estimado</p>
              <p className="mt-0.5">{presupuesto.plazo_dias} día{presupuesto.plazo_dias === 1 ? "" : "s"}</p>
            </div>
          )}
          {presupuesto.notas && (
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-muted uppercase tracking-wide">Observaciones</p>
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
  const [pagador, setPagador] = useState<Pagador>(gestion.pagador_sugerido);
  const [rechazando, setRechazando] = useState(false);
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
          <p className="text-[12px] font-medium text-muted uppercase tracking-wide mb-1">
            Inspección del técnico
          </p>
          {inspecciones.map((i) => (
            <p key={i.id} className="text-sm leading-relaxed">{i.nota}</p>
          ))}
        </div>
      )}
      <FichaPresupuesto presupuesto={enviado} />

      <EnvioDocumento
        etiqueta="presupuesto"
        destinatarioEtiqueta={gestion.pagador ?? gestion.pagador_sugerido}
        generar={() => descargarPresupuestoPDF(gestion.id)}
        enviar={() => enviarPresupuestoEmail(gestion.id)}
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
            onClick={() => correr(() => resolverPresupuesto(enviado.id, gestion.id, true, { pagador }))}
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
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-muted">Foto (opcional)</label>
        <input
          type="file"
          name="foto"
          accept="image/*"
          capture="environment"
          className="text-sm text-muted file:mr-3 file:min-h-tap file:px-4 file:rounded-md file:border file:border-border-strong file:bg-surface file:text-sm file:font-medium file:text-foreground"
        />
      </div>
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
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-medium text-muted">
          Foto de la conformidad firmada
        </label>
        <input
          type="file"
          name="foto"
          accept="image/*"
          capture="environment"
          required
          className="text-sm text-muted file:mr-3 file:min-h-tap file:px-4 file:rounded-md file:border file:border-border-strong file:bg-surface file:text-sm file:font-medium file:text-foreground"
        />
      </div>
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

// ── Secciones informativas (encabezado uniforme) ──

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-2.5">
        {titulo}
      </h2>
      {children}
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

  const volver =
    usuario.rol === "tecnico"
      ? "/tecnico"
      : usuario.rol === "gestor_administrativo"
        ? "/administracion"
        : usuario.rol === "gestor_mantenimiento"
          ? "/gestion"
          : "/admin";

  return (
    <div className="animate-aparecer max-w-3xl">
      {/* Detalle 100% vivo: los avances/presupuestos/conformidades del
          técnico refrescan la pantalla del gestor apenas se registran */}
      <RefrescoVivo tabla="gestiones" />
      <RefrescoVivo tabla="avances" />
      <RefrescoVivo tabla="presupuestos" />
      <RefrescoVivo tabla="conformidades" />

      <div className="flex items-center justify-between gap-3">
        <Link href={volver} className="text-sm font-medium text-muted hover:text-foreground">
          ← Volver
        </Link>
        <span className="font-mono text-[11px] text-muted">
          N° {gestion.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tono="brand">{etiquetaEtapa(gestion.etapa)}</Badge>
        {gestion.urgencia === "urgente" && <Badge tono="urgente">Urgente</Badge>}
        <Badge tono="neutro">{gestion.especialidad}</Badge>
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight leading-snug">
        {gestion.descripcion}
      </h1>

      <DatosGestion gestion={gestion} />

      <Card className="p-5 mt-4 border-brand-soft-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="size-2 rounded-pill bg-brand" aria-hidden />
          <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-active">
            {etiquetaEtapa(gestion.etapa)} — acción
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
          <div className="flex flex-col gap-6">
            <FormAvance gestion={gestion} />
            <FormPresupuestoTecnico gestion={gestion} />
          </div>
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
        {gestion.etapa === "finalizado" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">Gestión finalizada — quedó en el legajo.</p>
            {esAdministrativo && <FinanzasAcciones gestion={gestion} />}
          </div>
        )}
        {!esGestorOwner && !esTecnicoAsignado && !esAdministrativo && (
          <p className="text-sm text-muted">Solo lectura para tu rol.</p>
        )}
      </Card>

      {esAdmin && <ReasignarGestor gestion={gestion} gestores={gestores} />}

      {gestion.presupuestos.length > 0 && gestion.etapa !== "presupuesto" && (
        <Seccion titulo="Presupuestos">
          <div className="flex flex-col gap-3">
            {gestion.presupuestos.map((p) => (
              <div key={p.id} className="relative">
                <FichaPresupuesto presupuesto={p} />
                <div className="absolute top-3 right-3">
                  <Badge tono={p.estado === "aprobado" ? "brand" : p.estado === "rechazado" ? "error" : "urgente"}>
                    {p.estado}
                  </Badge>
                </div>
                {p.motivo_rechazo && (
                  <p className="text-[13px] text-error mt-1 px-1">Motivo: {p.motivo_rechazo}</p>
                )}
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {gestion.avances.length > 0 && (
        <Seccion titulo="Avances del técnico">
          <Card className="divide-y divide-border">
            {gestion.avances.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed">
                    {a.tipo === "inspeccion" && (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-active mr-2">
                        Inspección
                      </span>
                    )}
                    {a.nota}
                  </p>
                  <span className="font-mono text-[11px] text-muted shrink-0 mt-0.5">
                    {fechaHora(a.creado_en)}
                  </span>
                </div>
                {a.foto_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.foto_url}
                    alt="Foto del avance"
                    className="mt-2 rounded-md max-h-48 border border-border"
                  />
                )}
              </div>
            ))}
          </Card>
        </Seccion>
      )}

      {gestion.conformidades.length > 0 && gestion.etapa !== "conformidad" && (
        <Seccion titulo="Conformidades">
          <Card className="divide-y divide-border">
            {gestion.conformidades.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  {c.foto_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.foto_url}
                      alt="Conformidad"
                      className="rounded-md max-h-40 border border-border"
                    />
                  )}
                  {c.motivo_rechazo && (
                    <p className="text-sm text-error mt-1">Motivo: {c.motivo_rechazo}</p>
                  )}
                </div>
                <Badge tono={c.estado === "aprobada" ? "brand" : c.estado === "rechazada" ? "error" : "urgente"}>
                  {c.estado}
                </Badge>
              </div>
            ))}
          </Card>
        </Seccion>
      )}

      <Seccion titulo="Historial">
        <Card className="divide-y divide-border">
          {gestion.eventos.map((e) => (
            <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <span>
                {LABEL_EVENTO[e.tipo] ?? e.tipo}
                {e.tipo === "transicion" && (
                  <span className="text-muted">
                    {" "}· {etiquetaEtapa(e.de_etapa)} → {etiquetaEtapa(e.a_etapa)}
                  </span>
                )}
                {e.detalle?.motivo != null && (
                  <span className="text-muted"> · {String(e.detalle.motivo)}</span>
                )}
              </span>
              <span className="font-mono text-[11px] text-muted shrink-0">
                {fechaHora(e.creado_en)}
              </span>
            </div>
          ))}
        </Card>
      </Seccion>
    </div>
  );
}
