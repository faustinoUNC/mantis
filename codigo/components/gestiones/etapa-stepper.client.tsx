"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ETAPAS } from "@/features/gestiones/types";
import { cn } from "@/shared/utils/cn";

// Stepper del funnel (STORY-904): dónde está la gestión, de un vistazo.
// Cuando la etapa cambia (acción propia o realtime), el paso nuevo hace
// un flash esmeralda y un toast confirma el avance — feedback inequívoco.

export function EtapaStepper({ etapa }: { etapa: string }) {
  const indice = ETAPAS.findIndex((e) => e.id === etapa);
  const previa = useRef(etapa);
  const [avanzo, setAvanzo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (previa.current !== etapa) {
      const label = ETAPAS.find((e) => e.id === etapa)?.label ?? etapa;
      setAvanzo(true);
      setToast(`La gestión avanzó a ${label}`);
      const t1 = setTimeout(() => setAvanzo(false), 1200);
      const t2 = setTimeout(() => setToast(null), 4500);
      previa.current = etapa;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [etapa]);

  const actualLabel = ETAPAS[indice]?.label ?? etapa;
  const siguiente = ETAPAS[indice + 1]?.label;

  return (
    <>
      {/* Mobile: indicador compacto — todo el funnel de un vistazo sin scroll */}
      <div className="sm:hidden mt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-semibold text-brand-active leading-tight">
            {actualLabel}
          </p>
          <span className="font-mono text-[12px] text-muted shrink-0">
            Paso {indice + 1} de {ETAPAS.length}
          </span>
        </div>
        <div className="flex gap-1 mt-2" aria-hidden>
          {ETAPAS.map((e, i) => (
            <span
              key={e.id}
              className={cn(
                "h-1.5 flex-1 rounded-pill transition-colors duration-300",
                i < indice && "bg-brand/45",
                i === indice && "bg-brand",
                i === indice && avanzo && "animate-latido",
                i > indice && "bg-border"
              )}
            />
          ))}
        </div>
        {siguiente && (
          <p className="text-[12px] text-muted mt-2">
            Sigue: <span className="font-medium text-foreground">{siguiente}</span>
          </p>
        )}
      </div>

      {/* Desktop: stepper completo con las 8 etapas */}
      <div className="hidden sm:block mt-4 overflow-x-auto">
        <ol className="flex items-center gap-0 min-w-max">
          {ETAPAS.map((e, i) => {
            const pasada = i < indice;
            const actual = i === indice;
            return (
              <li key={e.id} className="flex items-center">
                {i > 0 && (
                  <span
                    className={cn(
                      "block h-px w-6",
                      i <= indice ? "bg-brand" : "bg-border"
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors",
                    actual &&
                      "border-brand bg-brand-soft text-brand-active font-semibold",
                    actual && avanzo && "animate-flash-brand",
                    pasada && "border-transparent text-brand-active/70",
                    !actual && !pasada && "border-transparent text-muted/60"
                  )}
                  aria-current={actual ? "step" : undefined}
                >
                  {pasada && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                  {e.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {toast &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-toast">
            <div className="flex items-center gap-2.5 rounded-lg bg-brand text-white px-4 py-3 shadow-overlay text-sm font-semibold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {toast}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
