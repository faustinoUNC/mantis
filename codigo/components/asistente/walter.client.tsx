"use client";

// STORY-1007 — Walter: burbuja flotante + panel de chat. Overlay del design
// contract: borde + shadow-overlay (único caso con sombra), animación
// `aparecer`, esmeralda solo como acento, targets ≥44px, voseo.
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Rol } from "@/features/auth/types";
import { CHIPS_POR_ROL, LIMITES } from "@/features/asistente/config";
import { cn } from "@/shared/utils/cn";
import type { GraficoWalter as DatosGrafico } from "@/components/asistente/grafico.client";

// STORY-1026: recharts solo se descarga cuando aparece el primer gráfico
// (el técnico no tiene la tool y no lo carga nunca).
const Grafico = dynamic(() => import("@/components/asistente/grafico.client"), {
  ssr: false,
  loading: () => <span className="block h-[170px] animate-pulse rounded-md bg-surface-2" />,
});

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
  graficar: "Armando el gráfico",
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

// Tamaño de la burbuja (size-13) y margen al que se "imanta" contra el borde.
const TAM_BURBUJA = 52;
const MARGEN = 8;

function dentroDeViewport(x: number, y: number) {
  return {
    x: Math.min(Math.max(MARGEN, x), window.innerWidth - TAM_BURBUJA - MARGEN),
    y: Math.min(Math.max(MARGEN, y), window.innerHeight - TAM_BURBUJA - MARGEN),
  };
}

// STORY-1007 v1.2: navegar en pleno streaming corta la respuesta y puede
// persistir un tool call sin resultado — al restaurar se descartan esas partes
// (el server también las filtra; acá evitamos el "Consultando…" girando eterno).
function limpiarPartesColgadas(mensajes: unknown): unknown {
  if (!Array.isArray(mensajes)) return [];
  return mensajes.map((m) =>
    m && typeof m === "object" && Array.isArray((m as { parts?: unknown[] }).parts)
      ? {
          ...m,
          parts: (m as { parts: { type?: string; state?: string }[] }).parts.filter(
            (p) =>
              typeof p?.type !== "string" ||
              !p.type.startsWith("tool-") ||
              p.state === "output-available" ||
              p.state === "output-error"
          ),
        }
      : m
  );
}

