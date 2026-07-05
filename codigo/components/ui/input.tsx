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
      <label
        htmlFor={inputId}
        className="text-[13px] font-medium text-muted leading-tight"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={cn(
          "min-h-tap w-full px-3.5 rounded-md bg-surface text-foreground",
          "border border-border-strong",
          "placeholder:text-muted/60",
          "transition-colors duration-150",
          "focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15",
          className
        )}
        {...props}
      />
    </div>
  );
}
