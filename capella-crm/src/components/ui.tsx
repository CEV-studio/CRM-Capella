import { cn } from "@/lib/utils";

/** Briques d'interface communes — design system Capella CRM. */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-navy-100 bg-white shadow-[var(--crm-shadow-sm)]",
        "transition-shadow duration-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="relative flex items-start justify-between gap-4 border-b border-navy-100 bg-gradient-to-r from-navy-50/80 via-white to-star-50/40 px-5 py-4">
      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-star-500" aria-hidden />
      <div>
        <h2 className="font-display text-base font-semibold text-navy-800">{title}</h2>
        {hint ? <p className="mt-0.5 text-sm text-grey-brand">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-star-500 text-white shadow-[0_5px_14px_rgba(232,96,48,.20)] hover:bg-star-600 hover:shadow-[0_7px_18px_rgba(232,96,48,.26)] disabled:bg-star-200 disabled:text-white/70",
    secondary: "bg-navy-800 text-white shadow-[0_5px_14px_rgba(13,27,46,.16)] hover:bg-navy-700 disabled:bg-navy-300",
    ghost: "border border-navy-200 bg-white text-navy-700 shadow-sm hover:border-navy-300 hover:bg-sky-capella-50",
  }[variant];

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold",
        "transition-all duration-150 disabled:cursor-not-allowed active:translate-y-px",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-700">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-grey-brand">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-navy-200 bg-white px-3 text-sm shadow-sm",
        "placeholder:text-navy-300 hover:border-navy-300",
        "focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/15",
        className,
      )}
      {...props}
    />
  );
}

/** Pastille d'étape, renforcée pour être identifiable instantanément. */
export function StageBadge({ label, color, className }: { label: string; color: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-navy-200/60 px-2.5 py-1",
        "whitespace-nowrap text-[11px] font-bold text-navy-800 shadow-sm",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-navy-700/70" aria-hidden />
      {label}
    </span>
  );
}

/** Tuile KPI : plus de profondeur, sans surcharger de couleur. */
export function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="group relative overflow-hidden px-5 py-4 hover:shadow-[var(--crm-shadow-card)]">
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy-800 via-sky-capella-500 to-star-500 opacity-85" aria-hidden />
      <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-grey-brand">{label}</div>
      <div className="tabular mt-2 font-display text-2xl font-bold text-navy-800">
        {value}
      </div>
      <div className="mt-2 h-0.5 w-8 rounded-full bg-star-500 transition-all duration-200 group-hover:w-14" aria-hidden />
      {hint ? <div className="mt-2 text-xs text-grey-brand">{hint}</div> : null}
    </Card>
  );
}
