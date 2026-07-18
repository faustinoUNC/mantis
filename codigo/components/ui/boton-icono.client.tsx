"use client";

import { Button } from "@/components/ui/button";
import { ConTooltip } from "@/components/ui/con-tooltip.client";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/shared/utils/cn";

// STORY-997: acción de solo ícono (botón cuadrado 44×44) con tooltip estético.
// El `titulo` es a la vez el tooltip y el aria-label (accesibilidad). Para las
// acciones de barra/fila; los submits de formulario conservan texto.
export function BotonIcono({
  icono,
  titulo,
  variante = "secundario",
  pos = "abajo",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icono: string;
  titulo: string;
  variante?: "primario" | "secundario" | "fantasma";
  pos?: "arriba" | "abajo" | "abajo-der";
}) {
  return (
    <ConTooltip ayuda={titulo} pos={pos}>
      <Button
        variante={variante}
        aria-label={titulo}
        className={cn("px-0 aspect-square shrink-0", className)}
        {...props}
      >
        <Icono id={icono} size={18} />
      </Button>
    </ConTooltip>
  );
}
