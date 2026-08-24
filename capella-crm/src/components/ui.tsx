import { cn } from "@/lib/utils";

/** Briques d'interface communes. Une seule définition, réutilisée partout. */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-navy-100 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-5 py-4">
      <div>
        <h2 className="font-display text-base font-semibold text-navy-800">
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-sm text-grey-brand">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  const styles = {
    primary:
      "bg-star-500 text-white hover:bg-star-600 disabled:bg-star-200 disabled:text-white/70",
    secondary:
      "bg-navy-800 text-white hover:bg-navy-700 disabled:bg-navy-300",
    ghost:
      "bg-transparent text-navy-700 hover:bg-navy-50 border border-navy-200",
  }[variant];

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4",
        "text-sm font-semibold transition-colors",
        "disabled:cursor-not-allowed",
        styles,
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy-700">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-grey-brand">{hint}</span> : null}
    </label>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-navy-200 bg-white px-3 text-sm",
        "placeholder:text-navy-300",
        "focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/20",
        className,
      )}
      {...props}
    />
  );
}

/** Pastille d'étape, colorée selon le code couleur du CRM. */
export function StageBadge({
  label,
  color,
  className,
}: {
  label: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5",
        "text-xs font-semibold text-navy-800 whitespace-nowrap",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

/** Tuile de KPI : gros chiffre orange, libellé gris — comme le cockpit actuel. */
export function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-grey-brand">
        {label}
      </div>
      <div className="tabular mt-1 font-display text-2xl font-bold text-star-500">
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-grey-brand">{hint}</div> : null}
    </Card>
  );
}
