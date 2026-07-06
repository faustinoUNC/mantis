"use client";

import { useState } from "react";
import { EnvioDocumento } from "@/components/gestiones/envio-documento.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  descargarDocumento,
  emitirNotaCobro,
  registrarCobro,
  registrarLiquidacion,
} from "@/features/finanzas/service";
import type { GestionDetalle } from "@/features/gestiones/types";

function plata(n: number) {
  return `$ ${n.toLocaleString("es-AR")}`;
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
  const [cargoAdmin, setCargoAdmin] = useState<number>(
    Number(gestion.cargo_admin ?? 0)
  );

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
        {/* Composición de la nota: trabajo + gestión administrativa */}
        <div className="max-w-md flex flex-col gap-3">
          <Input
            label="Gestión administrativa ($) — definido en el presupuesto, corregible acá"
            type="number"
            min="0"
            step="0.01"
            value={cargoAdmin || ""}
            placeholder="0"
            onChange={(e) => setCargoAdmin(Number(e.target.value) || 0)}
          />
          <div className="rounded-md border border-border bg-surface-2/50 px-4 py-3 text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted">Trabajo realizado</span>
              <span className="font-mono">{plata(trabajo)}</span>
            </div>
            {cargoAdmin > 0 && (
              <div className="flex justify-between">
                <span className="text-muted">Gestión administrativa</span>
                <span className="font-mono">{plata(cargoAdmin)}</span>
              </div>
            )}
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
          generar={() => descargarDocumento(gestion.id, "nota", { cargoAdmin })}
          enviar={() => emitirNotaCobro(gestion.id, cargoAdmin)}
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
    return (
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          correr("liq", () =>
            registrarLiquidacion(gestion.id, {
              monto: Number(f.get("monto")),
              factura_ref: String(f.get("factura_ref") ?? ""),
            })
          );
        }}
      >
        <Input
          label="Monto liquidado ($)"
          name="monto"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={gestion.costo_final ?? undefined}
        />
        <div className="min-w-52">
          <Input label="Ref. factura C del técnico" name="factura_ref" placeholder="Ej.: 0001-00001234" />
        </div>
        <Button type="submit" disabled={cargando !== null}>
          {cargando === "liq" ? "Registrando…" : "Liquidar y finalizar →"}
        </Button>
        {error && <p className="text-sm font-medium text-error w-full">{error}</p>}
      </form>
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
