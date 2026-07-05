import Link from "next/link";
import { BloqueoWatcher } from "@/components/paneles/bloqueo-watcher.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/features/auth/service";
import {
  NAV_POR_ROL,
  NOMBRE_ROL,
  type UsuarioActual,
} from "@/features/auth/types";
import { redirect } from "next/navigation";

// Cáscara común de los 4 paneles: header claro con borde (DESIGN.md).
export function PanelShell({
  usuario,
  children,
}: {
  usuario: UsuarioActual;
  children: React.ReactNode;
}) {
  async function salir() {
    "use server";
    await cerrarSesion();
    redirect("/");
  }

  return (
    <div className="flex-1 flex flex-col">
      <BloqueoWatcher usuarioId={usuario.id} />
      <header className="bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 sm:px-8 h-14">
          <div className="flex items-center gap-5">
            <span
              className="font-black uppercase tracking-tight text-base leading-none"
              style={{ fontStretch: "125%" }}
            >
              Man<span className="text-brand">—</span>tis
            </span>
            <nav className="flex items-center gap-1">
              {NAV_POR_ROL[usuario.rol].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-2.5 py-1.5 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <Badge tono="brand" className="hidden md:inline-flex">
              {NOMBRE_ROL[usuario.rol]}
            </Badge>
          </div>
          <form action={salir} className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted">
              {usuario.nombre}
            </span>
            <Button
              variante="fantasma"
              type="submit"
              className="min-h-0 h-9 px-3 text-sm"
            >
              Salir
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6">
        {children}
      </main>
    </div>
  );
}
