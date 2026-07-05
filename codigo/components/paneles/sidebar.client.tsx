"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import type { ItemNav } from "@/features/auth/types";
import { cn } from "@/shared/utils/cn";

// Navegación del staff (DESIGN.md §sidebar-nav): panel vertical a la izquierda
// con ícono + texto en desktop; en mobile, fila superior scrolleable.

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

  const enlaces = (compacto: boolean) =>
    items.map((item) => {
      const esActivo = activo(pathname, item.href, items);
      return (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors shrink-0",
            compacto ? "px-3 min-h-tap" : "px-3 py-2",
            esActivo
              ? "bg-brand-soft text-brand-active"
              : "text-muted hover:text-foreground hover:bg-surface-2"
          )}
        >
          <Icono id={item.icono} size={17} />
          {item.label}
        </Link>
      );
    });

  return (
    <>
      {/* Desktop: sidebar vertical fijo */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-surface border-r border-border sticky top-0 h-svh px-3 py-5">
        <div className="flex items-center justify-between px-3 mb-6">
          {marca}
          {campana}
        </div>
        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {enlaces(false)}
        </nav>
        <div className="pt-4 border-t border-border">{pie}</div>
      </aside>

      {/* Mobile: barra superior + fila de navegación scrolleable */}
      <div className="md:hidden sticky top-0 z-40 bg-surface border-b border-border">
        <div className="flex items-center justify-between px-4 h-13 py-2">
          {marca}
          <div className="flex items-center gap-1">{campana}{pie}</div>
        </div>
        <nav className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {enlaces(true)}
        </nav>
      </div>
    </>
  );
}
