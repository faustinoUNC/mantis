"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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

function descargarBase64(base64: string, filename: string) {
  const enlace = document.createElement("a");
  enlace.href = `data:application/pdf;base64,${base64}`;
  enlace.download = filename;
  enlace.click();
}

export function FinanzasAcciones({ gestion }: { gestion: GestionDetalle & { nota_emitida_en?: string | null; cobrado_en?: string | null; liq_pagada_en?: string | null } }) {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [notaEmitida, setNotaEmitida] = useState(Boolean(gestion.nota_emitida_en));

  async function correr(clave: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setCargando(clave);
    const r = await fn();
    setCargando(null);
    if (!r.ok) setError(r.error ?? "Error");
    return r.ok;
  }

  async function descargar(tipo: "nota" | "comprobante") {
    setError(null);
    setCargando(`descargar-${tipo}`);
    const r = await descargarDocumento(gestion.id, tipo);
    setCargando(null);
    if (!r.ok) return setError(r.error);
    if (r.data) descargarBase64(r.data.base64, r.data.filename);
  }

  if (gestion.etapa === "facturacion_cobro") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {notaEmitida && <Badge tono="brand">Nota enviada al {gestion.pagador}</Badge>}
          <Button
            disabled={cargando !== null}
            variante={notaEmitida ? "secundario" : "primario"}
            onClick={async () => {
              const ok = await correr("emitir", () => emitirNotaCobro(gestion.id));
              if (ok) setNotaEmitida(true);
            }}
          >
            {cargando === "emitir"
              ? "Enviando…"
              : notaEmitida
                ? "Reenviar nota de cobro"
                : `Emitir y enviar nota al ${gestion.pagador ?? "pagador"}`}
          </Button>
          <Button variante="fantasma" disabled={cargando !== null} onClick={() => descargar("nota")}>
            {cargando === "descargar-nota" ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>

        <form
          className="flex flex-wrap items-end gap-3 pt-3 border-t border-border"
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

  // Finalizado: re-descarga de documentos
  return (
    <div className="flex flex-wrap gap-3">
      <Button variante="secundario" disabled={cargando !== null} onClick={() => descargar("nota")}>
        {cargando === "descargar-nota" ? "Generando…" : "Descargar nota de cobro"}
      </Button>
      <Button variante="secundario" disabled={cargando !== null} onClick={() => descargar("comprobante")}>
        {cargando === "descargar-comprobante" ? "Generando…" : "Descargar comprobante"}
      </Button>
      {error && <p className="text-sm font-medium text-error w-full">{error}</p>}
    </div>
  );
}
