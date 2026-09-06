import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/utils";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border border-white/80 bg-white/92 p-6 shadow-soft backdrop-blur supports-[backdrop-filter]:bg-white/86",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
