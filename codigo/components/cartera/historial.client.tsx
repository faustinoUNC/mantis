"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  descargarResumenObras,
  enviarResumenObras,
} from "@/features/cartera/service";
import type {
  CapituloHistorial,
  EstadoObra,
  ObraHistorial,
} from "@/features/cartera/historial";
import { ESTADO_OBRA_LABEL } from "@/features/cartera/historial";

// STORY-985: la historia clínica de la propiedad — los legajos como capítulos,
// las obras sin legajo en su hueco "sin ocupar", y los números del negocio
// arriba. Todo lectura; cada obra linkea a su gestión (segunda puerta, misma
// cerradura).

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

function fechaCorta(iso: string) {
  return new Date(
    iso.length === 10 ? `${iso}T00:00:00` : iso
  ).toLocaleDateString("es-AR");
}

const TONO_ESTADO: Record<EstadoObra, "brand" | "neutro" | "error"> = {
  terminada: "brand",
  en_curso: "neutro",
  cancelada: "error",
};

// Resumen de obras del legajo: descargar PDF o enviarlo al propietario.
export function ResumenObras({ legajoId }: { legajoId: string }) {
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

function Obra({ obra }: { obra: ObraHistorial }) {
  const apagada = obra.estado === "cancelada" && !obra.con_cargo;
  const meta = [
    obra.especialidad,
    obra.tecnico,
    obra.costo != null ? pesos(obra.costo) : null,
    obra.pagador ? `pagó ${obra.pagador}` : null,
  ].filter(Boolean);
  return (
    <Link
      href={`/gestiones/${obra.id}`}
      className={`group block rounded-md border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong ${apagada ? "opacity-55" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tono={TONO_ESTADO[obra.estado]}>{ESTADO_OBRA_LABEL[obra.estado]}</Badge>
        <span className="font-mono text-[13px] text-muted">
          {obra.estado === "terminada" && obra.terminada_en
            ? fechaCorta(obra.terminada_en)
            : `reportada el ${fechaCorta(obra.reportada_en)}`}
        </span>
        <span className="ml-auto text-sm text-muted opacity-0 transition-opacity group-hover:opacity-100">
          Ver gestión →
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium">{obra.trabajo ?? obra.problema}</p>
      {obra.trabajo && (
        <p className="mt-0.5 text-[13px] text-muted">
          Problema reportado: {obra.problema}
        </p>
      )}
      <p className="mt-1 text-[13px] text-muted">{meta.join(" · ")}</p>
    </Link>
  );
}

function periodoDe(capitulo: CapituloHistorial): string | null {
  if (capitulo.vigente) return `desde el ${fechaCorta(capitulo.desde!)}`;
  if (capitulo.desde && capitulo.hasta)
    return `${fechaCorta(capitulo.desde)} a ${fechaCorta(capitulo.hasta)}`;
  if (capitulo.desde) return `desde el ${fechaCorta(capitulo.desde)}`;
  if (capitulo.hasta) return `hasta el ${fechaCorta(capitulo.hasta)}`;
  return null;
}

// Etiqueta corta para el selector de período. Los capítulos "sin ocupar" se
// desambiguan por año cuando hay más de uno.
function etiquetaDe(capitulo: CapituloHistorial, repetidos: boolean): string {
  if (capitulo.tipo === "legajo") return capitulo.titulo;
  const anio = (capitulo.hasta ?? capitulo.desde)?.slice(0, 4);
  return repetidos && anio ? `Sin ocupar ${anio}` : "Sin ocupar";
}

// Ficha del capítulo elegido + sus obras. Sin acordeón: con muchos legajos el
// selector de arriba es el índice, y acá nunca hay más que UN período.
function PanelCapitulo({ capitulo }: { capitulo: CapituloHistorial }) {
  const periodo = periodoDe(capitulo);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">{capitulo.titulo}</span>
        {capitulo.vigente && <Badge tono="brand">Vigente</Badge>}
        <span className="text-[13px] text-muted">
          {periodo ? `${periodo} · ` : ""}
          {capitulo.obras.length}{" "}
          {capitulo.obras.length === 1 ? "obra" : "obras"}
        </span>
        {capitulo.legajo_id && (
          <span className="ml-auto">
            <ResumenObras legajoId={capitulo.legajo_id} />
          </span>
        )}
      </div>
      {capitulo.obras.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2">
          {capitulo.obras.map((o) => (
            <Obra key={o.id} obra={o} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">Sin obras en este período.</p>
      )}
    </div>
  );
}

export function Historial({ capitulos }: { capitulos: CapituloHistorial[] }) {
  // Selector de período (segmentado idéntico a Finanzas/Auditoría): un botón
  // por capítulo + "Todas". Arranca en el período vigente; si no hay, en Todas.
  const [seleccion, setSeleccion] = useState<number | "todas">(() => {
    const vigente = capitulos.findIndex((c) => c.vigente);
    return vigente >= 0 ? vigente : "todas";
  });
  const obras = capitulos.flatMap((c) => c.obras);
  // Las canceladas sin cargo se ven (apagadas) pero no cuentan en los números:
  // no pasó nada y no costó nada.
  const contadas = obras.filter((o) => o.estado !== "cancelada" || o.con_cargo);
  const terminadas = contadas.filter((o) => o.estado === "terminada");
  // Invertido = plata de obras cerradas (terminadas + canceladas con cargo);
  // lo presupuestado de una obra en curso todavía no salió de ningún bolsillo.
  const cerradas = contadas.filter((o) => o.estado !== "en_curso");
  const invertido = (filtro: (o: ObraHistorial) => boolean) =>
    cerradas
      .filter((o) => o.costo != null && filtro(o))
      .reduce((sum, o) => sum + (o.costo ?? 0), 0);
  const total = invertido(() => true);

  // Reincidencia: la misma especialidad ≥ 3 veces en la propiedad es un
  // problema crónico — el argumento de "cambiar en vez de arreglar de nuevo".
  const porEspecialidad = new Map<string, number>();
  for (const o of obras) {
    if (o.estado === "cancelada") continue;
    porEspecialidad.set(o.especialidad, (porEspecialidad.get(o.especialidad) ?? 0) + 1);
  }
  const reincidentes = [...porEspecialidad.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1]);

  if (obras.length === 0 && capitulos.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight mb-3">
        Historial de la propiedad
      </h2>

      {contadas.length > 0 && (
        <Card className="p-4">
          <p className="text-sm">
            <span className="font-semibold">{contadas.length}</span>{" "}
            {contadas.length === 1 ? "obra" : "obras"} ·{" "}
            <span className="font-semibold">{terminadas.length}</span> terminadas
            {total > 0 && (
              <>
                {" "}
                · <span className="font-semibold">{pesos(total)}</span> invertidos
              </>
            )}
          </p>
          {total > 0 && (
            <p className="mt-1 text-[13px] text-muted">
              Pagó inquilino {pesos(invertido((o) => o.pagador === "inquilino"))} ·
              propietario {pesos(invertido((o) => o.pagador === "propietario"))}
            </p>
          )}
          {reincidentes.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {reincidentes.map(([esp, n]) => (
                <Badge key={esp} tono="urgente">
                  ⚠ {esp} reincidente — {n} obras
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      {capitulos.length > 1 && (
        <div className="mt-4 flex flex-wrap rounded-md border border-border overflow-hidden w-fit">
          {capitulos.map((c, i) => (
            <button
              key={c.legajo_id ?? `desocupada-${i}`}
              type="button"
              onClick={() => setSeleccion(i)}
              className={`text-sm px-3.5 py-1.5 transition-colors whitespace-nowrap ${
                seleccion === i
                  ? "bg-brand text-white"
                  : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              {etiquetaDe(c, capitulos.filter((x) => x.tipo === "desocupada").length > 1)}
              <span
                className={`ml-1.5 text-[12px] tabular-nums ${
                  seleccion === i ? "text-white/75" : "text-muted"
                }`}
              >
                {c.obras.length}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSeleccion("todas")}
            className={`text-sm px-3.5 py-1.5 transition-colors whitespace-nowrap ${
              seleccion === "todas"
                ? "bg-brand text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            Todas
            <span
              className={`ml-1.5 text-[12px] tabular-nums ${
                seleccion === "todas" ? "text-white/75" : "text-muted"
              }`}
            >
              {obras.length}
            </span>
          </button>
        </div>
      )}

      <div className="mt-4">
        {seleccion === "todas" || !capitulos[seleccion] ? (
          <div className="flex flex-col gap-2">
            {[...obras]
              .sort((a, b) =>
                (b.terminada_en ?? b.reportada_en).localeCompare(
                  a.terminada_en ?? a.reportada_en
                )
              )
              .map((o) => (
                <Obra key={o.id} obra={o} />
              ))}
          </div>
        ) : (
          <PanelCapitulo capitulo={capitulos[seleccion]} />
        )}
      </div>
    </section>
  );
}
