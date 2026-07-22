"use client";

import Link from "next/link";
import { useState } from "react";
import { EnvioDocumento } from "@/components/gestiones/envio-documento.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputArchivo } from "@/components/ui/input-archivo.client";
import { Select } from "@/components/ui/select";
import {
  MEDIO_COBRO_LABEL,
  MEDIO_LIQUIDACION_LABEL,
  MEDIOS_COBRO,
  MEDIOS_LIQUIDACION,
  type MedioCobro,
} from "@/features/finanzas/medios";
import {
  claveDeuda,
  PARTE_COBRO_LABEL,
  repartoCompartido,
  type AmpliacionReparto,
  type CobroParcial,
  type ParteCobro,
} from "@/features/finanzas/consultas-types";
// STORY-1038: ampliaciones aprobadas del técnico actual con pagador propio —
// las que inciden en el reparto del cobro compartido (el costo_final las
// incluye). Mismo criterio que el server (ampliacionesRepartoDeGestion).
function ampliacionesReparto(
  gestion: import("@/features/gestiones/types").GestionDetalle
): AmpliacionReparto[] {
  return gestion.ampliaciones
    .filter(
      (a) =>
        a.estado === "aprobada" &&
        a.tecnico_id === gestion.tecnico_id &&
        a.pagador != null
    )
    .map((a) => ({
      monto: Number(a.monto),
      pagador: a.pagador as AmpliacionReparto["pagador"],
      pagadorPctInquilino: a.pagador_pct_inquilino,
    }));
}
import {
  descargarDocumento,
  emitirNotaCobro,
  registrarAdelantoMateriales,
  registrarCobro,
  registrarLiquidacion,
} from "@/features/finanzas/service";
import type { GestionDetalle } from "@/features/gestiones/types";
import { etiquetaPagador } from "@/features/gestiones/types";

