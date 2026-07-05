import { cn } from "@/shared/utils/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white rounded-caja border border-tinta/10 shadow-papel",
        className
      )}
      {...props}
    />
  );
}
