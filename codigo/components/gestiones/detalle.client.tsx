"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FinanzasAcciones } from "@/components/gestiones/finanzas.client";
import { BotonGoogleMaps } from "@/components/ui/mapa";
import type { UsuarioActual } from "@/features/auth/types";
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
  conformidad_aprobada: "Conformidad aprobada",
  conformidad_rechazada: "Conformidad rechazada",
  gestor_reasignado: "Gestor reasignado",
};

function fechaHora(f: string) {
  return new Date(f).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
        Esperando respuesta de <strong className="text-foreground">{gestion.tecnico_nombre}</strong>…
      </p>
    );
  }

  if (tecnicos.length === 0) {
    return (
      <p className="text-sm text-muted">
        No hay técnicos activos de {gestion.especialidad}.{" "}
        <Link href="/tecnicos" className="text-brand font-medium">Ver técnicos</Link>
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
      <Button
        disabled={cargando}
        onClick={() => correr(() => responderAsignacion(gestion.id, true))}
      >
        Aceptar trabajo
      </Button>
      <Button variante="secundario" onClick={() => setRechazando(true)}>
        Rechazar
      </Button>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </div>
  );
}

function AccionPresupuestoTecnico({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const pendiente = gestion.presupuestos.some((p) => p.estado === "enviado");
  if (pendiente) {
    return <p className="text-sm text-muted">Presupuesto enviado — esperando al gestor.</p>;
  }
  return (
    <form
      className="grid gap-3 sm:grid-cols-3 max-w-xl items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        correr(() =>
          enviarPresupuesto(gestion.id, {
            monto_materiales: Number(f.get("materiales")),
            monto_mano_obra: Number(f.get("mano_obra")),
            notas: String(f.get("notas") ?? ""),
          })
        );
      }}
    >
      <Input label="Materiales ($)" name="materiales" type="number" min="0" step="0.01" required />
      <Input label="Mano de obra ($)" name="mano_obra" type="number" min="0" step="0.01" required />
      <Button type="submit" disabled={cargando}>
        Enviar presupuesto
      </Button>
      <div className="sm:col-span-3">
        <Input label="Notas" name="notas" placeholder="Detalle del trabajo (opcional)" />
      </div>
      {error && <p className="text-sm font-medium text-error sm:col-span-3">{error}</p>}
    </form>
  );
}

function AccionPresupuestoGestor({ gestion }: { gestion: GestionDetalle }) {
  const { error, cargando, correr } = useAccion();
  const [pagador, setPagador] = useState<Pagador>(gestion.pagador_sugerido);
  const [rechazando, setRechazando] = useState(false);
  const enviado = gestion.presupuestos.find((p) => p.estado === "enviado");

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

  if (rechazando) {
    return (
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
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label={`Paga (sugerido: ${gestion.pagador_sugerido} por ${LABEL_CAUSA[gestion.causa].toLowerCase()})`}
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
      {error && <p className="text-sm font-medium text-error w-full">{error}</p>}
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
      {error && <p className="text-sm font-medium text-error w-full">{error}</p>}
    </form>
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
    <Card className="p-4 mt-6 border-dashed">
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
      <Link href={volver} className="text-sm font-medium text-muted hover:text-foreground">
        ← Tablero
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge tono="brand">{etiquetaEtapa(gestion.etapa)}</Badge>
            {gestion.urgencia === "urgente" && <Badge tono="urgente">Urgente</Badge>}
            <Badge tono="neutro">{gestion.especialidad}</Badge>
          </div>
          <h1 className="text-xl font-semibold tracking-tight leading-snug">
            {gestion.descripcion}
          </h1>
          <p className="text-sm text-muted mt-1.5">
            {gestion.direccion} · Gestor: {gestion.gestor_nombre}
            {gestion.tecnico_nombre && ` · Técnico: ${gestion.tecnico_nombre}`}
            {gestion.pagador && ` · Paga: ${gestion.pagador}`}
            {gestion.costo_final != null && (
              <>
                {" · Costo final: "}
                <span className="font-mono text-[13px]">${gestion.costo_final}</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <BotonGoogleMaps direccion={gestion.direccion} />
      </div>

      {/* Acción según etapa + rol */}
      <Card className="p-5 mt-6">
        <p className="text-[13px] font-medium text-muted mb-3">Acción de esta etapa</p>
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
            <AccionPresupuestoTecnico gestion={gestion} />
          </div>
        )}
        {gestion.etapa === "presupuesto" && esGestorOwner && (
          <AccionPresupuestoGestor gestion={gestion} />
        )}
        {gestion.etapa === "en_ejecucion" && esTecnicoAsignado && (
          <div className="flex flex-col gap-6">
            <FormAvance gestion={gestion} />
            <AccionConformidadTecnico gestion={gestion} />
          </div>
        )}
        {gestion.etapa === "en_ejecucion" && esGestorOwner && (
          <p className="text-sm text-muted">El técnico está trabajando — mirá los avances abajo.</p>
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
        {/* Sin acción para este rol */}
        {!esGestorOwner && !esTecnicoAsignado && !esAdministrativo && (
          <p className="text-sm text-muted">Solo lectura para tu rol.</p>
        )}
      </Card>

      {esAdmin && <ReasignarGestor gestion={gestion} gestores={gestores} />}

      {/* Presupuestos */}
      {gestion.presupuestos.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium text-muted mb-2">Presupuestos</h2>
          <div className="flex flex-col gap-2">
            {gestion.presupuestos.map((p) => (
              <Card key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-mono">${Number(p.monto_materiales) + Number(p.monto_mano_obra)}</span>
                  <span className="text-muted"> (mat. ${p.monto_materiales} + m.o. ${p.monto_mano_obra})</span>
                  {p.notas && <p className="text-muted mt-0.5">{p.notas}</p>}
                  {p.motivo_rechazo && <p className="text-error mt-0.5">Rechazo: {p.motivo_rechazo}</p>}
                </div>
                <Badge tono={p.estado === "aprobado" ? "brand" : p.estado === "rechazado" ? "error" : "urgente"}>
                  {p.estado}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Avances */}
      {gestion.avances.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium text-muted mb-2">Avances del técnico</h2>
          <div className="flex flex-col gap-2">
            {gestion.avances.map((a) => (
              <Card key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm">{a.nota}</p>
                  <span className="font-mono text-[11px] text-muted shrink-0">
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
                {a.tipo === "inspeccion" && (
                  <Badge tono="neutro" className="mt-2">Inspección</Badge>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Conformidades */}
      {gestion.conformidades.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium text-muted mb-2">Conformidades</h2>
          <div className="flex flex-col gap-2">
            {gestion.conformidades.map((c) => (
              <Card key={c.id} className="px-4 py-3 flex items-center justify-between gap-3">
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
                    <p className="text-sm text-error mt-1">Rechazo: {c.motivo_rechazo}</p>
                  )}
                </div>
                <Badge tono={c.estado === "aprobada" ? "brand" : c.estado === "rechazada" ? "error" : "urgente"}>
                  {c.estado}
                </Badge>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className="mt-8">
        <h2 className="text-[13px] font-medium text-muted mb-2">Historial</h2>
        <Card className="divide-y divide-border">
          {gestion.eventos.map((e) => (
            <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <span>
                {LABEL_EVENTO[e.tipo] ?? e.tipo}
                {e.tipo === "transicion" && (
                  <span className="text-muted">
                    {" "}
                    · {etiquetaEtapa(e.de_etapa)} → {etiquetaEtapa(e.a_etapa)}
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
      </section>
    </div>
  );
}
