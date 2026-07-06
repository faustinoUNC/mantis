"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/shared/lib/supabase/client";

// Refresco en vivo genérico: la vista se recarga cuando cambia la tabla
// indicada (RLS limita qué filas dispara para cada suscriptor). Patrón del
// proyecto: getSession + setAuth ANTES de suscribirse. El `filtro` opcional
// (ej. "gestion_id=eq.X") evita refrescar el detalle por actividad ajena.
export function RefrescoVivo({ tabla, filtro }: { tabla: string; filtro?: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const yaSuscripto = useRef(false);

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
        .channel(`vivo-${tabla}${filtro ? `-${filtro}` : ""}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: tabla,
            ...(filtro && { filter: filtro }),
          },
          () => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => router.refresh(), 400);
          }
        )
        .subscribe((status) => {
          if (status !== "SUBSCRIBED" || desmontado) return;
          // Reconexión (no el mount): refetch por lo perdido sin websocket
          if (yaSuscripto.current) router.refresh();
          yaSuscripto.current = true;
        });
    })();

    return () => {
      desmontado = true;
      if (timer.current) clearTimeout(timer.current);
      if (canal) supabase.removeChannel(canal);
    };
  }, [router, tabla, filtro]);

  return null;
}
