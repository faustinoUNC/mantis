import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Evaluacion } from "@/components/tecnicos/evaluacion.client";
import { obtenerTecnico } from "@/features/tecnicos/service";

export default async function TecnicoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tecnico = await obtenerTecnico(id);
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {tecnico.nombre}
          </h1>
          <p className="text-sm text-muted mt-1">
            {tecnico.email}
            {tecnico.telefono && ` · ${tecnico.telefono}`}
            {tecnico.dni && (
              <>
                {" · DNI "}
                <span className="font-mono text-[13px]">{tecnico.dni}</span>
              </>
            )}
          </p>
        </div>
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

      <div className="mt-4 flex flex-wrap gap-1.5">
        {tecnico.especialidades.map((e) => (
          <Badge key={e} tono="neutro">
            {e}
          </Badge>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-[13px] font-medium text-muted mb-3">
          Documentación
        </h2>
        {tecnico.docs.length === 0 ? (
          <p className="text-sm text-muted">Sin documentación cargada.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {tecnico.docs.map((doc) => (
              <li key={doc.tipo}>
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border-strong text-sm font-medium hover:bg-surface-2 transition-colors"
                >
                  {doc.tipo} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {tecnico.estado === "rechazado" && tecnico.motivo_rechazo && (
        <p className="mt-4 text-sm text-error bg-error-soft border border-error-soft-border rounded-md px-4 py-3">
          Rechazado: {tecnico.motivo_rechazo}
        </p>
      )}

      {tecnico.estado === "pendiente" && <Evaluacion tecnicoId={id} />}
    </div>
  );
}
