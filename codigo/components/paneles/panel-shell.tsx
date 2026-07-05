import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cerrarSesion } from "@/features/auth/service";
import { NOMBRE_ROL, type UsuarioActual } from "@/features/auth/types";
import { redirect } from "next/navigation";

// Cáscara común de los 4 paneles: header con marca, rol y salida.
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
      <header className="bg-tinta text-papel">
        <div className="franja-obra h-1" />
        <div className="flex items-center justify-between gap-3 px-4 sm:px-8 py-3">
          <div className="flex items-center gap-3">
            <span
              className="font-black uppercase tracking-tight text-lg leading-none"
              style={{ fontStretch: "125%" }}
            >
              Man<span className="text-senal-400">—</span>tis
            </span>
            <Badge tono="senal" className="hidden sm:inline-flex">
              {NOMBRE_ROL[usuario.rol]}
            </Badge>
          </div>
          <form action={salir} className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-papel/70">
              {usuario.nombre}
            </span>
            <Button
              variante="secundario"
              type="submit"
              className="min-h-0 h-9 px-3 text-sm border-papel/30 text-papel hover:bg-tinta-2 hover:border-papel/60"
            >
              Salir
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 sm:px-8 py-6">{children}</main>
    </div>
  );
}
