"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";

const TABS = [
  { href: "/cartera/propiedades", label: "Propiedades" },
  { href: "/cartera/propietarios", label: "Propietarios" },
  { href: "/cartera/inquilinos", label: "Inquilinos" },
];

export function CarteraTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 mb-6 border-b border-border">
      {TABS.map((tab) => {
        const activa = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors",
              activa
                ? "border-brand text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
