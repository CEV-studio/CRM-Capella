import { cn } from "@/lib/utils";

/**
 * Étoile Capella — la marque en une forme simple, dessinée en SVG
 * pour rester nette à toutes les tailles.
 */
export function CapellaStar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
      fill="none"
    >
      <path
        d="M12 1.5l2.35 7.05a1 1 0 00.63.64L22 11.5l-7.02 2.31a1 1 0 00-.63.64L12 21.5l-2.35-7.05a1 1 0 00-.63-.64L2 11.5l7.02-2.31a1 1 0 00.63-.64L12 1.5z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logotype({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CapellaStar className="h-7 w-7 text-star-500" />
      <div className="leading-tight">
        <div className="font-display text-lg font-bold tracking-tight">
          Capella <span className="text-star-500">CRM</span>
        </div>
        {subtitle ? (
          <div className="text-xs text-grey-brand">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}
