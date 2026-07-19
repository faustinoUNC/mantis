"use client";

// STORY-1007 — Walter: burbuja flotante + panel de chat. Overlay del design
// contract: borde + shadow-overlay (único caso con sombra), animación
// `aparecer`, esmeralda solo como acento, targets ≥44px, voseo.
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Rol } from "@/features/auth/types";
import { CHIPS_POR_ROL, LIMITES } from "@/features/asistente/config";
import { cn } from "@/shared/utils/cn";

// Qué está consultando cada tool (estado "pensando" honesto, no genérico).
const CONSULTANDO: Record<string, string> = {
  buscar_gestiones: "Buscando gestiones",
  detalle_gestion: "Leyendo la gestión",
  gestiones_archivadas: "Revisando el archivo",
  mis_pendientes: "Buscando tus pendientes",
  mis_notificaciones: "Leyendo tus notificaciones",
  resumen_tablero: "Mirando el tablero",
  metricas_negocio: "Calculando los números",
  consultar_cartera: "Consultando la cartera",
  historial_propiedad: "Armando el historial",
  ranking_tecnicos: "Comparando técnicos",
  detalle_tecnico: "Buscando al técnico",
  inbox_reportes: "Revisando el inbox",
  auditoria_reciente: "Consultando la auditoría",
  equipo_interno: "Consultando el equipo",
  mi_agenda: "Mirando tu agenda",
  sugerir_navegacion: "Preparando accesos",
};

// El texto del modelo llega como texto plano con **negritas** — se renderiza
// escapado (React) con un mini-parser; jamás HTML del modelo al DOM.
function Texto({ contenido }: { contenido: string }) {
  const partes = contenido.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {partes.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          p
        )
      )}
    </span>
  );
}

type BotonNav = { label: string; ruta: string };

