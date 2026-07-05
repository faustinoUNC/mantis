"use client";

import { useEffect } from "react";
import { createClient } from "@/shared/lib/supabase/client";

// Expulsa al usuario en segundos si el admin lo inhabilita (STORY-104).
// Escucha su propia fila de `usuarios` por Realtime (RLS limita el alcance).
export function BloqueoWatcher({ usuarioId }: { usuarioId: string }) {
  useEffect(() => {
    const supabase = createClient();
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let desmontado = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) supabase.realtime.setAuth(session.access_token);
      if (desmontado) return;

      canal = supabase
      .channel(`bloqueo-${usuarioId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "usuarios",
          filter: `id=eq.${usuarioId}`,
        },
        async (payload) => {
          if (payload.new && payload.new.esta_activo === false) {
            await supabase.auth.signOut();
            window.location.href = "/?e=inhabilitado";
          }
        }
      )
      .subscribe();
    })();

    return () => {
      desmontado = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [usuarioId]);

  return null;
}
