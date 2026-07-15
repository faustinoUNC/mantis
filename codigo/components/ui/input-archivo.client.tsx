"use client";

import { useId, useState } from "react";
import { Icono } from "@/components/ui/iconos";
import {
  comprimirArchivosDeInput,
  comprimirImagen,
} from "@/shared/utils/imagen.client";

// Reemplazo del file input nativo (DESIGN.md §input-archivo): el nativo
// desborda en 390px. Botón secundario + nombre del archivo elegido.
// STORY-965/969: `multiple` permite varias fotos (una por comprobante) y
// ACUMULA entre aperturas del picker — el flujo real es sacar la foto de un
// ticket por vez, y el input nativo pisa la selección anterior en cada
// apertura. El estado es la fuente de verdad y el input real se reconstruye
// con DataTransfer para que el form mande todo junto.
export function InputArchivo({
  label,
  name,
  required,
  accept = "image/*",
  capture,
  multiple,
}: {
  label: string;
  name: string;
  required?: boolean;
  accept?: string;
  capture?: "environment" | "user";
  multiple?: boolean;
}) {
  const id = useId();
  const [nombre, setNombre] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<File[]>([]);

  function sincronizar(input: HTMLInputElement, todos: File[]) {
    const dt = new DataTransfer();
    for (const archivo of todos) dt.items.add(archivo);
    input.files = dt.files;
    setArchivos(todos);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      <div className="flex items-center gap-3 min-w-0">
        <label
          htmlFor={id}
          className="inline-flex items-center gap-2 min-h-tap px-4 rounded-md border border-border-strong bg-surface text-sm font-medium cursor-pointer hover:bg-surface-2 active:translate-y-px transition-colors shrink-0"
        >
          <Icono id="camara" size={16} />
          {multiple
            ? archivos.length > 0 ? "Agregar más fotos" : "Sacar o elegir fotos"
            : nombre ? "Cambiar foto" : "Sacar o elegir foto"}
        </label>
        {!multiple && (
          <span className="text-[13px] text-muted truncate min-w-0">
            {nombre ?? "Ninguna elegida"}
          </span>
        )}
        {multiple && archivos.length === 0 && (
          <span className="text-[13px] text-muted truncate min-w-0">
            Ninguna elegida
          </span>
        )}
      </div>
      {multiple && archivos.length > 0 && (
        <ul className="flex flex-col gap-1">
          {archivos.map((archivo, i) => (
            <li
              key={`${archivo.name}-${i}`}
              className="flex items-center gap-2 text-[13px] text-muted min-w-0"
            >
              <span className="truncate min-w-0">{archivo.name}</span>
              <button
                type="button"
                aria-label={`Quitar ${archivo.name}`}
                className="shrink-0 flex items-center justify-center size-6 rounded-md hover:bg-surface-2 hover:text-foreground transition-colors"
                onClick={(e) => {
                  const input = document.getElementById(id) as HTMLInputElement | null;
                  if (!input) return;
                  sincronizar(input, archivos.filter((_, j) => j !== i));
                  e.preventDefault();
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        capture={capture}
        required={required}
        multiple={multiple}
        className="sr-only"
        onChange={async (e) => {
          const input = e.target;
          if (!multiple) {
            setNombre(input.files?.[0]?.name ?? null);
            // Fotos de cámara: comprimir acá para no exceder el body del server action
            void comprimirArchivosDeInput(input);
            return;
          }
          // Acumular: lo recién elegido se comprime y se SUMA a lo que ya había.
          const nuevos = await Promise.all(
            Array.from(input.files ?? []).map(comprimirImagen)
          );
          sincronizar(input, [...archivos, ...nuevos]);
        }}
      />
    </div>
  );
}
