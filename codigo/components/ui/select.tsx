import { cn } from "@/shared/utils/cn";
import { useId } from "react";

export function Select({
  label,
  className,
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className="text-[13px] font-medium text-muted leading-tight"
      >
        {label}
      </label>
      <select
        id={selectId}
        className={cn(
          "min-h-tap w-full px-3 rounded-md bg-surface text-foreground",
          "border border-border-strong",
          "transition-colors duration-150",
          "focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
