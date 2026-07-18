"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono } from "@/components/ui/iconos";
import type { ItemNav } from "@/features/auth/types";
import { cn } from "@/shared/utils/cn";

// Navegación inferior del técnico (DESIGN.md §nav-tecnico): fija abajo,
// íconos grandes con label mínimo, targets ≥44px, safe-area del teléfono.
export function NavTecnico({ items }: { items: ItemNav[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex">
        {items.map((item) => {
          const activo =
            pathname === item.href ||
            (item.href !== "/tecnico" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-tap transition-[color,transform] active:scale-[0.985]",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                activo ? "text-brand-active" : "text-muted"
              )}
            >
              <Icono id={item.icono} size={22} strokeWidth={activo ? 2.1 : 1.8} />
              <span className={cn("text-[10px] font-medium leading-none", activo && "font-semibold")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
