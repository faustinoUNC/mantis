"use client";

import { useState } from "react";
import { EnvioDocumento } from "@/components/gestiones/envio-documento.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  MEDIO_COBRO_LABEL,
  MEDIO_LIQUIDACION_LABEL,
  MEDIOS_COBRO,
  MEDIOS_LIQUIDACION,
  type MedioCobro,
  type MedioLiquidacion,
} from "@/features/finanzas/medios";
import {
  descargarDocumento,
  emitirNotaCobro,
  registrarCobro,
  registrarLiquidacion,
} from "@/features/finanzas/service";
import type { GestionDetalle } from "@/features/gestiones/types";

function plata(n: number) {
  return `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

// STORY-950: registrar el cobro con un solo medio (100%) o combinar 2 — el
// caso real de "mitad efectivo, mitad transferencia". Combinado: la
// administración tipea el monto de un medio y el otro se autocompleta con
// el resto; no deja escribir de más (el submit se bloquea si se pasa).
function FormCobro({
  total,
  cargando,
  error,
  onSubmit,
  // STORY-967: el cobro de una cancelación no va a Liquidación — el CTA no miente.
  cta = "Registrar cobro → Liquidación",
}: {
  total: number;
  cargando: string | null;
  error: string | null;
  onSubmit: (datos: { medio: MedioCobro; medio2?: MedioCobro; monto2?: number }) => void;
  cta?: string;
}) {
  const [combinado, setCombinado] = useState(false);
  const [medio, setMedio] = useState<MedioCobro>("transferencia");
  const [medio2, setMedio2] = useState<MedioCobro>("efectivo");
  const [monto2, setMonto2] = useState("");

  const monto2Num = Number(monto2) || 0;
  const monto1Num = Math.max(total - monto2Num, 0);
  const seExcede = combinado && monto2Num > 0 && monto2Num >= total;
  const mismoMedio = combinado && medio === medio2;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!combinado) return onSubmit({ medio });
    if (seExcede || mismoMedio || monto2Num <= 0) return;
    onSubmit({ medio, medio2, monto2: monto2Num });
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
                value={monto2}
                onChange={(e) => setMonto2(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
              />
            </div>
          </>
        )}

        <Button type="submit" disabled={cargando !== null || seExcede || mismoMedio}>
          {cargando === "cobro" ? "Registrando…" : cta}
        </Button>
      </div>

      {combinado && seExcede && (
        <p className="text-sm font-medium text-error">
          El monto del medio 2 no puede ser mayor o igual al total a cobrar ({plata(total)}).
        </p>
      )}
      {combinado && mismoMedio && !seExcede && (
        <p className="text-sm font-medium text-error">Elegí dos medios de pago distintos.</p>
      )}
      {error && <p className="text-sm font-medium text-error">{error}</p>}
    </form>
  );
}

export function FinanzasAcciones({
  gestion,
}: {
  gestion: GestionDetalle & {
    nota_emitida_en?: string | null;
    cargo_admin?: number | null;
  };
}) {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  // STORY-934: el fee quedó ANCLADO al aprobar el presupuesto — acá es solo
  // lectura (el pagador aprobó conociendo ese total; no se corrige a último
  // momento).
  const cargoAdmin = Number(gestion.cargo_admin ?? 0);

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
              <span>Cargo por cancelación a cobrar al {gestion.pagador ?? "responsable"}</span>
              <span className="font-mono">{plata(cargo)}</span>
            </div>
            <p className="text-[12px] text-muted">
              Al registrar el cobro, la gestión queda cancelada.
            </p>
          </div>
        </div>

        {/* STORY-972: el cargo también se respalda con la nota de cobro de
            siempre (vista previa + envío por mail al pagador). */}
        <EnvioDocumento
          etiqueta="nota de cobro"
          destinatarioEtiqueta={gestion.pagador ?? "pagador"}
          yaEnviado={Boolean(gestion.nota_emitida_en)}
          generar={() => descargarDocumento(gestion.id, "nota")}
          enviar={() => emitirNotaCobro(gestion.id)}
        />

        <FormCobro
          total={cargo}
          cargando={cargando}
          error={error}
          onSubmit={(datos) => correr("cobro", () => registrarCobro(gestion.id, datos))}
          cta="Registrar cobro → Cancelada"
        />
      </div>
    );
  }

  if (gestion.etapa === "facturacion_cobro") {
    const trabajo = Number(gestion.costo_final ?? 0);
    return (
      <div className="flex flex-col gap-5">
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
              <span>Total a cobrar al {gestion.pagador ?? "pagador"}</span>
              <span className="font-mono">{plata(trabajo + cargoAdmin)}</span>
            </div>
          </div>
        </div>

        <EnvioDocumento
          etiqueta="nota de cobro"
          destinatarioEtiqueta={gestion.pagador ?? "pagador"}
          yaEnviado={Boolean(gestion.nota_emitida_en)}
          generar={() => descargarDocumento(gestion.id, "nota")}
          enviar={() => emitirNotaCobro(gestion.id)}
        />

        <FormCobro
          total={trabajo + cargoAdmin}
          cargando={cargando}
          error={error}
          onSubmit={(datos) => correr("cobro", () => registrarCobro(gestion.id, datos))}
        />
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
    const liqTotal =
      rendido != null ? rendido + manoObra : Number(gestion.costo_final ?? 0);
    return (
      <div className="flex flex-col gap-4">
        <div className="max-w-md rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
          {rendido != null && (
            <>
              <div className="flex justify-between">
                <span className="text-muted">Total gastado en la obra (rendido)</span>
                <span className="font-mono">{plata(rendido)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Mano de obra (presupuesto aprobado)</span>
                <span className="font-mono">{plata(manoObra)}</span>
              </div>
            </>
          )}
          <div
            className={
              rendido != null
                ? "flex justify-between pt-1 border-t border-border font-semibold"
                : "flex justify-between font-semibold"
            }
          >
            <span>A liquidar al técnico</span>
            <span className="font-mono">{plata(liqTotal)}</span>
          </div>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const medio = String(
              new FormData(e.currentTarget).get("medio")
            ) as MedioLiquidacion;
            correr("liq", () => registrarLiquidacion(gestion.id, { medio }));
          }}
        >
          <div className="min-w-44">
            <Select label="Método de pago" name="medio" defaultValue="transferencia">
              {MEDIOS_LIQUIDACION.map((m) => (
                <option key={m} value={m}>
                  {MEDIO_LIQUIDACION_LABEL[m]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={cargando !== null}>
            {cargando === "liq" ? "Registrando…" : "Liquidar y finalizar →"}
          </Button>
          {error && <p className="text-sm font-medium text-error w-full">{error}</p>}
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
        etiqueta="comprobante de liquidación"
        generar={() => descargarDocumento(gestion.id, "comprobante")}
      />
    </div>
  );
}
