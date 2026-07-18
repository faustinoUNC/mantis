"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonIcono } from "@/components/ui/boton-icono.client";
import { Button } from "@/components/ui/button";
import { eliminarMatriculaTecnico } from "@/features/tecnicos/service";

// Documentación cargada del técnico. Las matrículas (`doc.path` presente) se
// pueden borrar desde acá — antes solo se podían agregar, nunca sacar una
// vieja o cargada por error. El DNI no trae `path`: no es eliminable.
export function DocumentacionTecnico({
  tecnicoId,
  docs,
}: {
  tecnicoId: string;
  docs: { tipo: string; url: string; path?: string }[];
}) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function borrar(path: string) {
    setBorrando(true);
    const r = await eliminarMatriculaTecnico(tecnicoId, path);
    setBorrando(false);
    setConfirmando(null);
    if (!r.ok) alert(r.error);
    else router.refresh();
  }

  if (docs.length === 0) {
    return <p className="text-sm text-muted">Sin documentación cargada.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-3">
      {docs.map((doc) => (
        <li key={doc.tipo} className="flex items-center gap-1.5">
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border-strong text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            {doc.tipo} ↗
          </a>
          {doc.path &&
            (confirmando === doc.path ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variante="fantasma"
                  disabled={borrando}
                  className="min-h-0 h-8 px-2.5 text-sm text-error hover:text-error"
                  onClick={() => borrar(doc.path!)}
                >
                  {borrando ? "Borrando…" : "¿Confirmar?"}
                </Button>
                <Button
                  variante="fantasma"
                  disabled={borrando}
                  className="min-h-0 h-8 px-2.5 text-sm"
                  onClick={() => setConfirmando(null)}
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <BotonIcono
                icono="papelera"
                titulo="Borrar matrícula"
                variante="fantasma"
                className="text-error hover:text-error"
                onClick={() => setConfirmando(doc.path!)}
              />
            ))}
        </li>
      ))}
    </ul>
  );
}
