"use client";

import { useState } from "react";

export function SignatureEditor({ name, initialHtml = "" }: { name: string; initialHtml?: string }) {
  const [html, setHtml] = useState(initialHtml);

  return (
    <div className="grid gap-2">
      <div
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => setHtml(event.currentTarget.innerHTML)}
        dangerouslySetInnerHTML={{ __html: initialHtml }}
        className="min-h-36 rounded-lg border border-navy-200 bg-white px-3 py-3 text-sm leading-6 text-navy-800 focus:border-star-500 focus:outline-none focus:ring-2 focus:ring-star-500/20"
      />
      <input type="hidden" name={name} value={html} />
      <p className="text-[11px] text-grey-brand">
        Tu peux écrire ici ou copier-coller une signature existante depuis Gmail : la mise en forme, les liens et les images distantes sont conservés.
      </p>
    </div>
  );
}
