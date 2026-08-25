import { cn } from "@/lib/utils";

/** Petit emblème Capella Energy — utilisé quand le logo horizontal est trop large. */
export function CapellaStar({ className }: { className?: string }) {
  return (
    <img
      src="/capella-avatar.svg"
      alt=""
      aria-hidden="true"
      className={cn("h-6 w-6 shrink-0 rounded-full object-contain", className)}
    />
  );
}

/** Logo officiel Capella Energy. */
export function Logotype({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn("w-52", className)}>
      <img
        src="/capella-logo.svg"
        alt="Capella Energy"
        className="block h-auto w-full object-contain"
      />
      {subtitle ? (
        <div className="mt-1 text-center text-xs text-grey-brand">{subtitle}</div>
      ) : null}
    </div>
  );
}
