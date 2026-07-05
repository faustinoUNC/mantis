import { cn } from "@/shared/utils/cn";
import { useId } from "react";

export function Input({
  label,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="etiqueta text-neutral-600">
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "min-h-tap w-full px-3.5 rounded-caja bg-white text-tinta",
          "border border-tinta/20 shadow-hundido",
          "placeholder:text-neutral-400",
          "transition-colors duration-150",
          "focus:outline-none focus:border-mantis-600 focus:ring-2 focus:ring-mantis-600/20",
          className
        )}
        {...props}
      />
    </div>
  );
}
