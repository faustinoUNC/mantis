"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TecnicoForm } from "@/components/tecnicos/form-tecnico.client";
import type { Especialidad } from "@/features/especialidades/types";

export function RegistroTecnicoForm({
  especialidades,
}: {
  especialidades: Especialidad[];
}) {
  const [enviada, setEnviada] = useState(false);

  if (enviada) {
    return (
      <div className="animate-aparecer">
        <Badge tono="brand">Falta un paso</Badge>
        <h2 className="text-xl font-semibold tracking-tight mt-3">
          Revisá tu correo para confirmar tu dirección.
        </h2>
        <p className="text-[15px] text-muted mt-2 max-w-md leading-relaxed">
          Te mandamos un email con un link de verificación. Cuando lo abras,
          tu solicitud le llega al equipo de la inmobiliaria — y al aprobarte
          te enviamos otro correo para crear tu contraseña.
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
