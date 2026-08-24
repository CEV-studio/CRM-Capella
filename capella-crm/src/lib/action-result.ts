/** Résultat uniforme d'une action serveur, affichable tel quel dans l'interface. */
export type ActionResult =
  | { ok: true; message: string; motDePasse?: string }
  | { ok: false; message: string };