export function Walter({ rol, nombre }: { rol: Rol; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error, setMessages, clearError, regenerate } =
    useChat({
      transport: new DefaultChatTransport({ api: "/api/asistente" }),
    });

  const ocupado = status === "submitted" || status === "streaming";

  // Autoscroll al fondo con cada novedad del stream.
  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, abierto, status]);

  useEffect(() => {
    if (!abierto) return;
    inputRef.current?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [abierto]);

  function enviar(texto: string) {
    const limpio = texto.trim().slice(0, LIMITES.caracteresInput);
    if (!limpio || ocupado) return;
    clearError();
    void sendMessage({ text: limpio });
    setInput("");
  }

  const sinConversacion = !messages.some((m) => m.role === "user");
  const esTecnico = rol === "tecnico";

  return (
    <>
      {/* Burbuja (FAB). En técnico flota sobre la bottom-nav. */}
      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir Walter, el asistente de MANTIS"
          className={cn(
            "fixed right-5 z-50 size-13 rounded-pill bg-brand text-white shadow-overlay",
            "flex items-center justify-center transition-transform hover:bg-brand-hover active:scale-95",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand animate-aparecer",
            esTecnico ? "bottom-24" : "bottom-5"
          )}
        >
          <span className="font-black text-lg leading-none" style={{ fontStretch: "125%" }}>
            W
          </span>
        </button>
      )}

      {abierto && (
        <div
          role="dialog"
          aria-label="Walter, asistente de MANTIS"
          className={cn(
            "fixed z-50 bg-surface flex flex-col animate-aparecer",
            "inset-0 md:inset-auto md:bottom-5 md:right-5 md:w-[400px] md:h-[620px] md:max-h-[80vh]",
            "md:border md:border-border md:rounded-lg md:shadow-overlay"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            <span className="size-8 rounded-pill bg-brand text-white flex items-center justify-center font-black text-sm shrink-0">
              W
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Walter</p>
              <p className="text-[12px] text-muted leading-tight">
                Asistente MANTIS · puede cometer errores
              </p>
            </div>
            {!sinConversacion && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  clearError();
                  inputRef.current?.focus();
                }}
                className="text-[13px] text-muted hover:text-foreground px-2 py-2 rounded-md hover:bg-surface-2 transition-colors"
              >
                Nueva
              </button>
            )}
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar el asistente"
              className="flex items-center justify-center size-11 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mensajes */}
          <div role="log" aria-live="polite" className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {sinConversacion && (
              <div className="space-y-3">
                <div className="text-sm border border-border rounded-lg px-3.5 py-3 max-w-[85%]">
                  ¡Hola, {nombre.split(" ")[0]}! Soy Walter. Preguntame por tus
                  gestiones, pendientes o cómo hacer algo en MANTIS.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CHIPS_POR_ROL[rol].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => enviar(chip)}
                      className="text-[13px] px-3 py-2 rounded-pill border border-border text-muted hover:text-brand hover:border-brand-soft-border hover:bg-brand-soft transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" && "justify-end")}>
                <div
                  className={cn(
                    "text-sm rounded-lg px-3.5 py-2.5 max-w-[85%] space-y-2",
                    m.role === "user"
                      ? "bg-brand-soft border border-brand-soft-border"
                      : "border border-border"
                  )}
                >
                  {m.parts.map((parte, i) => {
                    if (parte.type === "text") {
                      return parte.text ? <Texto key={i} contenido={parte.text} /> : null;
                    }
                    // Botones de navegación (output validado server-side).
                    if (parte.type === "tool-sugerir_navegacion" && parte.state === "output-available") {
                      const salida = parte.output as { botones?: BotonNav[] } | undefined;
                      if (!salida?.botones?.length) return null;
                      return (
                        <span key={i} className="flex flex-col gap-1.5 pt-1">
                          {salida.botones.map((b) => (
                            <Link
                              key={b.ruta + b.label}
                              href={b.ruta}
                              onClick={() => setAbierto(false)}
                              className="flex items-center justify-between gap-2 text-[13px] font-medium text-brand border border-brand-soft-border bg-brand-soft rounded-md px-3 py-2.5 hover:bg-brand hover:text-white transition-colors"
                            >
                              {b.label}
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M5 12h14m-6-6 6 6-6 6" />
                              </svg>
                            </Link>
                          ))}
                        </span>
                      );
                    }
                    // Cualquier otra tool en curso → estado honesto.
                    if (
                      parte.type.startsWith("tool-") &&
                      "state" in parte &&
                      (parte.state === "input-streaming" || parte.state === "input-available")
                    ) {
                      const nombreTool = parte.type.slice(5);
                      return (
                        <span key={i} className="flex items-center gap-1.5 text-[13px] text-muted">
                          <span className="size-1.5 rounded-pill bg-brand animate-latido" />
                          {CONSULTANDO[nombreTool] ?? "Consultando datos"}…
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {status === "submitted" && (
              <div className="flex items-center gap-1.5 text-[13px] text-muted px-1">
                <span className="size-1.5 rounded-pill bg-brand animate-latido" />
                Pensando…
              </div>
            )}

            {error && (
              <div className="text-[13px] text-error bg-error-soft border border-error-soft-border rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-2">
                No pude responder ahora.
                <button
                  type="button"
                  onClick={() => {
                    clearError();
                    void regenerate();
                  }}
                  className="font-medium underline underline-offset-2 shrink-0"
                >
                  Reintentar
                </button>
              </div>
            )}
            <div ref={finRef} />
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(input);
            }}
            className="flex items-center gap-2 px-3 py-3 border-t border-border"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={LIMITES.caracteresInput}
              placeholder="Preguntale a Walter…"
              aria-label="Mensaje para Walter"
              className="flex-1 h-11 px-3.5 text-sm bg-surface-2 border border-border rounded-md focus:outline-2 focus:-outline-offset-1 focus:outline-brand placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={!input.trim() || ocupado}
              aria-label="Enviar"
              className="size-11 shrink-0 rounded-md bg-brand text-white flex items-center justify-center hover:bg-brand-hover active:translate-y-px transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 12 14-7-4 14-3.5-5.5L5 12Z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
