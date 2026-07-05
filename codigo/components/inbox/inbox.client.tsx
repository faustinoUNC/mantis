"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Especialidad } from "@/features/especialidades/types";
import type { Causa, Urgencia } from "@/features/gestiones/types";
import { LABEL_CAUSA } from "@/features/gestiones/types";
import {
  crearDesdeReporte,
  crearGestionConIA,
  descartarReporte,
  sincronizarInbox,
  type Reporte,
} from "@/features/inbox/service";

function hace(fecha: string | null) {
  if (!fecha) return "";
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(min, 1)} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

function limpiarRemitente(r: string | null) {
  return r?.replace(/<.*>/, "").replaceAll('"', "").trim() || "Desconocido";
}

function ReporteCard({
  reporte,
  propiedades,
  especialidades,
}: {
  reporte: Reporte;
  propiedades: { id: string; direccion: string }[];
  especialidades: Especialidad[];
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"ninguno" | "manual" | "descartar">("ninguno");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);

  async function conIA() {
    setError(null);
    setCargando("ia");
    const r = await crearGestionConIA(reporte.id);
    setCargando(null);
    if (!r.ok) return setError(r.error);
    if (r.data?.gestionId) router.push(`/gestiones/${r.data.gestionId}`);
  }

  async function manual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando("manual");
    const f = new FormData(e.currentTarget);
    const r = await crearDesdeReporte(reporte.id, {
      descripcion: String(f.get("descripcion")),
      propiedad_id: String(f.get("propiedad_id")),
      especialidad_id: String(f.get("especialidad_id")),
      urgencia: String(f.get("urgencia")) as Urgencia,
      causa: String(f.get("causa")) as Causa,
    });
    setCargando(null);
    if (!r.ok) return setError(r.error);
    if (r.data?.gestionId) router.push(`/gestiones/${r.data.gestionId}`);
  }

  async function descartar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando("descartar");
    const motivo = String(new FormData(e.currentTarget).get("motivo"));
    const r = await descartarReporte(reporte.id, motivo);
    setCargando(null);
    if (!r.ok) setError(r.error);
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            {limpiarRemitente(reporte.remitente)} · {hace(reporte.recibido_en)}
          </p>
          <p className="font-medium mt-0.5">{reporte.asunto ?? "(sin asunto)"}</p>
        </div>
        <Badge tono="urgente">Pendiente</Badge>
      </div>
      {reporte.cuerpo && (
        <p className="text-sm text-muted mt-2 line-clamp-3 whitespace-pre-line">
          {reporte.cuerpo}
        </p>
      )}

      {modo === "ninguno" && (
        <div className="flex flex-wrap gap-2 mt-4">
          <Button disabled={cargando !== null} onClick={conIA}>
            {cargando === "ia" ? "La IA está leyendo…" : "✦ Crear con IA"}
          </Button>
          <Button variante="secundario" onClick={() => setModo("manual")}>
            Crear manual
          </Button>
          <Button
            variante="fantasma"
            className="text-error hover:text-error"
            onClick={() => setModo("descartar")}
          >
            Descartar
          </Button>
        </div>
      )}

      {modo === "manual" && (
        <form onSubmit={manual} className="grid gap-3 sm:grid-cols-2 mt-4">
          <div className="sm:col-span-2">
            <Input
              label="Descripción"
              name="descripcion"
              required
              defaultValue={`${reporte.asunto ?? ""}${reporte.cuerpo ? ` — ${reporte.cuerpo.slice(0, 140)}` : ""}`.trim()}
            />
          </div>
          <Select label="Propiedad" name="propiedad_id" required>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.direccion}
              </option>
            ))}
          </Select>
          <Select label="Especialidad" name="especialidad_id" required>
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </Select>
          <Select label="Urgencia" name="urgencia" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="urgente">Urgente</option>
          </Select>
          <Select label="Causa" name="causa" defaultValue="desgaste">
            {(Object.keys(LABEL_CAUSA) as Causa[]).map((c) => (
              <option key={c} value={c}>
                {LABEL_CAUSA[c]}
              </option>
            ))}
          </Select>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={cargando !== null}>
              {cargando === "manual" ? "Creando…" : "Crear gestión"}
            </Button>
            <Button type="button" variante="fantasma" onClick={() => setModo("ninguno")}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {modo === "descartar" && (
        <form onSubmit={descartar} className="flex flex-wrap items-end gap-3 mt-4">
          <div className="flex-1 min-w-56">
            <Input
              label="Motivo del descarte"
              name="motivo"
              required
              placeholder="No corresponde / resuelto por teléfono / duplicado…"
            />
          </div>
          <Button type="submit" disabled={cargando !== null} variante="secundario">
            {cargando === "descartar" ? "Descartando…" : "Confirmar descarte"}
          </Button>
          <Button type="button" variante="fantasma" onClick={() => setModo("ninguno")}>
            Cancelar
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {error}
        </p>
      )}
    </Card>
  );
}

export function Inbox({
  reportes,
  propiedades,
  especialidades,
}: {
  reportes: Reporte[];
  propiedades: { id: string; direccion: string }[];
  especialidades: Especialidad[];
}) {
  const router = useRouter();
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizado = useRef(false);
  const pendientes = reportes.filter((r) => r.estado === "pendiente");
  const procesados = reportes.filter((r) => r.estado !== "pendiente");

  async function sincronizar() {
    setSincronizando(true);
    await sincronizarInbox();
    setSincronizando(false);
    router.refresh();
  }

  // Sync al abrir el inbox (una vez por montaje) — ARQUITECTURA §5 ajustada.
  useEffect(() => {
    if (sincronizado.current) return;
    sincronizado.current = true;
    sincronizar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-aparecer max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[13px] font-medium text-muted">
            Casilla de reportes — se traen los mails con “mantenimiento” en el asunto
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
            Inbox
            {pendientes.length > 0 && (
              <span className="ml-2 text-brand">· {pendientes.length}</span>
            )}
          </h1>
        </div>
        <Button variante="secundario" disabled={sincronizando} onClick={sincronizar}>
          {sincronizando ? "Buscando mails…" : "Actualizar"}
        </Button>
      </div>

      {pendientes.length === 0 && !sincronizando && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted">
            Inbox al día — ningún reporte sin destino. ✦
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {pendientes.map((r) => (
          <ReporteCard
            key={r.id}
            reporte={r}
            propiedades={propiedades}
            especialidades={especialidades}
          />
        ))}
      </div>

      {procesados.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium text-muted mb-2">Procesados</h2>
          <Card className="divide-y divide-border">
            {procesados.map((r) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="line-clamp-1">{r.asunto ?? "(sin asunto)"}</span>
                  {r.motivo_descarte && (
                    <span className="text-[13px] text-muted">Descartado: {r.motivo_descarte}</span>
                  )}
                </span>
                {r.estado === "gestionado" && r.gestion_id ? (
                  <Link
                    href={`/gestiones/${r.gestion_id}`}
                    className="text-brand font-medium shrink-0"
                  >
                    Ver gestión →
                  </Link>
                ) : (
                  <Badge tono="neutro">Descartado</Badge>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
