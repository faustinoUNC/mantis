"use client";

import { useId, useState } from "react";
import { Icono } from "@/components/ui/iconos";
import { comprimirArchivosDeInput } from "@/shared/utils/imagen.client";

// Reemplazo del file input nativo (DESIGN.md §input-archivo): el nativo
// desborda en 390px. Botón secundario + nombre del archivo elegido.
// STORY-965: `multiple` permite elegir varias fotos (una por comprobante).
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
          {nombre
            ? multiple ? "Cambiar fotos" : "Cambiar foto"
            : multiple ? "Sacar o elegir fotos" : "Sacar o elegir foto"}
        </label>
        <span className="text-[13px] text-muted truncate min-w-0">
          {nombre ?? "Ninguna elegida"}
        </span>
      </div>
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        capture={capture}
        required={required}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          const archivos = e.target.files;
          setNombre(
            !archivos?.length
              ? null
              : archivos.length === 1
                ? archivos[0].name
                : `${archivos.length} fotos elegidas`
          );
          // Fotos de cámara: comprimir acá para no exceder el body del server action
          void comprimirArchivosDeInput(e.target);
        }}
      />
    </div>
  );
}
