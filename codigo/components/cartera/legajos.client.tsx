"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  abrirLegajo,
  cerrarLegajo,
  descargarResumenObras,
  enviarResumenObras,
} from "@/features/cartera/service";
import type { Legajo, Persona } from "@/features/cartera/types";

function fechaCorta(f: string) {
  return new Date(`${f}T00:00:00`).toLocaleDateString("es-AR");
}

// Resumen de obras del legajo: descargar PDF o enviarlo al propietario.
function ResumenObras({ legajoId }: { legajoId: string }) {
  const [estado, setEstado] = useState<string | null>(null);

  async function descargar() {
    setEstado("descargando");
    const r = await descargarResumenObras(legajoId);
    setEstado(r.ok ? null : r.error);
    if (r.ok && r.data) {
      const a = document.createElement("a");
      a.href = `data:application/pdf;base64,${r.data.base64}`;
      a.download = r.data.filename;
      a.click();
    }
  }

  async function enviar() {
    setEstado("enviando");
    const r = await enviarResumenObras(legajoId);
    setEstado(r.ok ? "enviado" : r.error);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variante="fantasma"
        className="min-h-0 h-8 px-2.5 text-sm"
        disabled={estado === "descargando" || estado === "enviando"}
        onClick={descargar}
      >
        {estado === "descargando" ? "Generando…" : "Resumen de obras (PDF)"}
      </Button>
      <Button
        type="button"
        variante="fantasma"
        className="min-h-0 h-8 px-2.5 text-sm"
        disabled={estado === "descargando" || estado === "enviando"}
        onClick={enviar}
      >
        {estado === "enviando" ? "Enviando…" : "Enviar al propietario"}
      </Button>
      {estado === "enviado" && (
        <span className="text-[13px] font-medium text-brand-active">Enviado ✓</span>
      )}
      {estado && !["descargando", "enviando", "enviado"].includes(estado) && (
        <span className="text-[13px] font-medium text-error">{estado}</span>
      )}
    </div>
  );
}

export function Legajos({
  propiedadId,
  legajos,
  inquilinosActivos,
}: {
  propiedadId: string;
  legajos: Legajo[];
  inquilinosActivos: Persona[];
}) {
  const vigente = legajos.find((l) => l.fecha_fin === null);
  const historicos = legajos.filter((l) => l.fecha_fin !== null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  async function onAbrir(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await abrirLegajo({
      propiedad_id: propiedadId,
      inquilino_id: String(form.get("inquilino_id")),
      fecha_inicio: String(form.get("fecha_inicio")),
    });
    setEnviando(false);
    if (!r.ok) setError(r.error);
  }

  async function onCerrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!vigente) return;
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await cerrarLegajo(
      vigente.id,
      propiedadId,
      String(form.get("fecha_fin"))
    );
    setEnviando(false);
    if (!r.ok) setError(r.error);
    else setCerrando(false);
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight mb-3">Legajos</h2>

      {vigente ? (
        <Card className="p-5 border-brand-soft-border bg-brand-soft/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tono="brand">Vigente</Badge>
              <p className="font-medium mt-2">{vigente.inquilino_nombre}</p>
              <p className="text-sm text-muted mt-0.5">
                Desde el <span className="font-mono text-[13px]">{fechaCorta(vigente.fecha_inicio)}</span>
              </p>
            </div>
            <ResumenObras legajoId={vigente.id} />
            {cerrando ? (
              <form onSubmit={onCerrar} className="flex items-end gap-3">
                <Input label="Fecha de fin" name="fecha_fin" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                <Button type="submit" disabled={enviando}>
                  {enviando ? "Cerrando…" : "Confirmar cierre"}
                </Button>
                <Button type="button" variante="fantasma" onClick={() => setCerrando(false)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <Button variante="secundario" onClick={() => setCerrando(true)}>
                Cerrar legajo
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-muted mb-4">
            Propiedad libre — abrí un legajo cuando entre un inquilino.
          </p>
          <form onSubmit={onAbrir} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-52">
              <Select label="Inquilino" name="inquilino_id" required>
                {inquilinosActivos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <Input label="Fecha de inicio" name="fecha_inicio" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            <Button type="submit" disabled={enviando || inquilinosActivos.length === 0}>
              {enviando ? "Abriendo…" : "Abrir legajo"}
            </Button>
          </form>
          {inquilinosActivos.length === 0 && (
            <p className="text-sm text-muted mt-3">
              Primero cargá un inquilino en la cartera.
            </p>
          )}
        </Card>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {error}
        </p>
      )}

      {historicos.length > 0 && (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-border text-left">
                {["Inquilino", "Desde", "Hasta", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-[13px] font-medium text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historicos.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{l.inquilino_nombre}</td>
                  <td className="px-4 py-3 font-mono text-[13px] text-muted">{fechaCorta(l.fecha_inicio)}</td>
                  <td className="px-4 py-3 font-mono text-[13px] text-muted">{l.fecha_fin ? fechaCorta(l.fecha_fin) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <ResumenObras legajoId={l.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}
