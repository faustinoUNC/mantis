import { cn } from "@/shared/utils/cn";

// El borde es la elevación: sin sombras en reposo (DESIGN.md).
export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface rounded-lg border border-border", className)}
      {...props}
    />
  );
}
