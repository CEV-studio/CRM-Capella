"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Plus, Search } from "lucide-react";

export function ProspectTopbar() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/prospection?q=${encodeURIComponent(value)}` : "/prospection");
  }

  return (
    <div className="mb-4 flex items-center gap-3">
      <Link href="/prospection" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-navy-600 hover:text-star-600">
        <ArrowLeft size={16} />
        <span className="hidden sm:inline">Retour aux prospects</span>
      </Link>

      <form onSubmit={submit} className="mx-auto hidden w-full max-w-[440px] lg:block">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un prospect, une entreprise…"
            className="h-10 w-full rounded-xl border border-navy-200 bg-white pl-9 pr-14 text-sm text-navy-900 shadow-sm placeholder:text-navy-300 focus:border-sky-capella-500 focus:outline-none focus:ring-2 focus:ring-sky-capella-100"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-navy-100 bg-navy-50 px-1.5 py-0.5 text-[10px] font-semibold text-navy-400">⌘K</span>
        </label>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Link href="/agenda" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-navy-200 bg-white text-navy-700 shadow-sm hover:bg-sky-capella-50" aria-label="Ouvrir l’agenda" title="Agenda">
          <CalendarDays size={18} />
        </Link>
        <Link href="/prospection/nouveau" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-star-500 text-white shadow-sm hover:bg-star-600" aria-label="Créer un prospect" title="Créer un prospect">
          <Plus size={19} />
        </Link>
      </div>
    </div>
  );
}
