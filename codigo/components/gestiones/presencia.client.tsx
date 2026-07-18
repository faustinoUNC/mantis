"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/shared/lib/supabase/client";

// Bloqueo suave por presencia (STORY-904): si otro usuario ya está
// trabajando la gestión, el que llega después ve la acción bloqueada con
// un aviso con nombre. Supabase Presence se auto-libera al cerrar la
// pestaña/perder conexión — imposible que una tarjeta quede trabada.

interface Presente {
  usuario_id: string;
  nombre: string;
  online_at: string;
}

export function PresenciaGestion({
  gestionId,
  usuarioId,
  nombre,
  children,
}: {
  gestionId: string;
  usuarioId: string;
  nombre: string;
  children: React.ReactNode;
}) {
  const [otros, setOtros] = useState<Presente[]>([]);
  const [miIngreso] = useState(() => new Date().toISOString());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let vistos = new Set<string>();

    const canal = supabase.channel(`presencia-gestion-${gestionId}`, {
      config: { presence: { key: usuarioId } },
    });

    canal
      .on("presence", { event: "sync" }, () => {
        const estado = canal.presenceState<Presente>();
        const presentes = Object.values(estado)
          .flat()
          .filter((p) => p.usuario_id !== usuarioId);
        setOtros(presentes);

        // Toast cuando entra alguien nuevo
        for (const p of presentes) {
          if (!vistos.has(p.usuario_id)) {
            vistos.add(p.usuario_id);
            setToast(`${p.nombre} también está en esta gestión`);
            setTimeout(() => setToast(null), 4000);
          }
        }
        vistos = new Set(presentes.map((p) => p.usuario_id));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await canal.track({
            usuario_id: usuarioId,
            nombre,
            online_at: miIngreso,
          } satisfies Presente);
        }
      });

    return () => {
      supabase.removeChannel(canal);
    };
  }, [gestionId, usuarioId, nombre, miIngreso]);

  // Bloquea quien llegó DESPUÉS: el primero en entrar tiene la mano.
  const dueno = otros.find((p) => p.online_at < miIngreso);

  return (
    <>
      {dueno && (
        <div className="animate-aparecer flex items-center gap-2.5 rounded-md border border-urgente-soft-border bg-urgente-soft px-4 py-3 mb-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-urgente-fuerte" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm font-medium text-urgente-fuerte">
            <strong>{dueno.nombre}</strong> está trabajando en esta gestión — las
            acciones se desbloquean cuando salga.
          </p>
        </div>
      )}
      <div
        className={dueno ? "opacity-50 pointer-events-none select-none" : undefined}
        aria-disabled={Boolean(dueno)}
      >
        {children}
      </div>

      {toast &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-toast">
            <div className="flex items-center gap-2.5 rounded-lg bg-foreground text-background px-4 py-3 shadow-overlay text-sm font-medium">
              <span className="size-2 rounded-pill bg-brand animate-latido" aria-hidden />
              {toast}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
