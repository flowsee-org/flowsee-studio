import { ChevronDown } from "lucide-react";

/** A compact RTL select following HeroUI's clear, aligned trigger styling. */
export default function SelectControl({ className = "", children, ...props }) {
  const stretches = className.includes("w-full");
  return (
    <div className={`relative inline-flex min-w-0 ${stretches ? "w-full" : ""}`}>
      <select
        dir="rtl"
        className={`h-10 min-w-0 appearance-none rounded-xl border border-input bg-card py-2 pr-3 pl-9 text-right text-sm shadow-sm transition-colors hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-primary/30 ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
