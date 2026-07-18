"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  marcarLeidas,
  misNotificaciones,
  type Notificacion,
} from "@/features/notificaciones/service";
import { createClient } from "@/shared/lib/supabase/client";
import { cn } from "@/shared/utils/cn";

function hace(fecha: string) {
  const min = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d`;
}

export function Campana({
  usuarioId,
  iniciales,
}: {
  usuarioId: string;
  iniciales: Notificacion[];
}) {
  const [items, setItems] = useState(iniciales);
  const [abierta, setAbierta] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  // La campana se monta 2 veces (sidebar desktop + barra mobile): cada
  // instancia necesita su propio canal o la segunda revienta con
  // "cannot add postgres_changes callbacks after subscribe()". useId da un
  // id estable por instancia y SSR-safe (sin impureza en render).
  const instancia = useId();
  const noLeidas = items.filter((n) => !n.leida_en).length;

  // Entrega realtime (RLS limita la suscripción a las propias filas).
  // En cada SUBSCRIBED (primera vez y reconexiones) se refetchean las
  // últimas: lo que pasó con el websocket caído no se pierde.
  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let desmontado = false;

    (async () => {
      // El socket debe llevar el JWT del usuario: sin esto la suscripción
      // entra como anon y RLS (bien) no entrega nada.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) supabase.realtime.setAuth(session.access_token);
      if (desmontado) return;

      canal = supabase
        .channel(`notif-${usuarioId}-${instancia}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notificaciones",
            filter: `usuario_id=eq.${usuarioId}`,
          },
          (payload) => {
            setItems((prev) => [payload.new as Notificacion, ...prev].slice(0, 30));
          }
        )
        .subscribe(async (status) => {
          if (status !== "SUBSCRIBED") return;
          const frescas = await misNotificaciones();
          if (!desmontado) setItems(frescas);
        });
    })();

    return () => {
      desmontado = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [usuarioId, instancia]);

  useEffect(() => {
    function cerrar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierta(false);
    }
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const ANCHO_PANEL = 320;

  async function alternar() {
    const abriendo = !abierta;
    if (abriendo && botonRef.current) {
      const r = botonRef.current.getBoundingClientRect();
      // Alineado al botón, sin salirse del viewport por ninguno de los lados
      const left = Math.max(8, Math.min(r.right - ANCHO_PANEL, window.innerWidth - ANCHO_PANEL - 8));
      setPos({ top: r.bottom + 8, left });
    }
    setAbierta(abriendo);
    if (abriendo && noLeidas > 0) {
      await marcarLeidas();
      const ahora = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, leida_en: n.leida_en ?? ahora })));
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={botonRef}
        type="button"
        onClick={alternar}
        aria-label={`Notificaciones${noLeidas ? ` (${noLeidas} sin leer)` : ""}`}
        className="relative flex items-center justify-center size-11 rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {/* Campana en SVG propio (sin librerías de íconos — Regla #0) */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-pill bg-brand text-white text-[10px] font-semibold flex items-center justify-center animate-aparecer">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierta && (
        <div
          className="animate-aparecer fixed w-80 max-h-96 overflow-y-auto bg-surface border border-border rounded-lg shadow-overlay z-50"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="text-[13px] font-medium text-muted px-4 py-2.5 border-b border-border">
            Notificaciones
          </p>
          {items.length === 0 ? (
            <p className="text-sm text-muted px-4 py-6 text-center">
              Nada por acá todavía.
            </p>
          ) : (
            items.map((n) => {
              const contenido = (
                <div
                  className={cn(
                    "px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2/60 transition-colors",
                    !n.leida_en && "bg-brand-soft/40"
                  )}
                >
                  <p className="text-sm font-medium leading-snug">{n.titulo}</p>
                  {n.cuerpo && (
                    <p className="text-[13px] text-muted mt-0.5 line-clamp-2">{n.cuerpo}</p>
                  )}
                  <p className="font-mono text-[12px] text-muted mt-1">{hace(n.creado_en)}</p>
                </div>
              );
              return n.ruta ? (
                <Link key={n.id} href={n.ruta} onClick={() => setAbierta(false)} className="block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
                  {contenido}
                </Link>
              ) : (
                <div key={n.id}>{contenido}</div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
