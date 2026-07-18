import { cn } from "@/shared/utils/cn";

const TAMANOS = {
  sm: "size-7 text-[12px]",
  md: "size-8 text-xs",
  lg: "size-12 text-base",
} as const;

// Avatar de iniciales (DESIGN.md §avatar): identidad del usuario logueado.
export function Avatar({
  nombre,
  size = "md",
  className,
}: {
  nombre: string;
  size?: keyof typeof TAMANOS;
  className?: string;
}) {
  const iniciales = nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center shrink-0 rounded-pill",
        "bg-brand-soft border border-brand-soft-border text-brand-active font-semibold select-none",
        TAMANOS[size],
        className
      )}
    >
      {iniciales}
    </span>
  );
}
