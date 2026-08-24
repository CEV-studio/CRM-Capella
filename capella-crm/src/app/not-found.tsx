import Link from "next/link";

export const metadata = { title: "Introuvable — Capella CRM" };

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-5xl font-bold text-star-500">404</p>
      <h1 className="mt-3 font-display text-xl font-bold text-navy-800">
        Cette page n&apos;existe pas
      </h1>
      <p className="mt-2 max-w-md text-sm text-grey-brand">
        Soit l&apos;adresse est erronée, soit cette fiche ne fait pas partie de
        tes données. Les prospects et les affaires d&apos;un autre commercial ne
        sont jamais accessibles, même en tapant leur adresse.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-star-500 px-4 text-sm font-semibold text-white hover:bg-star-600"
      >
        Revenir au tableau de bord
      </Link>
    </main>
  );
}
