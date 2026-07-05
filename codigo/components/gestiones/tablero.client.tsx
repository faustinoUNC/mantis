"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Rol } from "@/features/auth/types";
import type { Especialidad } from "@/features/especialidades/types";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { crearGestion } from "@/features/gestiones/service";
import type { GestionResumen, Urgencia, Causa } from "@/features/gestiones/types";
import { ETAPAS, LABEL_CAUSA } from "@/features/gestiones/types";
import { cn } from "@/shared/utils/cn";

// Columnas accionables por rol (visual; el permiso real vive en avanzar_etapa)
const COLUMNAS_MANTENIMIENTO = new Set([
  "ingresado",
  "asignacion",
  "presupuesto",
  "en_ejecucion",
  "conformidad",
]);
const COLUMNAS_ADMINISTRATIVO = new Set([
  "facturacion_cobro",
  "liquidacion_tecnico",
]);

function accionable(rol: Rol, etapa: string) {
  if (rol === "administrador") return true;
  if (rol === "gestor_mantenimiento") return COLUMNAS_MANTENIMIENTO.has(etapa);
  if (rol === "gestor_administrativo") return COLUMNAS_ADMINISTRATIVO.has(etapa);
  return false;
}

function diasEn(fecha: string) {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  return dias === 0 ? "hoy" : `${dias} d`;
}

function TarjetaGestion({
  gestion,
  activa,
}: {
  gestion: GestionResumen;
  activa: boolean;
}) {
  return (
    <Link href={`/gestiones/${gestion.id}`} className="block">
      <Card
        className={cn(
          "p-3 hover:border-border-strong transition-colors",
          gestion.urgencia === "urgente" && "border-l-2 border-l-urgente",
          !activa && "opacity-50"
        )}
      >
        <p className="text-sm font-medium leading-snug line-clamp-2">
          {gestion.descripcion}
        </p>
        <p className="text-[13px] text-muted mt-1.5 truncate">
          {gestion.direccion}
        </p>
        <div className="flex items-center justify-between gap-2 mt-2.5">
          <div className="flex gap-1.5 min-w-0">
            <Badge tono="neutro" className="truncate">
              {gestion.especialidad}
            </Badge>
            {gestion.urgencia === "urgente" && (
              <Badge tono="urgente">Urgente</Badge>
            )}
          </div>
          <span className="font-mono text-[11px] text-muted shrink-0">
            {diasEn(gestion.creado_en)}
          </span>
        </div>
      </Card>
    </Link>
  );
}

function FormNueva({
  propiedades,
  especialidades,
  onListo,
}: {
  propiedades: { id: string; direccion: string }[];
  especialidades: Especialidad[];
  onListo: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const form = new FormData(e.currentTarget);
    const r = await crearGestion({
      descripcion: String(form.get("descripcion")),
      propiedad_id: String(form.get("propiedad_id")),
      especialidad_id: String(form.get("especialidad_id")),
      urgencia: String(form.get("urgencia")) as Urgencia,
      causa: String(form.get("causa")) as Causa,
    });
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onListo();
  }

  return (
    <Card className="animate-aparecer p-5 mb-5">
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Input label="Descripción" name="descripcion" required placeholder="Qué hay que arreglar y dónde (ambiente)" />
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
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-error sm:col-span-2">
            {error}
          </p>
        )}
        <Button type="submit" disabled={enviando} className="lg:col-start-3 self-end">
          {enviando ? "Creando…" : "Crear gestión"}
        </Button>
      </form>
    </Card>
  );
}

export function Tablero({
  gestiones,
  rol,
  propiedades,
  especialidades,
}: {
  gestiones: GestionResumen[];
  rol: Rol;
  propiedades: { id: string; direccion: string }[];
  especialidades: Especialidad[];
}) {
  const [creando, setCreando] = useState(false);
  const puedeCrear = rol === "administrador" || rol === "gestor_mantenimiento";

  return (
    <div className="animate-aparecer">
      <RefrescoVivo tabla="gestiones" />
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[13px] font-medium text-muted">Funnel</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">
            Gestiones de mantenimiento
          </h1>
        </div>
        {puedeCrear && (
          <Button onClick={() => setCreando(!creando)} variante={creando ? "secundario" : "primario"}>
            {creando ? "Cerrar" : "Nueva gestión"}
          </Button>
        )}
      </div>

      {creando && (
        <FormNueva
          propiedades={propiedades}
          especialidades={especialidades}
          onListo={() => setCreando(false)}
        />
      )}

      <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
        {ETAPAS.map((etapa) => {
          const columna = gestiones.filter((g) => g.etapa === etapa.id);
          const activa = accionable(rol, etapa.id);
          return (
            <section
              key={etapa.id}
              className="w-64 shrink-0 snap-start"
              aria-label={etapa.label}
            >
              <header className="flex items-center justify-between px-1 mb-2">
                <h2
                  className={cn(
                    "text-[13px] font-medium",
                    activa ? "text-foreground" : "text-muted"
                  )}
                >
                  {etapa.label}
                </h2>
                <span className="font-mono text-[11px] text-muted">
                  {columna.length}
                </span>
              </header>
              <div className="flex flex-col gap-2 min-h-24 rounded-lg bg-surface-2/60 p-2">
                {columna.map((g) => (
                  <TarjetaGestion key={g.id} gestion={g} activa={activa} />
                ))}
                {columna.length === 0 && (
                  <p className="text-[13px] text-muted/70 text-center py-6 select-none">
                    —
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
