"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/shared/utils/cn";

// STORY-980 v1.3: select con búsqueda — se tipea y el desplegable se va
// filtrando, con las opciones clasificadas en grupos (el mismo orden visual
// del optgroup, pero filtrable). Patrón de listbox tomado de
// BuscadorDireccion: absoluto bajo el input, onMouseDown preventDefault para
// que el blur no le gane al click.
// STORY-981: modo formulario — `textoTodos: null` saca la opción vacía (en
// un campo requerido "Todos" no significa nada), `placeholder` va aparte y
// `opciones` acepta una lista plana sin encabezados de grupo.

export interface Opcion {
  value: string;
  label: string;
}

export interface GrupoOpciones {
  label: string; // "" = sin encabezado
  opciones: Opcion[];
}

// Sin tildes ni mayúsculas: "tecnico" encuentra "Técnico".
function normalizar(t: string) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function ComboFiltrable({
  label,
  grupos,
  opciones,
  value,
  onChange,
  textoTodos = "Todos",
  placeholder,
}: {
  label: string;
  grupos?: GrupoOpciones[];
  opciones?: Opcion[];
  value: string;
  onChange: (v: string) => void;
  textoTodos?: string | null;
  placeholder?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [resaltada, setResaltada] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoId = useId();

  const listas = useMemo(
    () => grupos ?? [{ label: "", opciones: opciones ?? [] }],
    [grupos, opciones]
  );
  const textoInput = placeholder ?? textoTodos ?? "Buscar…";

  const etiquetaDe = (v: string) =>
    listas.flatMap((g) => g.opciones).find((o) => o.value === v)?.label ?? "";

  const visibles = useMemo(() => {
    const f = normalizar(filtro.trim());
    return listas
      .map((g) => ({
        ...g,
        opciones: f ? g.opciones.filter((o) => normalizar(o.label).includes(f)) : g.opciones,
      }))
      .filter((g) => g.opciones.length > 0);
  }, [listas, filtro]);

  // Lista plana en el orden en que se ve, para navegar con el teclado.
  // Si existe la opción vacía ("Todos"), es siempre la primera fila.
  const planas = useMemo(
    () => [
      ...(textoTodos != null ? [{ value: "", label: textoTodos }] : []),
      ...visibles.flatMap((g) => g.opciones),
    ],
    [visibles, textoTodos]
  );

  const abrir = () => {
    setAbierto(true);
    setFiltro("");
    setResaltada(0);
  };

  const cerrar = () => {
    setAbierto(false);
    setFiltro("");
  };

  const elegir = (v: string) => {
    onChange(v);
    cerrar();
    inputRef.current?.blur();
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    if (!abierto) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setResaltada((r) => Math.min(Math.max(r + paso, 0), planas.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (planas[resaltada]) elegir(planas[resaltada].value);
    } else if (e.key === "Escape") {
      cerrar();
      inputRef.current?.blur();
    }
  };

  // Índice plano de cada opción visible (para el resaltado del teclado).
  let indice = 0;

  const filaOpcion = (o: { value: string; label: string }, idx: number) => (
    <button
      type="button"
      role="option"
      aria-selected={o.value === value}
      className={cn(
        "w-full text-left px-3.5 py-2 text-sm transition-colors",
        idx === resaltada ? "bg-surface-2" : "hover:bg-surface-2",
        o.value === value && "text-brand font-medium"
      )}
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setResaltada(idx)}
      onClick={() => elegir(o.value)}
    >
      {o.label}
    </button>
  );

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={autoId} className="text-[13px] font-medium text-muted leading-tight">
        {label}
      </label>
      <input
        ref={inputRef}
        id={autoId}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={`${autoId}-listbox`}
        autoComplete="off"
        placeholder={abierto ? etiquetaDe(value) || textoInput : textoInput}
        value={abierto ? filtro : etiquetaDe(value)}
        onChange={(e) => {
          setFiltro(e.target.value);
          setResaltada(0);
        }}
        onFocus={abrir}
        onBlur={() => setTimeout(cerrar, 150)}
        onKeyDown={alTeclear}
        className={cn(
          "min-h-tap w-full pl-3.5 pr-9 rounded-md bg-surface text-foreground",
          "border border-border-strong",
          "placeholder:text-muted/60",
          "transition-colors duration-150",
          "focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15"
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-3 bottom-3.5 text-muted transition-transform",
          abierto ? "-rotate-90" : "rotate-90"
        )}
      >
        <Icono id="chevron" size={14} />
      </span>
      {abierto && (
        <ul
          id={`${autoId}-listbox`}
          role="listbox"
          aria-label={label}
          className="absolute z-10 left-0 right-0 top-full mt-1 rounded-md border border-border-strong bg-surface overflow-y-auto max-h-72 animate-aparecer"
        >
          {textoTodos != null && (
            <li className="border-b border-border">
              {filaOpcion({ value: "", label: textoTodos }, indice++)}
            </li>
          )}
          {visibles.map((g) => (
            <li key={g.label} className="border-b border-border last:border-0">
              {g.label && (
                <p className="px-3.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {g.label}
                </p>
              )}
              {g.opciones.map((o) => (
                <div key={o.value}>{filaOpcion(o, indice++)}</div>
              ))}
            </li>
          ))}
          {planas.length === (textoTodos != null ? 1 : 0) && (
            <li className="px-3.5 py-2.5 text-sm text-muted">Sin coincidencias.</li>
          )}
        </ul>
      )}
    </div>
  );
}
