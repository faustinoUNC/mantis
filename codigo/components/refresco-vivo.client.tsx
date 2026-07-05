"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/shared/lib/supabase/client";

// Refresco en vivo genérico: la vista se recarga cuando cambia la tabla
// indicada (RLS limita qué filas dispara para cada suscriptor). Patrón del
// proyecto: getSession + setAuth ANTES de suscribirse.
export function RefrescoVivo({ tabla }: { tabla: string }) {
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
        .channel(`vivo-${tabla}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: tabla },
          () => {
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
  }, [router, tabla]);

  return null;
}