function plata(n: number) {
  return `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

// STORY-975: formatea en vivo lo que se va tipeando (separador de miles),
// manteniendo el estado interno como dígitos crudos — mismo criterio simple
// que "plata()", sin librerías de máscara de input.
function formatearPesos(digitos: string) {
  return digitos ? Number(digitos).toLocaleString("es-AR") : "";
}

// STORY-950: registrar el cobro con un solo medio (100%) o combinar 2 — el
// caso real de "mitad efectivo, mitad transferencia". Combinado: la
// administración tipea el monto de un medio y el otro se autocompleta con
// el resto; no deja escribir de más (el submit se bloquea si se pasa).
function FormCobro({
  total,
  pagador,
  cargando,
  error,
  onSubmit,
  // STORY-967: el cobro de una cancelación no va a Liquidación — el CTA no miente.
  cta = "Registrar cobro → Liquidación",
}: {
  total: number;
  pagador?: string | null;
  cargando: string | null;
  error: string | null;
  onSubmit: (datos: {
    medio: MedioCobro;
    medio2?: MedioCobro;
    monto2?: number;
    recargoPct?: number;
  }) => void;
  cta?: string;
}) {
  const [combinado, setCombinado] = useState(false);
  const [medio, setMedio] = useState<MedioCobro>("transferencia");
  const [medio2, setMedio2] = useState<MedioCobro>("efectivo");
  const [monto2, setMonto2] = useState("");
  const [recargoPct, setRecargoPct] = useState("");

  const monto2Num = Number(monto2) || 0;
  const monto1Num = Math.max(total - monto2Num, 0);
  const seExcede = combinado && monto2Num > 0 && monto2Num >= total;
  const mismoMedio = combinado && medio === medio2;

  // STORY-975: recargo por tarjeta de crédito — lo tipea la administración
  // cada vez (varía según financiera/promo) y se calcula solo sobre la
  // porción efectivamente pagada con tarjeta, no sobre el total combinado.
  const montoTarjeta =
    medio === "tarjeta_credito"
      ? monto1Num
      : combinado && medio2 === "tarjeta_credito"
        ? monto2Num
        : 0;
  const hayTarjeta = montoTarjeta > 0;
  const recargoPctNum = Number(recargoPct) || 0;
  const recargoMonto = hayTarjeta ? Math.round(montoTarjeta * recargoPctNum) / 100 : 0;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mismoMedio) return;
    const recargo = hayTarjeta && recargoPctNum > 0 ? recargoPctNum : undefined;
    if (!combinado) return onSubmit({ medio, recargoPct: recargo });
    if (seExcede || monto2Num <= 0) return;
    onSubmit({ medio, medio2, monto2: monto2Num, recargoPct: recargo });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 pt-4 border-t border-border"
    >
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={combinado}
          onChange={(e) => {
            setCombinado(e.target.checked);
            setMonto2("");
          }}
          className="size-4 accent-(--color-brand)"
        />
        Pago combinado (dos medios)
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <Select
            label={combinado ? "Medio 1" : "Medio de cobro"}
            value={medio}
            onChange={(e) => setMedio(e.target.value as MedioCobro)}
          >
            {MEDIOS_COBRO.map((m) => (
              <option key={m} value={m}>
                {MEDIO_COBRO_LABEL[m]}
              </option>
            ))}
          </Select>
        </div>

        {combinado && (
          <>
            <div className="w-40">
              <Input label="Monto medio 1 (resto)" value={plata(monto1Num)} disabled readOnly />
            </div>
            <div className="min-w-44">
              <Select
                label="Medio 2"
                value={medio2}
                onChange={(e) => setMedio2(e.target.value as MedioCobro)}
              >
                {MEDIOS_COBRO.map((m) => (
                  <option key={m} value={m}>
                    {MEDIO_COBRO_LABEL[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Input
                label="Monto medio 2"
                inputMode="decimal"
                value={formatearPesos(monto2)}
                onChange={(e) => setMonto2(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
              />
            </div>
          </>
        )}

        {hayTarjeta && (
          <div className="w-32">
            <Input
              label="Recargo tarjeta (%)"
              inputMode="decimal"
              value={recargoPct}
              onChange={(e) => setRecargoPct(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={cargando !== null || seExcede || mismoMedio || (combinado && monto2Num <= 0)}
        >
          {cargando === "cobro" ? "Registrando…" : cta}
        </Button>
      </div>

      {hayTarjeta && recargoMonto > 0 && (
        <p className="text-sm text-muted">
          Recargo tarjeta: <span className="font-mono text-foreground">{plata(recargoMonto)}</span>
          {" — "}Total a cobrar al {etiquetaPagador(pagador) ?? "pagador"}:{" "}
          <span className="font-mono font-semibold text-foreground">{plata(total + recargoMonto)}</span>
        </p>
      )}
      {combinado && seExcede && (
        <p className="text-sm font-medium text-error">
          El monto del medio 2 no puede ser mayor o igual al total a cobrar ({plata(total)}).
        </p>
      )}
      {combinado && mismoMedio && !seExcede && (
        <p className="text-sm font-medium text-error">Elegí dos medios de pago distintos.</p>
      )}
      {combinado && !seExcede && !mismoMedio && monto2Num <= 0 && (
        <p className="text-sm font-medium text-error">Ingresá el monto del segundo medio.</p>
      )}
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </form>
  );
}

// STORY-977 v1.1: cada carga suma al total ya adelantado (permite más de un
// adelanto) y ya no hay tope contra el presupuesto. Antes de guardar, pide
// confirmación explícita del monto (mismo patrón de 2 pasos que "Rechazar").
// STORY-1002: muestra lo que el técnico presupuestó en materiales (la
// referencia para decidir cuánto adelantar) y exige el comprobante de la
// entrega (recibo firmado o transferencia) — el archivo se captura en estado
// al pasar al paso de confirmación porque el form se desmonta.
// STORY-1018: aviso ámbar (NUNCA bloqueo — el tope duro fue removido en la
// v1.1 por romper casos legítimos) cuando el acumulado supera el techo
// autorizado de materiales: presupuesto vigente + ampliaciones aprobadas del
// técnico actual. La fórmula lee el presupuesto vigente, así el límite
// acompaña solo la re-presupuestación tras una desasignación.
function AdelantoMateriales({ gestion }: { gestion: GestionDetalle }) {
  const [monto, setMonto] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const yaAdelantado = Number(gestion.adelanto_materiales ?? 0);
  const montoNum = Number(monto) || 0;
  const aprobado = [...gestion.presupuestos]
    .filter((p) => p.estado === "aprobado")
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))[0];
  const presupuestado = aprobado ? Number(aprobado.monto_materiales) : 0;
  // STORY-1018: la ampliación suma ENTERA al techo (no tiene split
  // materiales/mano de obra — decisión consciente, 15ª sesión). Solo las del
  // técnico actual (las de un saliente son historial, patrón STORY-983).
  const ampliadoAdelanto = gestion.ampliaciones
    .filter((a) => a.estado === "aprobada" && a.tecnico_id === gestion.tecnico_id)
    .reduce((s, a) => s + Number(a.monto), 0);
  const topeAdelanto = aprobado ? presupuestado + ampliadoAdelanto : null;
  const excedenteTope =
    topeAdelanto != null && yaAdelantado + montoNum > topeAdelanto
      ? yaAdelantado + montoNum - topeAdelanto
      : 0;

  async function confirmar() {
    setError(null);
    setCargando(true);
    const fd = new FormData();
    fd.set("monto", String(montoNum));
    if (comprobante) fd.set("comprobante", comprobante);
    const r = await registrarAdelantoMateriales(gestion.id, fd);
    setCargando(false);
    if (!r.ok) {
      setError(r.error ?? "Error");
      return;
    }
    setConfirmando(false);
    setMonto("");
    setComprobante(null);
  }

  if (confirmando) {
    return (
      <div className="flex flex-col gap-2">
        {excedenteTope > 0 && (
          <div
            className="max-w-md rounded-md border border-urgente-soft-border bg-urgente-soft px-4 py-3"
            role="alert"
          >
            <p className="text-sm font-semibold text-urgente-fuerte">
              Con este adelanto le habrás entregado{" "}
              {plata(yaAdelantado + montoNum)} — son {plata(excedenteTope)} más
              que los materiales autorizados ({plata(topeAdelanto ?? 0)}).
            </p>
            <p className="text-[13px] text-muted mt-1">
              Podés confirmarlo igual — el excedente queda registrado en el
              historial de la gestión.
            </p>
          </div>
        )}
        <p className="text-[13px] text-muted">
          Vas a cargar un adelanto de{" "}
          <span className="font-semibold">{plata(montoNum)}</span> con su
          comprobante ({comprobante?.name}). ¿Confirmás?
        </p>
        <div className="flex gap-3">
          <Button disabled={cargando} onClick={confirmar}>
            {cargando ? "Guardando…" : "Confirmar adelanto"}
          </Button>
          <Button
            type="button"
            variante="fantasma"
            disabled={cargando}
            onClick={() => setConfirmando(false)}
          >
            Cancelar
          </Button>
        </div>
        {error && <p className="text-sm font-medium text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] font-medium text-muted">
        Adelanto de materiales
        {yaAdelantado > 0 && (
          <span className="text-muted/50 font-normal"> · ya adelantado {plata(yaAdelantado)}</span>
        )}
      </p>
      {presupuestado > 0 && (
        <p className="text-[13px] text-muted">
          El técnico presupuestó{" "}
          <span className="font-semibold text-foreground">{plata(presupuestado)}</span>{" "}
          en materiales
          {/* STORY-1036: la referencia debe incluir las ampliaciones ya
              autorizadas — el techo del adelanto sube con ellas (topeAdelanto)
              y el texto mostraba solo el presupuesto original. */}
          {ampliadoAdelanto > 0 ? (
            <>
              {" "}+{" "}
              <span className="font-semibold text-foreground">{plata(ampliadoAdelanto)}</span>{" "}
              de ampliación autorizada ={" "}
              <span className="font-semibold text-foreground">{plata(topeAdelanto ?? presupuestado)}</span>.
            </>
          ) : (
            "."
          )}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (montoNum <= 0) {
            setError("Ingresá un monto válido.");
            return;
          }
          const archivo = new FormData(e.currentTarget).get("comprobante");
          if (!(archivo instanceof File) || archivo.size === 0) {
            setError("Adjuntá el comprobante del adelanto (recibo firmado o transferencia).");
            return;
          }
          setComprobante(archivo);
          setConfirmando(true);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="w-40">
          <Input
            label="Monto a adelantar ahora"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
          />
        </div>
        <InputArchivo
          label="Comprobante del adelanto"
          name="comprobante"
          accept="application/pdf,image/*"
        />
        <Button type="submit">Cargar adelanto</Button>
      </form>
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </div>
  );
}

// STORY-1036: cobro de un pago compartido — cada parte paga por separado y
// cuando efectivamente entró la plata. La parte ya cobrada muestra su
// constancia (fecha + medio, derivados en el server desde los eventos); la
// gestión avanza de etapa recién al registrar el SEGUNDO cobro.
function CobroPorPartes({
  gestion,
  total,
  cobrosParciales,
  cargando,
  error,
  correr,
  ctaFinal,
}: {
  gestion: GestionDetalle;
  total: number;
  cobrosParciales: CobroParcial[];
  cargando: string | null;
  error: string | null;
  correr: (
    clave: string,
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) => Promise<boolean>;
  ctaFinal: string;
}) {
  // Mismo redondeo que la nota y el server (1031/1038): el propietario absorbe
  // el resto — las dos partes suman exacto el total; las ampliaciones con
  // pagador propio se imputan a su pagador.
  const pct = gestion.pagador_pct_inquilino ?? 50;
  const { montoInquilino, montoPropietario } = repartoCompartido(
    total,
    pct,
    ampliacionesReparto(gestion)
  );
  const partes: { parte: ParteCobro; pct: number; monto: number }[] = [
    { parte: "inquilino", pct, monto: montoInquilino },
    { parte: "propietario", pct: 100 - pct, monto: montoPropietario },
  ];
  const cobradas = new Map(cobrosParciales.map((c) => [c.parte, c]));
  const faltaUna = cobradas.size === 1;
  return (
    <div className="flex flex-col gap-4">
      {partes.map(({ parte, pct: pctParte, monto }) => {
        const cobrada = cobradas.get(parte);
        return (
          <div key={parte} className="max-w-md rounded-md border border-border px-4 py-3">
            <div className="flex justify-between text-sm font-semibold">
              <span>
                Cobro del {PARTE_COBRO_LABEL[parte].toLowerCase()} ({pctParte}%)
              </span>
              <span className="font-mono">{plata(monto)}</span>
            </div>
            {cobrada ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-active">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Cobrado el {new Date(cobrada.fecha).toLocaleDateString("es-AR")} —{" "}
                {cobrada.medioLabel} ({plata(cobrada.monto)})
              </p>
            ) : (
              <FormCobro
                total={monto}
                pagador={parte}
                cargando={cargando}
                error={error}
                onSubmit={(datos) =>
                  correr("cobro", () => registrarCobro(gestion.id, { ...datos, parte }))
                }
                cta={
                  faltaUna
                    ? ctaFinal
                    : `Registrar cobro del ${PARTE_COBRO_LABEL[parte].toLowerCase()}`
                }
              />
            )}
          </div>
        );
      })}
      {!faltaUna && (
        <p className="max-w-md text-[13px] text-muted">
          La gestión avanza de etapa cuando las dos partes estén cobradas — cada
          cobro se registra cuando efectivamente se realizó.
        </p>
      )}
    </div>
  );
}

// STORY-1036: con pago compartido hay DOS notas de cobro (una por parte, cada
// una con su monto). "Enviar" manda las dos juntas — el gate de envío sigue
// siendo uno solo.
function NotasCobroCompartido({
  gestion,
}: {
  gestion: GestionDetalle & { nota_emitida_en?: string | null };
}) {
  return (
    <div className="flex flex-col gap-2">
      <EnvioDocumento
        etiqueta="nota del inquilino"
        etiquetaEnvio="las dos notas"
        destinatarioEtiqueta="inquilino y propietario"
        yaEnviado={Boolean(gestion.nota_emitida_en)}
        generar={() => descargarDocumento(gestion.id, "nota", "inquilino")}
        enviar={() => emitirNotaCobro(gestion.id)}
      />
      <EnvioDocumento
        etiqueta="nota del propietario"
        generar={() => descargarDocumento(gestion.id, "nota", "propietario")}
      />
    </div>
  );
}

export function FinanzasAcciones({
  gestion,
  deudasTecnico = [],
  cobrosParciales = [],
}: {
  gestion: GestionDetalle & {
    nota_emitida_en?: string | null;
    cargo_admin?: number | null;
  };
  // STORY-1019: adelantos "a resolver" del técnico (derivación de
  // features/finanzas, viene de la page — la más vieja primero, mismo orden
  // en que el server descuenta). STORY-1032: se pueden tildar para retener
  // de la liquidación; si la plata no alcanza el descuento es parcial.
  deudasTecnico?: import("@/features/finanzas/consultas-types").ItemAdelantoAResolver[];
  // STORY-1036: cobro compartido — partes ya cobradas (derivado en el server
  // desde los eventos; acá solo se muestra).
  cobrosParciales?: CobroParcial[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  // STORY-1032: claves de las deudas tildadas para descontar al liquidar.
  const [deudasElegidas, setDeudasElegidas] = useState<ReadonlySet<string>>(new Set());
  // STORY-934: el fee quedó ANCLADO al aprobar el presupuesto — acá es solo
  // lectura (el pagador aprobó conociendo ese total; no se corrige a último
  // momento).
  const cargoAdmin = Number(gestion.cargo_admin ?? 0);

  // STORY-977 v1.1: el adelanto solo se carga en ejecución (antes de que el
  // técnico rinda) — en conformidad ya no aplica.
  if (gestion.etapa === "en_ejecucion") {
    return <AdelantoMateriales gestion={gestion} />;
  }

  async function correr(
    clave: string,
    fn: () => Promise<{ ok: boolean; error?: string }>
  ) {
    setError(null);
    setCargando(clave);
    const r = await fn();
    setCargando(null);
    if (!r.ok) setError(r.error ?? "Error");
    return r.ok;
  }

  // STORY-967: cancelación con cargo — se cobra SOLO el cargo (sin nota de
  // cobro ni desglose trabajo+fee) y al registrar el cobro la gestión cierra
  // en cancelada (no pasa por liquidación: no hay técnico que liquidar).
  if (gestion.etapa === "facturacion_cobro" && gestion.cargo_cancelacion != null) {
    const cargo = Number(gestion.cargo_cancelacion);
    return (
      <div className="flex flex-col gap-5">
        <div className="max-w-md">
          <div className="rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
            <div className="flex justify-between font-semibold">
              <span>Cargo por cancelación a cobrar al {etiquetaPagador(gestion.pagador) ?? "responsable"}</span>
              <span className="font-mono">{plata(cargo)}</span>
            </div>
            <p className="text-[12px] text-muted">
              Al registrar el cobro, la gestión queda cancelada.
            </p>
          </div>
        </div>

        {/* STORY-972: el cargo también se respalda con la nota de cobro de
            siempre (vista previa + envío por mail al pagador). STORY-1036:
            con pago compartido, una nota y un cobro por parte. */}
        {gestion.pagador === "compartido" ? (
          <>
            <NotasCobroCompartido gestion={gestion} />
            <CobroPorPartes
              gestion={gestion}
              total={cargo}
              cobrosParciales={cobrosParciales}
              cargando={cargando}
              error={error}
              correr={correr}
              ctaFinal="Registrar cobro → Cancelada"
            />
          </>
        ) : (
          <>
            <EnvioDocumento
              etiqueta="nota de cobro"
              destinatarioEtiqueta={etiquetaPagador(gestion.pagador) ?? "pagador"}
              yaEnviado={Boolean(gestion.nota_emitida_en)}
              generar={() => descargarDocumento(gestion.id, "nota")}
              enviar={() => emitirNotaCobro(gestion.id)}
            />

            <FormCobro
              total={cargo}
              pagador={gestion.pagador}
              cargando={cargando}
              error={error}
              onSubmit={(datos) => correr("cobro", () => registrarCobro(gestion.id, datos))}
              cta="Registrar cobro → Cancelada"
            />
          </>
        )}
      </div>
    );
  }

  if (gestion.etapa === "facturacion_cobro") {
    const trabajo = Number(gestion.costo_final ?? 0);
    // STORY-1017: techo AUTORIZADO por el pagador = presupuesto aprobado +
    // ampliaciones que autorizó (solo las del técnico actual — las de un
    // saliente son historial, patrón STORY-983). Si la rendición lo superó,
    // AVISO ámbar antes de facturar — aviso, no candado (resolución 14ª
    // sesión: un permiso pedido después de gastar no cambia el desenlace).
    const aprobadoCobro = gestion.presupuestos.find((p) => p.estado === "aprobado");
    const ampliado = gestion.ampliaciones
      .filter((a) => a.estado === "aprobada" && a.tecnico_id === gestion.tecnico_id)
      .reduce((s, a) => s + Number(a.monto), 0);
    const autorizado = aprobadoCobro
      ? Number(aprobadoCobro.monto_materiales) +
        Number(aprobadoCobro.monto_mano_obra) +
        ampliado
      : null;
    const excedente = autorizado != null && trabajo > autorizado ? trabajo - autorizado : 0;
    return (
      <div className="flex flex-col gap-5">
        {excedente > 0 && (
          <div
            className="max-w-md rounded-md border border-urgente-soft-border bg-urgente-soft px-4 py-3"
            role="alert"
          >
            <p className="text-sm font-semibold text-urgente-fuerte">
              El costo de la obra ({plata(trabajo)}) supera lo autorizado por
              el pagador ({plata(autorizado ?? 0)}) en {plata(excedente)}.
            </p>
            <p className="text-[13px] text-muted mt-1">
              Confirmalo con el {etiquetaPagador(gestion.pagador) ?? "pagador"} antes de emitir
              la nota — es un aviso, no bloquea la facturación.
            </p>
          </div>
        )}
        {/* Composición de la nota: trabajo + fee anclado en el presupuesto */}
        <div className="max-w-md">
          <div className="rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted">Trabajo realizado</span>
              <span className="font-mono">{plata(trabajo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Gestión administrativa (anclada en el presupuesto)</span>
              <span className="font-mono">{plata(cargoAdmin)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border font-semibold">
              <span>Total a cobrar al {etiquetaPagador(gestion.pagador) ?? "pagador"}</span>
              <span className="font-mono">{plata(trabajo + cargoAdmin)}</span>
            </div>
            {/* STORY-1031: con pago compartido, el reparto a la vista del
                administrativo (mismo redondeo que la nota). STORY-1038: las
                ampliaciones con pagador propio se imputan a su pagador. */}
            {gestion.pagador === "compartido" && (() => {
              const { montoInquilino, montoPropietario } = repartoCompartido(
                trabajo + cargoAdmin,
                gestion.pagador_pct_inquilino ?? 50,
                ampliacionesReparto(gestion)
              );
              return (
                <div className="flex flex-col gap-0.5 text-[13px] text-muted">
                  <div className="flex justify-between">
                    <span>Inquilino ({gestion.pagador_pct_inquilino ?? 50}%)</span>
                    <span className="font-mono">{plata(montoInquilino)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Propietario ({100 - (gestion.pagador_pct_inquilino ?? 50)}%)</span>
                    <span className="font-mono">{plata(montoPropietario)}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* STORY-1036: compartido — una nota y un cobro por parte, cada uno
            cuando efectivamente entra la plata. */}
        {gestion.pagador === "compartido" ? (
          <>
            <NotasCobroCompartido gestion={gestion} />
            <CobroPorPartes
              gestion={gestion}
              total={trabajo + cargoAdmin}
              cobrosParciales={cobrosParciales}
              cargando={cargando}
              error={error}
              correr={correr}
              ctaFinal="Registrar cobro → Liquidación"
            />
          </>
        ) : (
          <>
            <EnvioDocumento
              etiqueta="nota de cobro"
              destinatarioEtiqueta={etiquetaPagador(gestion.pagador) ?? "pagador"}
              yaEnviado={Boolean(gestion.nota_emitida_en)}
              generar={() => descargarDocumento(gestion.id, "nota")}
              enviar={() => emitirNotaCobro(gestion.id)}
            />

            <FormCobro
              total={trabajo + cargoAdmin}
              pagador={gestion.pagador}
              cargando={cargando}
              error={error}
              onSubmit={(datos) => correr("cobro", () => registrarCobro(gestion.id, datos))}
            />
          </>
        )}
      </div>
    );
  }

  if (gestion.etapa === "liquidacion_tecnico") {
    // STORY-934/946: al técnico se le liquida lo que rindió en materiales +
    // su mano de obra presupuestada (fallback: costo_final, gestiones viejas
    // sin rendición). El monto ya no lo tipea la administración — lo calcula
    // el sistema; acá solo se confirma el medio de pago.
    const aprobado = gestion.presupuestos.find((p) => p.estado === "aprobado");
    const manoObra = aprobado ? Number(aprobado.monto_mano_obra) : 0;
    const rendido = gestion.materiales_total;
    // STORY-964: al técnico se le liquida el total real que rindió de la obra
    // + su mano de obra. Fallback: costo_final (gestiones viejas).
    const base = rendido != null ? rendido + manoObra : Number(gestion.costo_final ?? 0);
    // STORY-977: lo ya adelantado se resta — puede llegar a $0 sin bloquear el cierre.
    const adelanto = Number(gestion.adelanto_materiales ?? 0);
    const liqTotal = Math.max(base - adelanto, 0);
    // v1.1: si el adelanto superó lo debido, se lo muestra como sobrante.
    const sobrante = Math.max(adelanto - base, 0);
    // STORY-1032: espejo del cálculo del server — por cada deuda tildada se
    // retiene min(pendiente, lo que queda por liquidar), en el orden en que
    // vienen (la más vieja primero). El descuento puede ser parcial.
    const descuentos: {
      deuda: (typeof deudasTecnico)[number];
      clave: string;
      elegida: boolean;
      retenido: number;
    }[] = [];
    let restanteDeudas = liqTotal;
    for (const d of deudasTecnico) {
      const clave = claveDeuda(d);
      const elegida = deudasElegidas.has(clave);
      const retenido = elegida ? Math.min(d.monto, restanteDeudas) : 0;
      if (elegida) restanteDeudas -= retenido;
      descuentos.push({ deuda: d, clave, elegida, retenido });
    }
    const totalDescontado = descuentos.reduce((s, x) => s + x.retenido, 0);
    const aPagar = liqTotal - totalDescontado;
    const toggleDeuda = (clave: string) =>
      setDeudasElegidas((prev) => {
        const sig = new Set(prev);
        if (sig.has(clave)) sig.delete(clave);
        else sig.add(clave);
        return sig;
      });
    return (
      <div className="flex flex-col gap-4">
        {deudasTecnico.length > 0 && (
          <div
            className="max-w-md rounded-md border border-urgente-soft-border bg-urgente-soft px-4 py-3"
            role="alert"
          >
            <p className="text-sm font-semibold text-urgente-fuerte">
              {gestion.tecnico_nombre ?? "El técnico"} tiene{" "}
              {plata(deudasTecnico.reduce((s, d) => s + d.monto, 0))} en
              adelantos a resolver de otras gestiones.
            </p>
            <p className="text-[13px] text-muted mt-1">
              Tildá lo que quieras descontar de esta liquidación — queda
              saldado en su gestión de origen. Si la plata no alcanza, se
              retiene lo que entre y el resto sigue a resolver.
            </p>
            <div className="mt-2.5 flex flex-col gap-2">
              {descuentos.map(({ deuda: d, clave, elegida, retenido }) => (
                <div key={clave} className="flex flex-col gap-0.5">
                  <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={elegida}
                      disabled={liqTotal <= 0 || (!elegida && restanteDeudas <= 0)}
                      onChange={() => toggleDeuda(clave)}
                      className="size-4 mt-0.5 accent-(--color-brand)"
                    />
                    <span>
                      <span className="font-mono font-semibold">{plata(d.monto)}</span>{" "}
                      de{" "}
                      <Link
                        href={`/gestiones/${d.gestionId}`}
                        className="text-brand hover:text-brand-hover underline underline-offset-2"
                      >
                        «{d.descripcion}»
                      </Link>
                    </span>
                  </label>
                  {elegida && retenido < d.monto && (
                    <p className="pl-6 text-[12px] text-muted">
                      {retenido > 0
                        ? `Se retienen ${plata(retenido)} — quedan ${plata(d.monto - retenido)} a resolver.`
                        : "No queda plata en esta liquidación para retener."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="max-w-md rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
          {rendido != null && (
            <>
              <div className="flex justify-between">
                <span className="text-muted">Gastado en materiales (rendido)</span>
                <span className="font-mono">{plata(rendido)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Mano de obra (presupuesto aprobado)</span>
                <span className="font-mono">{plata(manoObra)}</span>
              </div>
            </>
          )}
          {adelanto > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Adelanto ya entregado</span>
              <span className="font-mono">− {plata(adelanto)}</span>
            </div>
          )}
          {totalDescontado > 0 && (
            <div className="flex justify-between">
              <span className="text-muted">Deudas de otras gestiones</span>
              <span className="font-mono">− {plata(totalDescontado)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t border-border font-semibold">
            <span>A liquidar al técnico</span>
            <span className="font-mono">{plata(aPagar)}</span>
          </div>
        </div>
        {sobrante > 0 && (
          <div className="max-w-md rounded-md border border-urgente-fuerte/30 bg-urgente-fuerte/5 px-4 py-3 text-sm text-urgente-fuerte">
            El adelanto superó lo debido al técnico por {plata(sobrante)} — quedará
            registrado como sobrante al liquidar.
          </div>
        )}
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            // STORY-1032: viajan solo las CLAVES de las deudas con retención
            // efectiva — los montos los re-deriva el server.
            for (const x of descuentos) {
              if (x.elegida && x.retenido > 0) formData.append("deuda", x.clave);
            }
            correr("liq", () => registrarLiquidacion(gestion.id, formData));
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-44">
              <Select label="Método de pago" name="medio" defaultValue="transferencia">
                {MEDIOS_LIQUIDACION.map((m) => (
                  <option key={m} value={m}>
                    {MEDIO_LIQUIDACION_LABEL[m]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {/* STORY-986: comprobante de pago real, opcional. Si se sube, se suma
              al email del técnico junto al detalle de la liquidación. */}
          <div className="max-w-md">
            <InputArchivo
              label="Comprobante de pago (opcional)"
              name="comprobante"
              accept="application/pdf,image/*"
            />
            <p className="mt-1.5 text-[13px] text-muted">
              Transferencia (PDF o imagen) o foto del recibo firmado. Si no
              adjuntás nada, al técnico le llega solo el detalle.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={cargando !== null}>
              {cargando === "liq" ? "Registrando…" : "Liquidar y finalizar →"}
            </Button>
            {error && <p className="text-sm font-medium text-error w-full">{error}</p>}
          </div>
        </form>
      </div>
    );
  }

  // Finalizado: ver/descargar los documentos emitidos
  return (
    <div className="flex flex-wrap gap-3">
      <EnvioDocumento
        etiqueta="nota de cobro"
        generar={() => descargarDocumento(gestion.id, "nota")}
      />
      <EnvioDocumento
        etiqueta="detalle de liquidación"
        generar={() => descargarDocumento(gestion.id, "detalle")}
      />
    </div>
  );
}
