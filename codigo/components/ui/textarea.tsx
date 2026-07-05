import { cn } from "@/shared/utils/cn";
import { useId } from "react";

export function Textarea({
  label,
  className,
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={areaId}
        className="text-[13px] font-medium text-muted leading-tight"
      >
        {label}
      </label>
      <textarea
        id={areaId}
        rows={3}
        className={cn(
          "w-full px-3.5 py-2.5 rounded-md bg-surface text-foreground",
          "border border-border-strong placeholder:text-muted/60",
          "transition-colors duration-150 resize-y",
          "focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15",
          className
        )}
        {...props}
      />
    </div>
  );
}
