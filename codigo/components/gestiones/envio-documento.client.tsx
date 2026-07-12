"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Icono } from "@/components/ui/iconos";
import type { ActionResult } from "@/features/empleados/types";
import type { DocumentoGenerado } from "@/features/finanzas/service";

// Flujo unificado de documentos (STORY-903 v1.1): "Vista previa" abre el PDF
// REAL en un modal SOLO para mirar/descargar — enviar es un botón aparte
// (pedido Fausti: ver no puede empujar a enviar). Overlay con sombra (único
// uso permitido), card lg, un acento.

export function EnvioDocumento({
  etiqueta,
  destinatarioEtiqueta,
  generar,
  enviar,
  yaEnviado,
  onEnviado,
}: {
  etiqueta: string; // "presupuesto" | "nota de cobro" | ...
  destinatarioEtiqueta?: string; // "propietario" | "inquilino" — para el botón de envío
  generar: () => Promise<ActionResult<DocumentoGenerado>>;
  enviar?: () => Promise<ActionResult>; // sin enviar → solo ver/descargar
  yaEnviado?: boolean;
  onEnviado?: () => void; // aviso al padre cuando el envío salió OK (STORY-935)
}) {
  const [doc, setDoc] = useState<DocumentoGenerado | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(Boolean(yaEnviado));
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // El refresh vivo puede traer yaEnviado=true (otro usuario envió):
  // nunca degradar a false — "enviado" local gana hasta el próximo mount.
  // Ajuste durante el render — patrón oficial, sin useEffect.
  const [yaEnviadoPrevio, setYaEnviadoPrevio] = useState(yaEnviado);
  if (yaEnviadoPrevio !== yaEnviado) {
    setYaEnviadoPrevio(yaEnviado);
    if (yaEnviado) setEnviado(true);
  }

  // El efecto SOLO limpia: al cambiar el blob (o desmontar) se revoca el viejo
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  async function abrir() {
    setError(null);
    setCargando("generar");
    const r = await generar();
    setCargando(null);
    if (!r.ok || !r.data) return setError(r.ok ? "Error" : r.error);
    const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
    setBlobUrl(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })));
    setDoc(r.data);
    setAbierto(true);
  }

  function descargar() {
    if (!doc) return;
    const a = document.createElement("a");
    a.href = `data:application/pdf;base64,${doc.base64}`;
    a.download = doc.filename;
    a.click();
  }

  async function mandar() {
    if (!enviar) return;
    setError(null);
    setCargando("enviar");
    const r = await enviar();
    setCargando(null);
    if (!r.ok) return setError(r.error);
    setEnviado(true);
    onEnviado?.();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variante="secundario"
          disabled={cargando !== null}
          onClick={abrir}
        >
          <Icono id="ojo" size={16} />
          {cargando === "generar" ? "Generando…" : <span className="capitalize">Ver {etiqueta}</span>}
        </Button>
        {enviar && (
          <Button
            variante={enviado ? "secundario" : "primario"}
            disabled={cargando !== null}
            onClick={mandar}
          >
            {cargando === "enviar"
              ? "Enviando…"
              : `${enviado ? "Reenviar" : `Enviar ${etiqueta}`} al ${destinatarioEtiqueta ?? "pagador"} por email`}
          </Button>
        )}
        {enviado && (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-active">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Enviado por email
          </span>
        )}
      </div>
      {error && !abierto && (
        <p className="mt-2 text-sm font-medium text-error">{error}</p>
      )}

      {abierto && doc && createPortal(
        // Portal al body: inmune a ancestros con transform (containing block)
        <div
          className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4"
          onClick={() => setAbierto(false)}
        >
          <div
            className="animate-aparecer bg-surface rounded-lg shadow-overlay w-full max-w-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="min-w-0">
                <p className="font-medium capitalize">{etiqueta}</p>
                <p className="text-[13px] text-muted truncate">
                  Vista previa
                  {enviar
                    ? ` — al enviarlo irá a ${doc.destinatario.nombre} (${doc.destinatario.rotulo.toLowerCase()})`
                    : ` — ${doc.filename}`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setAbierto(false)}
                className="flex items-center justify-center size-9 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {blobUrl && (
              <iframe
                title={`Vista previa: ${etiqueta}`}
                src={`${blobUrl}#toolbar=0&navpanes=0`}
                className="flex-1 min-h-96 w-full bg-surface-2"
              />
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3.5 border-t border-border">
              <Button variante="fantasma" onClick={descargar}>
                Descargar
              </Button>
              <Button variante="secundario" onClick={() => setAbierto(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