export function Walter({ rol, nombre, usuarioId }: { rol: Rol; nombre: string; usuarioId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  // STORY-1007 v1.1: la burbuja se puede arrastrar (en el técnico mobile puede
  // tapar botones) y al soltarla se imanta al borde izquierdo o derecho.
  // pos = null → posición por defecto (clases); la elegida vive en session.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [imantando, setImantando] = useState(false);
  const arrastre = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    movida: boolean;
  } | null>(null);
  // El click del navegador dispara DESPUÉS del pointerup: esta marca evita
  // que un arrastre termine abriendo el panel.
  const fueArrastre = useRef(false);

  useEffect(() => {
    // En el frame siguiente al montaje (evita el setState síncrono en efecto
    // y el mismatch de hidratación: el server no conoce sessionStorage).
    const frame = requestAnimationFrame(() => {
      try {
        const guardada = sessionStorage.getItem("walter-burbuja");
        if (guardada) {
          const { x, y } = JSON.parse(guardada) as { x: number; y: number };
          setPos(dentroDeViewport(x, y));
        }
      } catch {
        // sin posición guardada, queda la default
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function alPresionar(e: React.PointerEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    arrastre.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: r.left,
      origY: r.top,
      movida: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setImantando(false);
  }

  function alMover(e: React.PointerEvent<HTMLButtonElement>) {
    const a = arrastre.current;
    if (!a) return;
    const dx = e.clientX - a.startX;
    const dy = e.clientY - a.startY;
    // Umbral para distinguir tap de arrastre.
    if (!a.movida && Math.hypot(dx, dy) < 6) return;
    a.movida = true;
    setPos(dentroDeViewport(a.origX + dx, a.origY + dy));
  }

  function alSoltar() {
    const a = arrastre.current;
    arrastre.current = null;
    fueArrastre.current = !!a?.movida;
    if (!a?.movida) return; // fue un tap: lo maneja onClick
    setImantando(true);
    setPos((prev) => {
      if (!prev) return prev;
      const izquierda = prev.x + TAM_BURBUJA / 2 < window.innerWidth / 2;
      const destino = dentroDeViewport(
        izquierda ? MARGEN : window.innerWidth - TAM_BURBUJA - MARGEN,
        prev.y
      );
      try {
        sessionStorage.setItem("walter-burbuja", JSON.stringify(destino));
      } catch {
        // sin persistencia no pasa nada
      }
      return destino;
    });
  }

  const { messages, sendMessage, status, error, setMessages, clearError, regenerate } =
    useChat({
      transport: new DefaultChatTransport({ api: "/api/asistente" }),
    });

  // STORY-1015: PanelShell (y con él Walter) se re-monta al navegar entre
  // secciones — cada una es un layout hermano del App Router —, así que el chat,
  // que vive solo en el estado de useChat, se perdía. Lo persistimos en
  // sessionStorage (por pestaña, efímero: el alcance de una sesión de chat),
  // igual que ya se hace con la posición de la burbuja. `restaurado` evita que
  // el primer render con messages=[] pise lo guardado antes de restaurar.
  // v1.1: la clave es POR USUARIO — otro login en la misma pestaña no debe ver
  // (ni pisar) la conversación ajena.
  const claveChat = `walter-chat:${usuarioId}`;
  const restaurado = useRef(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        // Clave vieja sin usuario (previa a v1.1): se descarta, era legible
        // por cualquier login de la pestaña.
        sessionStorage.removeItem("walter-chat");
        const guardado = sessionStorage.getItem(claveChat);
        if (guardado) setMessages(limpiarPartesColgadas(JSON.parse(guardado)) as never);
      } catch {
        // sin conversación guardada, arranca vacío
      }
      restaurado.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [setMessages, claveChat]);

  useEffect(() => {
    if (!restaurado.current) return;
    try {
      if (messages.length) sessionStorage.setItem(claveChat, JSON.stringify(messages));
      else sessionStorage.removeItem(claveChat);
    } catch {
      // sin persistencia no pasa nada
    }
  }, [messages, claveChat]);

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
      {/* Burbuja (FAB). Arrastrable, con imán al borde al soltar; el tap abre.
          En técnico la posición default flota sobre la bottom-nav. */}
      {!abierto && (
        <button
          type="button"
          onClick={() => {
            // Si el gesto fue arrastre, el click posterior no debe abrir.
            if (fueArrastre.current) {
              fueArrastre.current = false;
              return;
            }
            setAbierto(true);
          }}
          onPointerDown={alPresionar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={() => {
            arrastre.current = null;
          }}
          aria-label="Abrir Walter, el asistente de MANTIS (arrastrable)"
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          className={cn(
            "fixed z-50 size-13 rounded-pill bg-brand text-white shadow-overlay",
            "flex items-center justify-center hover:bg-brand-hover",
            "touch-none select-none cursor-grab active:cursor-grabbing",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand animate-aparecer",
            !pos && (esTecnico ? "bottom-24 right-5" : "bottom-5 right-5"),
            imantando && "transition-[left,top] duration-200 ease-out"
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
                  // STORY-1015: empezar de cero es explícito y persistente.
                  try {
                    sessionStorage.removeItem(claveChat);
                  } catch {
                    // sin persistencia no pasa nada
                  }
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
                    "text-sm rounded-lg px-3.5 py-2.5 space-y-2",
                    // STORY-1026: un mensaje con gráfico usa todo el ancho del panel.
                    m.parts.some((p) => p.type === "tool-graficar" && p.state === "output-available")
                      ? "w-full"
                      : "max-w-[85%]",
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
                    // STORY-1026: gráfico calculado server-side, atado a SU
                    // mensaje (persiste con el chat, no es estado global).
                    if (parte.type === "tool-graficar" && parte.state === "output-available") {
                      const salida = parte.output as (DatosGrafico & { error?: string }) | undefined;
                      if (!salida || salida.error || !salida.serie?.length) return null;
                      return <Grafico key={i} grafico={salida} />;
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
