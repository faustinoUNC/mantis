"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TecnicoForm } from "@/components/tecnicos/form-tecnico.client";
import type { Especialidad } from "@/features/especialidades/types";

export function EnrolamientoForm({
  especialidades,
}: {
  especialidades: Especialidad[];
}) {
  const [enviada, setEnviada] = useState(false);

  if (enviada) {
    return (
      <div className="animate-aparecer">
        <Badge tono="brand">Solicitud enviada</Badge>
        <h2 className="text-xl font-semibold tracking-tight mt-3">
          ¡Listo! Tu solicitud está en evaluación.
        </h2>
        <p className="text-[15px] text-muted mt-2 max-w-md leading-relaxed">
          El equipo de la inmobiliaria va a revisar tu documentación. Cuando te
          aprueben, vas a poder ingresar con tu correo y contraseña.
        </p>
      </div>
    );
  }

  return (
    <TecnicoForm
      especialidades={especialidades}
      modo="enrolamiento"
      onExito={() => setEnviada(true)}
    />
  );
}
