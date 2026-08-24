"use client";

import { useEffect } from "react";

/**
 * Mémorise la dernière vue choisie (Liste ou Kanban) dans un cookie, pour la
 * retrouver en revenant sur la prospection depuis le menu. Ne rend rien.
 */
export function MemoVue({ vue }: { vue: "liste" | "kanban" }) {
  useEffect(() => {
    document.cookie = `prospection_vue=${vue}; path=/; max-age=31536000; samesite=lax`;
  }, [vue]);
  return null;
}
