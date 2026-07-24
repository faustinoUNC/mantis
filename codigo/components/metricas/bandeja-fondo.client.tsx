"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  armarPatrones,
  type ObraParaPatron,
  type PatronFondo,
  type RevisionFondo,
} from "@/features/patrones-fondo/patrones";
import { descartarPatron } from "@/features/patrones-fondo/service";

// STORY-1051 — Bandeja "Para revisar de fondo": propiedades con un rubro que se
// repite, ordenadas peor-arriba. Dos filtros de vista EN VIVO (efímeros, no se
// persisten): sensibilidad (≥N) y ventana (años). Al desplegar una fila, cada
// obra linkea a su timeline (leer por sí mismo = primario). Iniciar una gestión
// de fondo o descartar el patrón lo saca de la bandeja; reaparece con una obra
// nueva del rubro. Walter (análisis) llega en la Fase 2 — acá no está todavía.

function fechaCorta(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(
    "es-AR"
  );
}

const clave = (p: PatronFondo) => `${p.propiedadId}::${p.especialidadId}`;

function urlNuevaGestionFondo(p: PatronFondo): string {
  const antecedentes = p.obras.map((o) => `#${o.numero}`).join(", ");
  const descripcion =
    `Revisión de fondo del rubro ${p.especialidad}. ` +
    `Antecedentes (${p.cantidad} obras del mismo rubro en esta propiedad): ${antecedentes}.`;
  const params = new URLSearchParams({
    propiedad: p.propiedadId,
    especialidad: p.especialidadId,
    descripcion,
    fondo: "1",
  });
  return `/tablero?${params.toString()}`;
}

function FilaPatron({
  patron,
  abierta,
  onToggle,
  onDescartar,
  descartando,
  puedeIniciar,
}: {
  patron: PatronFondo;
  abierta: boolean;
  onToggle: () => void;
  onDescartar: () => void;
  descartando: boolean;
  puedeIniciar: boolean;
}) {
  return (
    <li className="py-1">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 py-2 text-left"
      >
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium truncate">{patron.direccion}</span>
            {patron.reaparecida && <Badge tono="urgente">Volvió</Badge>}
          </span>
          <span className="block text-[12px] text-muted truncate">
            {patron.especialidad} · {patron.cantidad} obras
            {patron.reaparecida && patron.motivoReaparicion
              ? ` · ${patron.motivoReaparicion}`
              : ""}
          </span>
        </span>
        <span className="text-sm text-muted tabular-nums whitespace-nowrap">
          {abierta ? "−" : "+"}
        </span>
      </button>

      {abierta && (
        <div className="mt-1 mb-2 pl-1">
          <ul className="flex flex-col gap-1.5">
            {patron.obras.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/gestiones/${o.id}`}
                  className="group flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 transition-colors hover:border-border-strong"
                >
                  <span className="font-mono text-[12px] text-muted shrink-0">
                    #{o.numero}
                  </span>
                  <span className="flex-1 min-w-0 text-sm truncate group-hover:text-brand transition-colors">
                    {o.titulo}
                  </span>
                  <span className="text-[12px] text-muted shrink-0">
                    {fechaCorta(o.fecha)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {puedeIniciar && (
              <Link href={urlNuevaGestionFondo(patron)}>
                <Button
                  type="button"
                  variante="secundario"
                  className="min-h-0 h-8 px-3 text-sm"
                >
                  Iniciar gestión de fondo
                </Button>
              </Link>
            )}
            <Button
              type="button"
              variante="fantasma"
              className="min-h-0 h-8 px-3 text-sm"
              disabled={descartando}
              onClick={onDescartar}
            >
              {descartando ? "Descartando…" : "No están relacionadas"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function BandejaFondo({
  obras,
  revisiones,
  puedeIniciar,
}: {
  obras: ObraParaPatron[];
  revisiones: RevisionFondo[];
  puedeIniciar: boolean;
}) {
  const router = useRouter();
  const [ahora] = useState(() => Date.now());
  // Filtros de vista EN VIVO — solo dónde arrancan parados; se mueven a mano.
  const [minReiteraciones, setMinReiteraciones] = useState(3);
  const [ventanaAnios, setVentanaAnios] = useState<number | null>(null); // null = todo el histórico
  const [abierta, setAbierta] = useState<string | null>(null);
  const [descartando, setDescartando] = useState<string | null>(null);

  // La sección aparece solo si existe ALGÚN rubro repetido (≥2) en lo que el
  // usuario ve — si no, es ruido en Informes.
  const hayAlguno = useMemo(
    () => armarPatrones(obras, revisiones, { minReiteraciones: 2, ventanaAnios: null }, ahora).length > 0,
    [obras, revisiones, ahora]
  );

  const patrones = useMemo(
    () => armarPatrones(obras, revisiones, { minReiteraciones, ventanaAnios }, ahora),
    [obras, revisiones, minReiteraciones, ventanaAnios, ahora]
  );

  if (!hayAlguno) return null;

  async function descartar(p: PatronFondo) {
    const k = clave(p);
    setDescartando(k);
    const r = await descartarPatron(p.propiedadId, p.especialidadId);
    setDescartando(null);
    if (r.ok) router.refresh();
  }

  return (
    <section className="mb-8">
      <h3 className="text-[13px] font-semibold text-muted mb-3">Para revisar de fondo</h3>
      <Card className="p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h4 className="text-[15px] font-semibold tracking-tight">
            Propiedades con un rubro repetido
          </h4>
          <span className="text-[12px] text-muted whitespace-nowrap">
            {patrones.length} {patrones.length === 1 ? "propiedad" : "propiedades"}
          </span>
        </div>
        <p className="text-[12px] text-muted mb-3 leading-snug">
          Un mismo rubro que vuelve en una propiedad puede ser un problema de fondo.
          Abrí cada una para ver sus obras y decidir si conviene una obra que ataque
          la causa.
        </p>

        {/* Filtros de vista en vivo (no se guardan) */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 text-[13px]">
          <label className="flex items-center gap-2">
            <span className="text-muted">Desde</span>
            <input
              type="number"
              min={2}
              value={minReiteraciones}
              onChange={(e) =>
                setMinReiteraciones(Math.max(2, Number(e.target.value) || 2))
              }
              className="w-14 rounded-md border border-border bg-surface px-2 py-1 tabular-nums"
            />
            <span className="text-muted">obras</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted">Últimos</span>
            <input
              type="number"
              min={1}
              step={1}
              value={ventanaAnios ?? ""}
              placeholder="todo"
              onChange={(e) => {
                const v = e.target.value.trim();
                setVentanaAnios(v === "" ? null : Math.max(1, Math.floor(Number(v) || 1)));
              }}
              className="w-16 rounded-md border border-border bg-surface px-2 py-1 tabular-nums"
            />
            <span className="text-muted">
              {ventanaAnios == null ? "años (todo el histórico)" : "años"}
            </span>
          </label>
        </div>

        {patrones.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">
            Nada para revisar con estos filtros. Bajá el mínimo o ampliá los años.
          </p>
        ) : (
          <ul className="divide-y divide-border max-h-96 overflow-y-auto">
            {patrones.map((p) => {
              const k = clave(p);
              return (
                <FilaPatron
                  key={k}
                  patron={p}
                  abierta={abierta === k}
                  onToggle={() => setAbierta(abierta === k ? null : k)}
                  onDescartar={() => descartar(p)}
                  descartando={descartando === k}
                  puedeIniciar={puedeIniciar}
                />
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
