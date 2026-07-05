"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/shared/lib/supabase/client";

// Tablero vivo (STORY-401 v1.1.0): cuando OTRA persona crea o mueve una
// gestión, la vista se refresca sola. RLS limita la suscripción a las filas
// que este usuario puede ver (ownership del gestor incluida).
export function TableroVivo() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        .channel("tablero-vivo")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "gestiones" },
          () => {
            // Debounce: varios eventos seguidos (transición + asignación)
            // producen UN solo refresh.
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => router.refresh(), 400);
          }
        )
        .subscribe();
    })();

    return () => {
      desmontado = true;
      if (timer.current) clearTimeout(timer.current);
      if (canal) supabase.removeChannel(canal);
    };
  }, [router]);

  return null;
}
