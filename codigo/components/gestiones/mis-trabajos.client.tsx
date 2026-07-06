"use client";

import Link from "next/link";
import { RefrescoVivo } from "@/components/refresco-vivo.client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { GestionResumen } from "@/features/gestiones/types";
import { ETAPAS } from "@/features/gestiones/types";

// CTA del técnico según etapa (una acción clara por tarjeta — EXPERIENCE.md).
// Mismo criterio que el detalle: si ya envió el presupuesto no hay acción,
// y una conformidad rechazada SÍ pide resubir.
function ctaTecnico(g: GestionResumen): string | null {
  if (g.etapa === "asignacion" && g.asignacion_aceptada === null)
    return "Responder solicitud";
  if (g.etapa === "presupuesto" && !g.presupuesto_pendiente)
    return "Cargar presupuesto";
  if (g.etapa === "en_ejecucion") return "Registrar avance";
  if (g.etapa === "conformidad" && g.conformidad_rechazada)
    return "Resubir conformidad";
  return null;
}

export function MisTrabajos({ gestiones }: { gestiones: GestionResumen[] }) {
  const activos = gestiones.filter((g) => g.etapa !== "finalizado");
  const conAccion = activos.filter((g) => ctaTecnico(g));
  const enEspera = activos.filter((g) => !ctaTecnico(g));

  return (
    <div className="animate-aparecer max-w-lg">
      <RefrescoVivo tabla="gestiones" />
      <p className="text-[13px] font-medium text-muted">Hoy</p>
      <h1 className="text-2xl font-semibold tracking-tight mt-0.5 mb-5">
        Mis trabajos
      </h1>

      {activos.length === 0 && (
        <p className="text-sm text-muted">
          No tenés trabajos asignados por ahora.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {[...conAccion, ...enEspera].map((g) => {
          const cta = ctaTecnico(g);
          return (
            <Link key={g.id} href={`/gestiones/${g.id}`} className="block">
              <Card
                className={`p-4 transition-colors hover:border-border-strong ${
                  g.urgencia === "urgente" ? "border-l-2 border-l-urgente" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge tono="neutro">{g.especialidad}</Badge>
                  {g.urgencia === "urgente" && <Badge tono="urgente">Urgente</Badge>}
                </div>
                <p className="font-medium leading-snug">{g.descripcion}</p>
                <p className="text-sm text-muted mt-1">{g.direccion}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[13px] text-muted">
                    {ETAPAS.find((e) => e.id === g.etapa)?.label}
                  </span>
                  {cta && (
                    <span className="inline-flex items-center min-h-tap px-4 rounded-md bg-brand text-white text-sm font-medium">
                      {cta} →
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
