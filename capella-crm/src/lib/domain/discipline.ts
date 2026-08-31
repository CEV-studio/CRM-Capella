export type DisciplineProspect = {
  id: string;
  stage: string;
  next_action: string | null;
  next_action_date: string | null;
  last_action_at: string | null;
  stage_entered_at?: string | null;
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
const DDF_STAGES = new Set(["DDF trop éloignée", "DFF trop éloigné"]);

function dateKeyParis(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateOnlyUtc(dateKey: string): number {
  const [year, month, day] = dateKey.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(dateA: string, dateB: string): number {
  return Math.floor((dateOnlyUtc(dateB) - dateOnlyUtc(dateA)) / 86_400_000);
}

function daysSince(value: string | null | undefined, today: string): number | null {
  if (!value) return null;
  return Math.max(0, daysBetween(dateKeyParis(new Date(value)), today));
}

function pluralDays(days: number) {
  return `${days} jour${days > 1 ? "s" : ""}`;
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

  if (DDF_STAGES.has(prospect.stage)) {
    if (!prospect.date_fin_contrat) {
      return { priority: 120, bucket: "maintenant", reason: "DDF manquante", detail: "Impossible de programmer la réactivation sans date de fin de contrat.", urgent: true, anomaly: true };
    }
    const daysToDdf = daysBetween(today, prospect.date_fin_contrat);
    if (daysToDdf < 0) {
      return { priority: 119, bucket: "maintenant", reason: "DDF dépassée", detail: "Le contrat est arrivé à échéance : reprendre contact immédiatement.", urgent: true, anomaly: true };
    }
    if (daysToDdf <= 180) {
      return {
        priority: 88 + Math.max(0, Math.round((180 - daysToDdf) / 20)),
        bucket: "reactiver",
        reason: daysToDdf <= 60 ? "Réactivation prioritaire" : "À réactiver",
        detail: `DDF dans ${pluralDays(daysToDdf)}.`,
        urgent: daysToDdf <= 60,
        anomaly: false,
      };
    }
    return { priority: 20, bucket: "ignore", reason: "En veille DDF", detail: `DDF dans ${pluralDays(daysToDdf)}.`, urgent: false, anomaly: false };
  }

  if (nextEvent) {
    const eventMs = new Date(nextEvent.start_at).getTime();
    const eventDay = dateKeyParis(new Date(nextEvent.start_at));
    if (eventMs < nowMs) {
      return { priority: 122, bucket: "maintenant", reason: nextEvent.kind === "rdv" ? "RDV comparatif passé" : "Rappel dépassé", detail: nextEvent.title, urgent: true, anomaly: true };
    }
    if (eventDay === today) {
      return { priority: nextEvent.kind === "rdv" ? 120 : 116, bucket: "maintenant", reason: nextEvent.kind === "rdv" ? "RDV comparatif aujourd’hui" : "Rappel aujourd’hui", detail: nextEvent.title, urgent: true, anomaly: false };
    }
  }

  if (prospect.next_action_date) {
    const delay = daysBetween(prospect.next_action_date, today);
    if (delay > 0) {
      return { priority: 118 + Math.min(delay, 4), bucket: "maintenant", reason: "Action en retard", detail: prospect.next_action || `Échéance dépassée de ${pluralDays(delay)}.`, urgent: true, anomaly: true };
    }
    if (prospect.next_action_date === today) {
      return { priority: 114, bucket: "maintenant", reason: "À faire aujourd’hui", detail: prospect.next_action, urgent: true, anomaly: false };
    }
  }

  const lastAge = daysSince(prospect.last_action_at, today);
  const stageAge = daysSince(prospect.stage_entered_at, today) ?? daysSince(prospect.created_at, today) ?? 0;
  const clientAge = daysSince(prospect.became_client_at, today);

  if (!nextEvent && !prospect.next_action && !prospect.next_action_date) {
    return { priority: 117, bucket: "maintenant", reason: "Aucune prochaine action", detail: "Ce dossier actif peut être oublié : planifier la suite maintenant.", urgent: true, anomaly: true };
  }

  if (prospect.stage === "Demande ACD") {
    const age = clientAge ?? stageAge;
    if (age >= 5) return { priority: 104 + Math.min(age, 10), bucket: "maintenant", reason: "Demande ACD qui stagne", detail: `Dans cette étape depuis ${pluralDays(age)}.`, urgent: age >= 7, anomaly: age >= 7 };
  }

  if (prospect.stage === "RDV comparatif" && stageAge >= 1) {
    return { priority: 102 + Math.min(stageAge, 7), bucket: "maintenant", reason: "Suivi après comparatif", detail: `RDV comparatif / présentation depuis ${pluralDays(stageAge)} : sécuriser la suite.`, urgent: stageAge >= 3, anomaly: stageAge >= 5 };
  }

  if (prospect.stage === "RIB" && stageAge >= 2) {
    return { priority: 98 + Math.min(stageAge, 7), bucket: "maintenant", reason: "RIB en attente", detail: `Dans cette étape depuis ${pluralDays(stageAge)}.`, urgent: stageAge >= 5, anomaly: stageAge >= 7 };
  }

  if (prospect.stage === "Demande de facture" && stageAge >= 2) {
    return { priority: 96 + Math.min(stageAge, 7), bucket: "maintenant", reason: "Facture à relancer", detail: `Facture demandée depuis ${pluralDays(stageAge)}.`, urgent: stageAge >= 4, anomaly: stageAge >= 7 };
  }

  if (prospect.stage === "Rappels" && (lastAge === null || lastAge >= 1)) {
    return { priority: 90 + Math.min(lastAge ?? 0, 5), bucket: "travail", reason: "Relance à exécuter", detail: lastAge === null ? "Aucune activité enregistrée." : `Dernière action il y a ${pluralDays(lastAge)}.`, urgent: false, anomaly: false };
  }

  if (prospect.stage === "NRP" && (lastAge === null || lastAge >= 1)) {
    return { priority: 88, bucket: "travail", reason: "Nouvelle tentative d’appel", detail: lastAge === null ? "Prospect jamais travaillé." : `Dernière action il y a ${pluralDays(lastAge)}.`, urgent: false, anomaly: false };
  }

  if (lastAge !== null && lastAge >= 4) {
    return { priority: 80 + Math.min(lastAge, 10), bucket: "travail", reason: "Dossier à reprendre", detail: `Aucune activité depuis ${pluralDays(lastAge)}.`, urgent: lastAge >= 8, anomaly: false };
  }

  return { priority: 60, bucket: "travail", reason: prospect.next_action || "À poursuivre", detail: nextEvent ? nextEvent.title : `Dans l’étape depuis ${pluralDays(stageAge)}.`, urgent: false, anomaly: false };
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
