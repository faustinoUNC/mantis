"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils/cn";

// Visor de fotos único (DESIGN.md §visor-foto, STORY-995): la miniatura abre un
// overlay a pantalla completa. Cerrar con tap fuera / botón × / Escape.
// Reemplaza el <a target="_blank"> — el técnico no sale de la app en la calle.
export function VisorFoto({
  src,
  alt,
  className,
  wrapClassName,
}: {
  src: string;
  alt: string;
  className?: string;
  wrapClassName?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Ampliar: ${alt}`}
        className={cn(
          "block w-max rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          wrapClassName
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- foto del bucket, no una URL de Next/Image */}
        <img src={src} alt={alt} className={className} />
      </button>
      {abierto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/80 animate-aparecer"
            role="dialog"
            aria-modal="true"
            onClick={() => setAbierto(false)}
          >
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setAbierto(false)}
              className="absolute top-3 right-3 flex items-center justify-center size-11 rounded-md text-2xl leading-none text-background hover:bg-background/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto del bucket, no una URL de Next/Image */}
            <img
              src={src}
              alt={alt}
              className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-overlay"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}
