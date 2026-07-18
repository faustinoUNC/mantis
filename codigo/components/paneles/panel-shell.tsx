import Link from "next/link";
import { BloqueoWatcher } from "@/components/paneles/bloqueo-watcher.client";
import { Campana } from "@/components/paneles/campana.client";
import { NavTecnico } from "@/components/paneles/nav-tecnico.client";
import { SidebarStaff } from "@/components/paneles/sidebar.client";
import { Avatar } from "@/components/ui/avatar";
import { Icono } from "@/components/ui/iconos";
import { cerrarSesion } from "@/features/auth/service";
import {
  NAV_POR_ROL,
  NOMBRE_ROL,
  type UsuarioActual,
} from "@/features/auth/types";
import { misNotificaciones } from "@/features/notificaciones/service";
import { redirect } from "next/navigation";

function Marca() {
  return (
    <span
      className="font-black uppercase tracking-tight text-base leading-none"
      style={{ fontStretch: "125%" }}
    >
      Man<span className="text-brand">—</span>tis
    </span>
  );
}

// Cáscara de los paneles (DESIGN.md): staff con sidebar vertical (ícono +
// texto); técnico con header mínimo y navegación inferior de íconos.
export async function PanelShell({
  usuario,
  children,
  anchoCompleto,
}: {
  usuario: UsuarioActual;
  children: React.ReactNode;
  anchoCompleto?: boolean;
}) {
  const notificaciones = await misNotificaciones();
  const items = NAV_POR_ROL[usuario.rol];

  async function salir() {
    "use server";
    await cerrarSesion();
    redirect("/");
  }

  const botonSalir = (
    <form action={salir}>
      <button
        type="submit"
        aria-label="Salir"
        title="Salir"
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium text-muted hover:text-foreground hover:bg-surface-2 transition-colors group-data-[colapsado=true]/side:justify-center group-data-[colapsado=true]/side:px-0"
      >
        <Icono id="salir" size={17} />
        <span className="md:inline hidden group-data-[colapsado=true]/side:hidden">Salir</span>
      </button>
    </form>
  );

  if (usuario.rol === "tecnico") {
    return (
      <div className="flex-1 flex flex-col">
        <BloqueoWatcher usuarioId={usuario.id} />
        <header className="sticky top-0 z-40 bg-surface border-b border-border">
          <div className="flex items-center justify-between px-4 h-13 py-2.5">
            <Marca />
            <div className="flex items-center gap-1.5">
              <Campana usuarioId={usuario.id} iniciales={notificaciones} />
              {/* Cerrar sesión vive en Perfil — el header queda limpio */}
              <Link
                href="/tecnico/perfil"
                aria-label="Mi cuenta"
                className="rounded-pill transition-transform active:scale-95"
              >
                <Avatar nombre={usuario.nombre} size="sm" />
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 pb-28">{children}</main>
        <NavTecnico items={items} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row">
      <BloqueoWatcher usuarioId={usuario.id} />
      {/* key en los slots: al cruzar la frontera server→client se pierde la
          optimización de hijos estáticos y React los valida como lista */}
      <SidebarStaff
        items={items}
        marca={<Marca key="marca" />}
        campana={<Campana key="campana" usuarioId={usuario.id} iniciales={notificaciones} />}
        pie={
          <div key="pie" className="flex md:flex-col md:gap-3 items-center md:items-stretch">
            <div className="hidden md:flex items-center gap-2.5 px-3 min-w-0 group-data-[colapsado=true]/side:justify-center group-data-[colapsado=true]/side:px-0">
              <Avatar nombre={usuario.nombre} size="md" />
              <div className="min-w-0 group-data-[colapsado=true]/side:hidden">
                <p className="text-sm font-medium truncate">{usuario.nombre}</p>
                <p className="text-[12px] text-muted truncate">
                  {NOMBRE_ROL[usuario.rol]}
                </p>
              </div>
            </div>
            {botonSalir}
          </div>
        }
      />
      <main className="flex-1 min-w-0 px-4 md:px-8 py-6">
        {anchoCompleto ? children : <div className="max-w-6xl mx-auto">{children}</div>}
      </main>
    </div>
  );
}
