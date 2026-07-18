"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { BotonIcono } from "@/components/ui/boton-icono.client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ComboFiltrable } from "@/components/ui/combo-filtrable.client";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Especialidad } from "@/features/especialidades/types";
import type { Urgencia } from "@/features/gestiones/types";
import {
  crearDesdeReporte,
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
  const [propiedadId, setPropiedadId] = useState("");

  async function manual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!propiedadId) return setError("Seleccioná una propiedad de la lista.");
    setCargando("manual");
    const f = new FormData(e.currentTarget);
    const r = await crearDesdeReporte(reporte.id, {
      descripcion: String(f.get("descripcion")),
      propiedad_id: propiedadId,
      especialidad_id: String(f.get("especialidad_id")),
      urgencia: String(f.get("urgencia")) as Urgencia,
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
          <Button onClick={() => setModo("manual")}>
            Crear gestión
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
          <ComboFiltrable
            label="Propiedad"
            opciones={propiedades.map((p) => ({ value: p.id, label: p.direccion }))}
            value={propiedadId}
            onChange={setPropiedadId}
            textoTodos={null}
            placeholder="Buscar por dirección…"
          />
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
  const [errorSync, setErrorSync] = useState<string | null>(null);
  const sincronizado = useRef(false);
  const pendientes = reportes; // el service ya trae solo pendientes

  async function sincronizar() {
    setSincronizando(true);
    const r = await sincronizarInbox();
    setSincronizando(false);
    // Si Gmail falla, que se VEA — no un "inbox al día" mentiroso
    setErrorSync(r.ok ? null : (r.error ?? "No se pudo sincronizar con Gmail."));
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
      <RefrescoVivo tabla="inbox_reportes" />
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Inbox
            {pendientes.length > 0 && (
              <span className="ml-2 text-brand">· {pendientes.length}</span>
            )}
          </h1>
          <BotonIcono
            icono="refrescar"
            titulo={sincronizando ? "Buscando mails…" : "Actualizar"}
            variante="secundario"
            pos="abajo-der"
            disabled={sincronizando}
            onClick={sincronizar}
          />
        </div>
        <p className="text-sm text-muted mt-1">
          Los correos que llegan pidiendo un mantenimiento, listos para convertir en gestión.
        </p>
      </div>

      {errorSync && (
        <p
          role="alert"
          className="mb-4 text-sm font-medium text-error bg-error-soft border border-error-soft-border rounded-md px-3 py-2"
        >
          {errorSync} Los reportes nuevos pueden estar quedando en Gmail sin entrar.
        </p>
      )}

      {pendientes.length === 0 && !sincronizando && !errorSync && (
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

    </div>
  );
}
