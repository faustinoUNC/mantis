import { cn } from "@/shared/utils/cn";

type Tono = "brand" | "urgente" | "error" | "neutro";

const tonos: Record<Tono, string> = {
  brand: "bg-brand-soft text-brand-active border-brand-soft-border",
  urgente: "bg-urgente-soft text-urgente-fuerte border-urgente-soft-border",
  error: "bg-error-soft text-error border-error-soft-border",
  neutro: "bg-surface-2 text-muted border-border",
};

export function Badge({
  tono = "neutro",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tono?: Tono }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border",
        "text-[13px] font-medium leading-5",
        tonos[tono],
        className
      )}
      {...props}
    />
  );
}
