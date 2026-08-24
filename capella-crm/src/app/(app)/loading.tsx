/**
 * Affiché instantanément par Next.js pendant le chargement d'un écran connecté.
 * Les vraies données ne sont jamais mises en cache ici : seul le squelette
 * visuel est présenté, puis remplacé par la page sécurisée dès qu'elle arrive.
 */
export default function ChargementApplication() {
  return (
    <main
      aria-busy="true"
      aria-label="Chargement de la page"
      className="w-full animate-pulse px-6 py-8"
    >
      <div className="h-8 w-52 rounded-lg bg-navy-100" />
      <div className="mt-2 h-4 w-80 max-w-full rounded bg-navy-50" />

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-28 rounded-xl border border-navy-100 bg-white p-5 shadow-sm"
          >
            <div className="h-3 w-24 rounded bg-navy-100" />
            <div className="mt-4 h-7 w-20 rounded bg-star-100" />
          </div>
        ))}
      </div>

      <div className="mt-7 overflow-hidden rounded-xl border border-navy-100 bg-white shadow-sm">
        <div className="h-12 bg-navy-800" />
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex gap-5 border-t border-navy-100 px-5 py-4">
            <div className="h-3 w-1/4 rounded bg-navy-100" />
            <div className="h-3 w-1/5 rounded bg-navy-50" />
            <div className="h-3 w-1/6 rounded bg-navy-50" />
          </div>
        ))}
      </div>

      <p role="status" className="sr-only">
        Chargement de la page…
      </p>
    </main>
  );
}
