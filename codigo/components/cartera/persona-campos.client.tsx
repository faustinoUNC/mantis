"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComboFiltrable } from "@/components/ui/combo-filtrable.client";
import { Input } from "@/components/ui/input";
import { guardarPersona } from "@/features/cartera/service";
import type { Persona, RefPersona, TipoPersona } from "@/features/cartera/types";
import { errorCuil } from "@/shared/utils/cuil";
import { cn } from "@/shared/utils/cn";

// Piezas compartidas para referenciar/editar personas de la cartera
// (STORY-941): las usan el wizard de alta, el detalle de la propiedad
// (cambiar propietario, abrir legajo) y la edición inline de datos.

export type DatosPersona = { nombre: string; email: string; telefono: string; cuil: string };
export type Modo = "existente" | "nuevo";

export const PERSONA_VACIA: DatosPersona = { nombre: "", email: "", telefono: "", cuil: "" };

export function validarPersona(
  modo: Modo,
  id: string,
  nueva: DatosPersona,
  quien: string
): string | null {
  if (modo === "existente") {
    return id ? null : `Elegí un ${quien} de la lista.`;
  }
  if (!nueva.nombre.trim() || !nueva.email.trim() || !nueva.telefono.trim()) {
    return `Completá nombre, email y teléfono del ${quien}.`;
  }
  const errCuil = errorCuil(nueva.cuil, "CUIL/CUIT");
  if (errCuil) {
    return errCuil;
  }
  return null;
}

export function refPersona(modo: Modo, id: string, nueva: DatosPersona): RefPersona {
  return modo === "existente" ? { id } : { nueva };
}

export function Segmentado({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: Modo; label: string }[];
  valor: Modo;
  onCambio: (m: Modo) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-1 gap-1 bg-surface-2/50">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onCambio(o.valor)}
          className={cn(
            "px-3.5 py-2 rounded-md text-sm font-medium transition-colors min-h-tap",
            valor === o.valor
              ? "bg-surface text-foreground border border-brand-soft-border shadow-none"
              : "text-muted hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CamposPersona({
  valores,
  onCambio,
  docLabel,
}: {
  valores: DatosPersona;
  onCambio: (v: DatosPersona) => void;
  docLabel: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 animate-aparecer">
      <Input label="Nombre" required value={valores.nombre} onChange={(e) => onCambio({ ...valores, nombre: e.target.value })} placeholder="Nombre y apellido" />
      <Input label="Correo electrónico" type="email" required value={valores.email} onChange={(e) => onCambio({ ...valores, email: e.target.value })} placeholder="correo@ejemplo.com" />
      <Input label="Teléfono" required inputMode="numeric" value={valores.telefono} onChange={(e) => onCambio({ ...valores, telefono: e.target.value.replace(/\D/g, "") })} placeholder="Solo números" />
      <Input label={docLabel} required inputMode="numeric" value={valores.cuil} onChange={(e) => onCambio({ ...valores, cuil: e.target.value })} placeholder="Ej. 20301234563" />
    </div>
  );
}

export function SelectorPersona({
  personas,
  quien,
  docLabel,
  modo,
  onModo,
  id,
  onId,
  nueva,
  onNueva,
}: {
  personas: Persona[];
  quien: string;
  docLabel: string;
  modo: Modo;
  onModo: (m: Modo) => void;
  id: string;
  onId: (id: string) => void;
  nueva: DatosPersona;
  onNueva: (v: DatosPersona) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {personas.length > 0 && (
        <Segmentado
          valor={modo}
          onCambio={onModo}
          opciones={[
            { valor: "existente", label: "Ya está en la cartera" },
            { valor: "nuevo", label: `Cargar ${quien} nuevo` },
          ]}
        />
      )}
      {modo === "existente" && personas.length > 0 ? (
        <div className="max-w-sm animate-aparecer">
          {/* STORY-981: la cartera crece — se elige tipeando el nombre. */}
          <ComboFiltrable
            label={quien[0].toUpperCase() + quien.slice(1)}
            opciones={personas.map((p) => ({ value: p.id, label: p.nombre }))}
            value={id}
            onChange={onId}
            textoTodos={null}
            placeholder="Buscar por nombre…"
          />
        </div>
      ) : (
        <CamposPersona valores={nueva} onCambio={onNueva} docLabel={docLabel} />
      )}
    </div>
  );
}

// Edición inline de los datos de una persona ya cargada (reemplaza al ABM
// suelto: se corrige el email/teléfono desde la propiedad donde vive).
export function FormEditarPersona({
  tipo,
  persona,
  docLabel,
  onListo,
}: {
  tipo: TipoPersona;
  persona: Persona;
  docLabel: string;
  onListo: () => void;
}) {
  const [valores, setValores] = useState<DatosPersona>({
    nombre: persona.nombre,
    email: persona.email,
    telefono: persona.telefono ?? "",
    cuil: persona.documento ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const errCuil = errorCuil(valores.cuil, "CUIL/CUIT");
    if (errCuil) return setError(errCuil);
    setEnviando(true);
    const r = await guardarPersona(
      tipo,
      {
        nombre: valores.nombre,
        email: valores.email,
        telefono: valores.telefono,
        documento: valores.cuil,
      },
      persona.id
    );
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    onListo();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <CamposPersona valores={valores} onCambio={setValores} docLabel={docLabel} />
      {error && (
        <p role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </Button>
        <Button type="button" variante="fantasma" onClick={onListo}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
