import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DatosTecnico } from "@/components/tecnicos/datos-tecnico.client";
import { DocumentacionTecnico } from "@/components/tecnicos/documentacion-tecnico.client";
import { EspecialidadesTecnico } from "@/components/tecnicos/especialidades-tecnico.client";
import { Evaluacion } from "@/components/tecnicos/evaluacion.client";
import { listarEspecialidadesActivas } from "@/features/especialidades/service";
import { obtenerTecnico } from "@/features/tecnicos/service";

export default async function TecnicoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tecnico, catalogo] = await Promise.all([
    obtenerTecnico(id),
    listarEspecialidadesActivas(),
  ]);
  if (!tecnico) notFound();

  return (
    <div className="animate-aparecer max-w-2xl">
      <Link
        href="/tecnicos"
        className="text-sm font-medium text-muted hover:text-foreground"
      >
        ← Técnicos
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {tecnico.nombre}
        </h1>
        <Badge
          tono={
            tecnico.estado === "pendiente"
              ? "urgente"
              : tecnico.estado === "aprobado"
                ? "brand"
                : "error"
          }
        >
          {tecnico.estado === "pendiente"
            ? "Pendiente"
            : tecnico.estado === "aprobado"
              ? "Aprobado"
              : "Rechazado"}
        </Badge>
      </div>

      <div className="mt-3">
        <DatosTecnico
          tecnicoId={id}
          nombre={tecnico.nombre}
          email={tecnico.email}
          telefono={tecnico.telefono}
          cuil={tecnico.cuil}
        />
      </div>

      <EspecialidadesTecnico
        tecnicoId={id}
        actuales={tecnico.especialidad_ids}
        nombresActuales={tecnico.especialidades}
        catalogo={catalogo}
        tieneMatricula={tecnico.tieneMatricula}
      />

      <Card className="mt-6 p-5">
        <h2 className="text-[13px] font-medium text-muted mb-3">
          Documentación
        </h2>
        <DocumentacionTecnico tecnicoId={id} docs={tecnico.docs} />
      </Card>

      {tecnico.estado === "rechazado" && tecnico.motivo_rechazo && (
        <p className="mt-4 text-sm text-error bg-error-soft border border-error-soft-border rounded-md px-4 py-3">
          Rechazado: {tecnico.motivo_rechazo}
        </p>
      )}

      {/* Reintento tras rechazo (STORY-958 v2): el motivo anterior queda a
          la vista y la evaluación se habilita recién con el email verificado. */}
      {tecnico.estado === "pendiente" && tecnico.motivo_rechazo && (
        <p className="mt-4 text-sm text-urgente-fuerte bg-urgente-soft border border-urgente-soft-border rounded-md px-4 py-3">
          Reintento — rechazo anterior: {tecnico.motivo_rechazo}
        </p>
      )}

      {tecnico.estado === "pendiente" &&
        (tecnico.email_verificado ? (
          <Evaluacion tecnicoId={id} />
        ) : (
          <p className="mt-6 text-sm text-muted">
            El técnico todavía no verificó su correo — la solicitud se podrá
            evaluar cuando abra el link que le enviamos.
          </p>
        ))}
    </div>
  );
}
