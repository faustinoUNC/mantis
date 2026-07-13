import { redirect } from "next/navigation";
import {
  CambiarContrasena,
  ContactoPerfil,
} from "@/components/tecnicos/perfil-tecnico.client";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icono } from "@/components/ui/iconos";
import { cerrarSesion } from "@/features/auth/service";
import { miPerfilTecnico } from "@/features/tecnicos/service";

export default async function PerfilTecnicoPage() {
  const perfil = await miPerfilTecnico();
  if (!perfil) return null;

  async function salir() {
    "use server";
    await cerrarSesion();
    redirect("/");
  }

  return (
    <div className="animate-aparecer max-w-lg">
      <p className="text-[13px] font-medium text-muted">Mi cuenta</p>
      <div className="flex items-center gap-3 mt-2 mb-5">
        <Avatar nombre={perfil.nombre} size="lg" />
        <h1 className="text-2xl font-semibold tracking-tight truncate">
          {perfil.nombre}
        </h1>
      </div>

      <Card className="divide-y divide-border">
        <ContactoPerfil email={perfil.email} telefono={perfil.telefono} />
        <CambiarContrasena />
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium text-muted">CUIL</p>
          <p className="mt-0.5 font-mono text-[14px]">{perfil.cuil ?? "—"}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium text-muted mb-1.5">
            Mis especialidades
          </p>
          <div className="flex flex-wrap gap-1.5">
            {perfil.especialidades.length === 0 && (
              <p className="text-sm text-muted">Sin especialidades cargadas.</p>
            )}
            {perfil.especialidades.map((e) => (
              <Badge key={e} tono="brand">
                {e}
              </Badge>
            ))}
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium text-muted mb-1.5">Documentación</p>
          <div className="flex gap-1.5">
            <Badge tono={perfil.tiene_dni ? "brand" : "neutro"}>
              DNI {perfil.tiene_dni ? "✓" : "pendiente"}
            </Badge>
            <Badge tono={perfil.tiene_matricula ? "brand" : "neutro"}>
              Matrícula {perfil.tiene_matricula ? "✓" : "—"}
            </Badge>
          </div>
        </div>
      </Card>

      <p className="text-[13px] text-muted mt-4">
        Para cambios de nombre, CUIL, especialidades o documentación,
        contactá a la inmobiliaria.
      </p>

      <form action={salir} className="mt-6">
        <button
          type="submit"
          className="flex items-center justify-center gap-2 w-full min-h-tap px-4 rounded-md border border-border-strong bg-surface text-sm font-medium hover:bg-surface-2 active:translate-y-px transition-colors"
        >
          <Icono id="salir" size={16} />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
