"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Icono } from "@/components/ui/iconos";
import type { ItemNav } from "@/features/auth/types";
import { cn } from "@/shared/utils/cn";

// Navegación del staff (DESIGN.md §sidebar-nav): panel vertical a la izquierda
// con ícono + texto en desktop; en mobile, fila superior scrolleable.
// STORY-989: en desktop se puede colapsar a un rail de solo íconos.

// Store mínimo sobre localStorage vía useSyncExternalStore: el snapshot de
// servidor es "expandido" (evita mismatch de hidratación) y el toggle notifica
// a todos los sidebars montados. Sin setState-en-effect.
const CLAVE_COLAPSO = "sidebar-colapsado";
const oyentesColapso = new Set<() => void>();
function leerColapso() {
  return typeof window !== "undefined" && localStorage.getItem(CLAVE_COLAPSO) === "1";
}
function fijarColapso(valor: boolean) {
  localStorage.setItem(CLAVE_COLAPSO, valor ? "1" : "0");
  oyentesColapso.forEach((o) => o());
}
function suscribirColapso(cb: () => void) {
  oyentesColapso.add(cb);
  return () => {
    oyentesColapso.delete(cb);
  };
}

function activo(pathname: string, href: string, items: ItemNav[]) {
  // Match más específico gana (evita que "/admin" capture "/admin/empleados")
  const matches = items.filter(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
  );
  const mejor = matches.sort((a, b) => b.href.length - a.href.length)[0];
  return mejor?.href === href;
}

export function SidebarStaff({
  items,
  marca,
  campana,
  pie,
}: {
  items: ItemNav[];
  marca: React.ReactNode;
  campana: React.ReactNode;
  pie: React.ReactNode;
}) {
  const pathname = usePathname();
  const colapsado = useSyncExternalStore(suscribirColapso, leerColapso, () => false);

  function alternar() {
    fijarColapso(!colapsado);
  }

  const enlaces = (modo: "mobile" | "desktop") =>
    items.map((item) => {
      const esActivo = activo(pathname, item.href, items);
      const rail = modo === "desktop" && colapsado;
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-label={rail ? item.label : undefined}
          className={cn(
            "group/nav relative flex items-center rounded-md text-sm font-medium transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            modo === "mobile" ? "gap-2.5 px-3 min-h-tap" : rail ? "justify-center min-h-tap" : "gap-2.5 px-3 py-2",
            esActivo
              ? "bg-brand-soft text-brand-active"
              : "text-muted hover:text-foreground hover:bg-surface-2"
          )}
        >
          <Icono id={item.icono} size={17} />
          {!rail && item.label}
          {/* STORY-989 v1.1: tooltip estético en el rail (reemplaza el title
              nativo) — aparece a la derecha del ícono al hacer hover. */}
          {rail && (
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-[12px] font-medium text-background opacity-0 shadow-overlay transition-opacity duration-150 group-hover/nav:opacity-100">
              {item.label}
            </span>
          )}
        </Link>
      );
    });

  return (
    <>
      {/* Desktop: sidebar vertical fijo, colapsable a rail de íconos (STORY-989) */}
      <aside
        data-colapsado={colapsado ? "true" : undefined}
        className={cn(
          "group/side hidden md:flex flex-col shrink-0 bg-surface border-r border-border sticky top-0 h-svh py-5 z-40 transition-[width] duration-200",
          colapsado ? "w-16 px-2" : "w-56 px-3"
        )}
      >
        <div
          className={cn(
            "flex items-center mb-6",
            colapsado ? "justify-center" : "justify-between px-3"
          )}
        >
          {!colapsado && marca}
          {campana}
        </div>
        {/* Rail angosto: sin scroll (los ítems del staff entran de sobra) para
            que los tooltips a la derecha no queden recortados por el overflow. */}
        <nav
          className={cn(
            "flex flex-col gap-1 flex-1",
            colapsado ? "overflow-visible" : "overflow-y-auto"
          )}
        >
          {enlaces("desktop")}
        </nav>
        <div className="pt-4 border-t border-border">{pie}</div>
        {/* STORY-989 v1.1: la flechita para colapsar/expandir va abajo de todo. */}
        <button
          type="button"
          onClick={alternar}
          title={colapsado ? "Expandir panel" : "Colapsar panel"}
          aria-label={colapsado ? "Expandir panel" : "Colapsar panel"}
          className={cn(
            "mt-2 flex items-center min-h-tap rounded-md text-muted hover:text-foreground hover:bg-surface-2 transition-colors",
            colapsado ? "justify-center" : "justify-end px-3"
          )}
        >
          <span className={cn("flex", !colapsado && "rotate-180")}>
            <Icono id="chevron" size={18} />
          </span>
        </button>
      </aside>

      {/* Mobile: barra superior + fila de navegación scrolleable */}
      <div className="md:hidden sticky top-0 z-40 bg-surface border-b border-border">
        <div className="flex items-center justify-between px-4 h-13 py-2">
          {marca}
          <div className="flex items-center gap-1">{campana}{pie}</div>
        </div>
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {enlaces("mobile")}
        </nav>
      </div>
    </>
  );
}
