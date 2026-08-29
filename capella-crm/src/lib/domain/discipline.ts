export type DisciplineProspect = {
  id: string;
  stage: string;
  next_action: string | null;
  next_action_date: string | null;
  last_action_at: string | null;
  date_fin_contrat: string | null;
  became_client_at?: string | null;
  created_at: string;
};

export type DisciplineEvent = {
  prospect_id: string;
  kind: "rdv" | "rappel";
  title: string;
  start_at: string;
  end_at: string;
};

export type DisciplineResult = {
  priority: number;
  bucket: "maintenant" | "travail" | "reactiver" | "ignore";
  reason: string;
  detail: string | null;
  urgent: boolean;
  anomaly: boolean;
};

const CLOSED_STAGES = new Set(["KO", "Numéro KO", "Pas intéressé"]);

function dateKeyParis(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function startOfParisDay(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00+02:00`).getTime();
}

function daysBetween(dateA: string, dateB: string): number {
  return Math.floor((startOfParisDay(dateB) - startOfParisDay(dateA)) / 86_400_000);
}

function daysSince(value: string | null | undefined, today: string): number | null {
  if (!value) return null;
  const key = dateKeyParis(new Date(value));
  return Math.max(0, daysBetween(key, today));
}

export function evaluateDiscipline(
  prospect: DisciplineProspect,
  nextEvent: DisciplineEvent | null,
  now = new Date(),
): DisciplineResult {
  const today = dateKeyParis(now);
  const nowMs = now.getTime();

  if (CLOSED_STAGES.has(prospect.stage)) {
    return { priority: 0, bucket: "ignore", reason: "Dossier clos", detail: null, urgent: false, anomaly: false };
  }

  if (prospect.stage === "DDF trop éloignée") {
    if (!prospect.date_fin_contrat) {
      return { priority: 108, bucket: "maintenant", reason: "DDF manquante", detail: "Impossible de programmer la réactivation sans date de fin de contrat.", urgent: true, anomaly: true };
    }
    const daysToDdf = daysBetween(today, prospect.date_fin_contrat);
    if (daysToDdf < 0) {
      return { priority: 112, bucket: "maintenant", reason: "DDF dépassée", detail: "Le contrat est arrivé à échéance : reprendre contact immédiatement.", urgent: true, anomaly: true };
    }
    if (daysToDdf <= 180) {
      return { priority: 88 + Math.max(0, Math.round((180 - daysToDdf) / 30)), bucket: "reactiver", reason: "À réactiver", detail: `DDF dans ${daysToDdf} jour${daysToDdf > 1 ? "s" : ""}.`, urgent: daysToDdf <= 60, anomaly: false };
    }
    return { priority: 20, bucket: "ignore", reason: "En veille DDF", detail: `DDF dans ${daysToDdf} jours.`, urgent: false, anomaly: false };
  }

  if (nextEvent) {
    const eventMs = new Date(nextEvent.start_at).getTime();
    const eventDay = dateKeyParis(new Date(nextEvent.start_at));
    if (eventMs < nowMs) {
      return { priority: 118, bucket: "maintenant", reason: nextEvent.kind === "rdv" ? "RDV comparatif passé" : "Rappel dépassé", detail: nextEvent.title, urgent: true, anomaly: true };
    }
    if (eventDay === today) {
      return { priority: nextEvent.kind === "rdv" ? 116 : 112, bucket: "maintenant", reason: nextEvent.kind === "rdv" ? "RDV comparatif aujourd’hui" : "Rappel aujourd’hui", detail: nextEvent.title, urgent: true, anomaly: false };
    }
  }

  if (prospect.next_action_date) {
    const delay = daysBetween(prospect.next_action_date, today);
    if (delay > 0) {
      return { priority: 114 + Math.min(delay, 4), bucket: "maintenant", reason: "Action en retard", detail: prospect.next_action || `Échéance dépassée de ${delay} jours.`, urgent: true, anomaly: true };
    }
    if (prospect.next_action_date === today) {
      return { priority: 108, bucket: "maintenant", reason: "À faire aujourd’hui", detail: prospect.next_action, urgent: true, anomaly: false };
    }
  }

  const lastAge = daysSince(prospect.last_action_at, today);
  const clientAge = daysSince(prospect.became_client_at, today);

  if (!nextEvent && !prospect.next_action && !prospect.next_action_date) {
    return { priority: 110, bucket: "maintenant", reason: "Aucune prochaine action", detail: "Ce dossier actif peut être oublié : planifier la suite maintenant.", urgent: true, anomaly: true };
  }

  if (prospect.stage === "Demande ACD" && clientAge !== null && clientAge >= 5) {
    return { priority: 100 + Math.min(clientAge, 10), bucket: "maintenant", reason: "Demande ACD qui stagne", detail: `Entré en Demande ACD il y a ${clientAge} jours.`, urgent: clientAge >= 7, anomaly: clientAge >= 7 };
  }

  if (prospect.stage === "RDV comparatif" && (lastAge ?? 0) >= 1) {
    return { priority: 98 + Math.min(lastAge ?? 0, 5), bucket: "maintenant", reason: "Suivi après comparatif", detail: `Aucune action depuis ${lastAge} jour${lastAge && lastAge > 1 ? "s" : ""}.`, urgent: (lastAge ?? 0) >= 3, anomaly: (lastAge ?? 0) >= 3 };
  }

  if (prospect.stage === "RIB" && (lastAge ?? 0) >= 2) {
    return { priority: 94 + Math.min(lastAge ?? 0, 5), bucket: "maintenant", reason: "RIB en attente", detail: `Dossier sans action depuis ${lastAge} jours.`, urgent: (lastAge ?? 0) >= 5, anomaly: (lastAge ?? 0) >= 5 };
  }

  if (prospect.stage === "Demande de facture" && (lastAge ?? 0) >= 2) {
    return { priority: 92 + Math.min(lastAge ?? 0, 5), bucket: "maintenant", reason: "Facture à relancer", detail: `Demande sans action depuis ${lastAge} jours.`, urgent: (lastAge ?? 0) >= 5, anomaly: false };
  }

  if (prospect.stage === "NRP" && (lastAge === null || lastAge >= 1)) {
    return { priority: 84, bucket: "travail", reason: "Nouvelle tentative d’appel", detail: lastAge === null ? "Prospect jamais travaillé." : `Dernière action il y a ${lastAge} jour${lastAge > 1 ? "s" : ""}.`, urgent: false, anomaly: false };
  }

  if (lastAge !== null && lastAge >= 4) {
    return { priority: 78 + Math.min(lastAge, 8), bucket: "travail", reason: "Dossier à reprendre", detail: `Aucune activité depuis ${lastAge} jours.`, urgent: lastAge >= 8, anomaly: false };
  }

  return { priority: 60, bucket: "travail", reason: prospect.next_action || "À poursuivre", detail: nextEvent ? nextEvent.title : null, urgent: false, anomaly: false };
}

export function formatParisDateTime(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value)).replace(",", " ·");
}
