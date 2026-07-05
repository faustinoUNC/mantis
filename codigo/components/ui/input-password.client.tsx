"use client";

import { useId, useState } from "react";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/shared/utils/cn";

// Campo de contraseña con ojito para revelar (pedido Fausti — en TODOS los
// passwords del sistema). Dos variantes: caja (default) y editorial (login).
export function InputPassword({
  label,
  variante = "caja",
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  variante?: "caja" | "editorial";
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="text-[13px] font-medium text-muted leading-tight"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? "text" : "password"}
          className={cn(
            variante === "editorial"
              ? "input-editorial pr-11"
              : cn(
                  "min-h-tap w-full pl-3.5 pr-11 rounded-md bg-surface text-foreground",
                  "border border-border-strong placeholder:text-muted/60",
                  "transition-colors duration-150",
                  "focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15"
                ),
            className
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center size-9 rounded-md text-muted hover:text-foreground transition-colors"
        >
          <Icono id={visible ? "ojo-cerrado" : "ojo"} size={17} />
        </button>
      </div>
    </div>
  );
}
