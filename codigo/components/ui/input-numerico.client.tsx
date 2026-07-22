"use client";

import { Input } from "@/components/ui/input";

// STORY-1033: reemplazo de type="number" — el input nativo deja tipear
// "e", "+" y "-" ("1e5" es válido para el browser). Acá el valor solo puede
// contener dígitos, y a lo sumo un punto decimal (la coma se convierte).
function sanear(valor: string, decimales: boolean) {
  if (!decimales) return valor.replace(/\D/g, "");
  const limpio = valor.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const punto = limpio.indexOf(".");
  return punto === -1
    ? limpio
    : limpio.slice(0, punto + 1) + limpio.slice(punto + 1).replace(/\./g, "");
}

export function InputNumerico({
  decimales = true,
  onChange,
  ...props
}: React.ComponentProps<typeof Input> & { decimales?: boolean }) {
  return (
    <Input
      inputMode={decimales ? "decimal" : "numeric"}
      {...props}
      onChange={(e) => {
        e.currentTarget.value = sanear(e.currentTarget.value, decimales);
        onChange?.(e);
      }}
    />
  );
}
