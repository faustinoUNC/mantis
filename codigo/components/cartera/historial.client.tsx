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

function Capitulo({
  capitulo,
  abiertoInicial,
}: {
  capitulo: CapituloHistorial;
  abiertoInicial: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const periodo = capitulo.vigente
    ? `desde el ${fechaCorta(capitulo.desde!)}`
    : capitulo.desde && capitulo.hasta
      ? `${fechaCorta(capitulo.desde)} a ${fechaCorta(capitulo.hasta)}`
      : capitulo.desde
        ? `desde el ${fechaCorta(capitulo.desde)}`
        : capitulo.hasta
          ? `hasta el ${fechaCorta(capitulo.hasta)}`
          : null;
  return (
    <div className="relative pl-6">
      <span
        aria-hidden
        className={`absolute left-0 top-2 size-3 rounded-full border-2 ${
          capitulo.vigente
            ? "border-brand bg-brand-soft"
            : "border-border-strong bg-surface-2"
        }`}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          className="flex items-center gap-2 text-left"
          onClick={() => setAbierto(!abierto)}
          aria-expanded={abierto}
        >
          <span className="font-medium">{capitulo.titulo}</span>
          {capitulo.vigente && <Badge tono="brand">Vigente</Badge>}
          <span className="text-[13px] text-muted">
            {periodo ? `${periodo} · ` : ""}
            {capitulo.obras.length}{" "}
            {capitulo.obras.length === 1 ? "obra" : "obras"}
          </span>
          <span
            className={`text-muted transition-transform ${abierto ? "rotate-90" : ""}`}
            aria-hidden
          >
            ›
          </span>
        </button>
        {capitulo.legajo_id && <ResumenObras legajoId={capitulo.legajo_id} />}
      </div>
      {abierto && capitulo.obras.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {capitulo.obras.map((o) => (
            <Obra key={o.id} obra={o} />
          ))}
        </div>
      )}
      {abierto && capitulo.obras.length === 0 && (
        <p className="mt-2 text-sm text-muted">Sin obras en este período.</p>
      )}
    </div>
  );
}

export function Historial({ capitulos }: { capitulos: CapituloHistorial[] }) {
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

      <div className="relative mt-4 flex flex-col gap-6">
        <span
          aria-hidden
          className="absolute left-[5px] top-2 bottom-2 w-px bg-border"
        />
        {capitulos.map((c, i) => (
          <Capitulo
            key={c.legajo_id ?? `desocupada-${i}`}
            capitulo={c}
            // Abiertos hasta el primer capítulo con legajo inclusive — el
            // período que el gestor vino a mirar; lo más viejo, colapsado.
            abiertoInicial={i <= Math.max(0, capitulos.findIndex((x) => x.tipo === "legajo"))}
          />
        ))}
      </div>
    </section>
  );
}
