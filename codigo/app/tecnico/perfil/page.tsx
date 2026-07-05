import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { miPerfilTecnico } from "@/features/tecnicos/service";

export default async function PerfilTecnicoPage() {
  const perfil = await miPerfilTecnico();
  if (!perfil) return null;

  return (
    <div className="animate-aparecer max-w-lg">
      <p className="text-[13px] font-medium text-muted">Mi cuenta</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-5">
        {perfil.nombre}
      </h1>

      <Card className="divide-y divide-border">
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium text-muted">Correo</p>
          <p className="mt-0.5">{perfil.email}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium text-muted">Teléfono</p>
          <p className="mt-0.5">{perfil.telefono ?? "—"}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium text-muted">DNI</p>
          <p className="mt-0.5 font-mono text-[14px]">{perfil.dni ?? "—"}</p>
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
        Para actualizar tus datos, contactá a la inmobiliaria.
      </p>
    </div>
  );
}
