"use client";

import { useState } from "react";
import { EnvioDocumento } from "@/components/gestiones/envio-documento.client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  descargarDocumento,
  emitirNotaCobro,
  MEDIO_LIQUIDACION_LABEL,
  MEDIOS_LIQUIDACION,
  registrarCobro,
  registrarLiquidacion,
  type MedioLiquidacion,
} from "@/features/finanzas/service";
import type { GestionDetalle } from "@/features/gestiones/types";

function plata(n: number) {
  return `$ ${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
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
              <span>Total a facturar al {gestion.pagador ?? "pagador"}</span>
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

        <form
          className="flex flex-wrap items-end gap-3 pt-4 border-t border-border"
          onSubmit={(e) => {
            e.preventDefault();
            const medio = String(new FormData(e.currentTarget).get("medio")) as
              | "transferencia"
              | "efectivo"
              | "otro";
            correr("cobro", () => registrarCobro(gestion.id, medio));
          }}
        >
          <div className="min-w-44">
            <Select label="Medio de cobro" name="medio" defaultValue="transferencia">
              <option value="transferencia">Transferencia</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </Select>
          </div>
          <Button type="submit" disabled={cargando !== null}>
            {cargando === "cobro" ? "Registrando…" : "Registrar cobro → Liquidación"}
          </Button>
        </form>
        {error && <p className="text-sm font-medium text-error">{error}</p>}
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
    const liqTotal =
      rendido != null ? rendido + manoObra : Number(gestion.costo_final ?? 0);
    return (
      <div className="flex flex-col gap-4">
        <div className="max-w-md rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
          {rendido != null && (
            <>
              <div className="flex justify-between">
                <span className="text-muted">Materiales rendidos</span>
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
