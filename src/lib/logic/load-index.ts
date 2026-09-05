import type { ParkingLot } from '$lib/adapters/parking';
import type { RoadStatus } from '$lib/adapters/traffic';
import { weatherScore, type Weather } from '$lib/adapters/weather';

/**
 * Belastungs-Index: eine Tageskennzahl von 0 bis 100.
 *
 * Grundsaetze:
 *  - Jeder Faktor hat ein festes, offengelegtes Gewicht.
 *  - Was nicht messbar ist, wird nicht geschaetzt. Fehlt ein Faktor, wird sein
 *    Gewicht auf die uebrigen verteilt - der Index bleibt vergleichbar, ohne
 *    dass ein Wert erfunden wird.
 *  - Jeder Faktor liefert seine Begruendung mit, damit die Oberflaeche die
 *    komplette Rechnung anzeigen kann.
 *
 * Bewusste Grenze: Die Auslastung auf Compatsch fliesst NICHT ein, weil es
 * dafuer keine offenen Livedaten gibt. Der Index bildet damit vor allem das
 * Dorf ab, nicht die Alm. Die Oberflaeche muss das benennen.
 */

export type FactorId = 'parking' | 'road' | 'weather' | 'season' | 'weekday';

export interface Factor {
  id: FactorId;
  /** i18n-Schluessel der Bezeichnung. */
  labelKey: string;
  /** Vorgesehenes Gewicht, Summe aller = 1. */
  baseWeight: number;
  /** Tatsaechlich angewandtes Gewicht nach Umverteilung. */
  effectiveWeight: number;
  /** Teilbewertung 0 bis 100, oder null wenn kein Wert vorliegt. */
  score: number | null;
  /** Beitrag zum Gesamtindex in Punkten. */
  contribution: number;
  /** Kurze Begruendung im Klartext, z. B. "215 von 315 Plaetzen belegt". */
  detail: string;
  /**
   * true, wenn dieser Faktor auf einer festen Annahme beruht statt auf einer
   * Messung. Die Oberflaeche kennzeichnet solche Faktoren.
   */
  assumption?: boolean;
  /** true, wenn der Faktor eine Vorhersage ist - weder Messung noch Annahme. */
  forecast?: boolean;
}

export interface LoadIndex {
  /** Gesamtwert 0 bis 100, gerundet. null wenn kein einziger Faktor vorliegt. */
  value: number | null;
  /** i18n-Schluessel der Einstufung, z. B. "load.busy". */
  levelKey: string;
  factors: Factor[];
  /** Anteil der Gewichte, die auf echten Messwerten beruhen. */
  measuredShare: number;
}

/**
 * Saisonannahme je Monat, 0 bis 100.
 *
 * Das ist KEINE Messung, sondern eine feste Tabelle, die den bekannten
 * Jahresverlauf im Schlerngebiet abbildet: Hochsommer und Weihnachten/Fasching
 * am staerksten, November und die Wochen nach Ostern am schwaechsten.
 * Sie ist bewusst grob gehalten und in der Oberflaeche als Annahme
 * gekennzeichnet. Wer sie aendert, aendert damit den Index - deshalb steht sie
 * hier an einer Stelle und nicht verteilt im Code.
 */
const SAISON_JE_MONAT: Record<number, number> = {
  1: 70, // Januar - Wintersaison
  2: 80, // Februar - Fasching, Hochbetrieb
  3: 65, // Maerz - auslaufende Wintersaison
  4: 30, // April - Zwischensaison
  5: 40, // Mai - Beginn Sommersaison
  6: 60, // Juni
  7: 85, // Juli - Hochsommer
  8: 100, // August - Jahreshoechststand
  9: 75, // September - Wandersaison, Kastelruther Spatzenfest
  10: 55, // Oktober - Almabtrieb, auslaufend
  11: 15, // November - Betriebsruhe
  12: 75 // Dezember - Weihnachten, Saisonstart
};

const BASE_WEIGHTS: Record<FactorId, number> = {
  parking: 0.35,
  road: 0.2,
  weather: 0.2,
  season: 0.15,
  weekday: 0.1
};

function localParts(now: Date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  });
  const parts = Object.fromEntries(f.formatToParts(now).map((p) => [p.type, p.value]));
  const month = Number(parts.month);
  // getUTCDay auf Basis des lokalen Datums, um Zeitzonen-Verschiebungen
  // am Tagesrand zu vermeiden.
  const dow = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`).getUTCDay();
  return { month, dow, date: `${parts.year}-${parts.month}-${parts.day}` };
}

function parkingFactor(lots: ParkingLot[] | null): { score: number | null; detail: string } {
  if (!lots || lots.length === 0) return { score: null, detail: '' };
  const usable = lots.filter((l) => l.occupied !== null);
  if (usable.length === 0) return { score: null, detail: '' };

  const occupied = usable.reduce((s, l) => s + (l.occupied ?? 0), 0);
  const capacity = usable.reduce((s, l) => s + l.capacity, 0);
  if (capacity === 0) return { score: null, detail: '' };

  const ratio = occupied / capacity;
  return {
    score: Math.round(Math.min(1, ratio) * 100),
    detail: `${occupied} / ${capacity}`
  };
}

function roadFactor(road: RoadStatus | null): { score: number | null; detail: string } {
  if (!road || road.state === 'unknown') return { score: null, detail: '' };
  // Eine aktive Sperre ist das staerkste Signal fuer Andrang: sie wird genau
  // dann verhaengt, wenn die Alm den Verkehr nicht mehr aufnimmt.
  switch (road.state) {
    case 'closed':
      return { score: 100, detail: 'closed' };
    case 'restricted':
      return { score: 60, detail: 'restricted' };
    case 'open':
      // Ausserhalb der Sperrsaison ist "offen" ein Ruhesignal, innerhalb der
      // Saison nur eine Momentaufnahme vor oder nach dem Sperrfenster.
      return { score: road.seasonActive ? 40 : 10, detail: 'open' };
  }
}

function weatherFactor(weather: Weather | null): { score: number | null; detail: string } {
  const day = weather?.days[0];
  if (!day) return { score: null, detail: '' };
  // Der Tag, auf den sich die Vorhersage bezieht, wird mitgegeben - fehlt der
  // heutige in der Reihe, sieht der Leser, dass es der morgige ist.
  return { score: weatherScore(day), detail: day.date };
}

function seasonFactor(month: number): { score: number; detail: string } {
  return { score: SAISON_JE_MONAT[month] ?? 50, detail: String(month) };
}

function weekdayFactor(dow: number): { score: number; detail: string } {
  // 0 = Sonntag. Samstag ist Anreisetag, Sonntag Ausflugstag.
  const table: Record<number, number> = { 0: 85, 1: 40, 2: 35, 3: 35, 4: 45, 5: 65, 6: 95 };
  return { score: table[dow] ?? 50, detail: String(dow) };
}

export function levelKeyFor(value: number): string {
  if (value < 20) return 'load.veryQuiet';
  if (value < 40) return 'load.quiet';
  if (value < 60) return 'load.normal';
  if (value < 75) return 'load.busy';
  if (value < 90) return 'load.veryBusy';
  return 'load.extreme';
}

export function computeLoadIndex(
  input: { parking: ParkingLot[] | null; road: RoadStatus | null; weather?: Weather | null },
  now: Date = new Date()
): LoadIndex {
  const { month, dow } = localParts(now);

  const raw: {
    id: FactorId;
    labelKey: string;
    score: number | null;
    detail: string;
    assumption?: boolean;
    forecast?: boolean;
  }[] = [
    { id: 'parking', labelKey: 'load.factorParking', ...parkingFactor(input.parking) },
    { id: 'road', labelKey: 'load.factorRoad', ...roadFactor(input.road) },
    { id: 'weather', labelKey: 'load.factorWeather', ...weatherFactor(input.weather ?? null), forecast: true },
    { id: 'season', labelKey: 'load.factorSeason', ...seasonFactor(month), assumption: true },
    { id: 'weekday', labelKey: 'load.factorWeekday', ...weekdayFactor(dow), assumption: true }
  ];

  const present = raw.filter((f) => f.score !== null);
  const availableWeight = present.reduce((s, f) => s + BASE_WEIGHTS[f.id], 0);

  if (present.length === 0 || availableWeight === 0) {
    return {
      value: null,
      levelKey: 'common.noData',
      measuredShare: 0,
      factors: raw.map((f) => ({
        ...f,
        baseWeight: BASE_WEIGHTS[f.id],
        effectiveWeight: 0,
        contribution: 0
      }))
    };
  }

  const factors: Factor[] = raw.map((f) => {
    const base = BASE_WEIGHTS[f.id];
    // Fehlende Faktoren geben ihr Gewicht anteilig an die vorhandenen ab.
    const effective = f.score === null ? 0 : base / availableWeight;
    return {
      id: f.id,
      labelKey: f.labelKey,
      baseWeight: base,
      effectiveWeight: effective,
      score: f.score,
      contribution: f.score === null ? 0 : (f.score * effective),
      detail: f.detail,
      assumption: f.assumption,
      forecast: f.forecast
    };
  });

  const value = Math.round(factors.reduce((s, f) => s + f.contribution, 0));
  // Gemessen heisst gemessen: Vorhersagen und Annahmen zaehlen hier nicht.
  const measuredWeight = factors
    .filter((f) => f.score !== null && !f.assumption && !f.forecast)
    .reduce((s, f) => s + f.effectiveWeight, 0);

  return {
    value,
    levelKey: levelKeyFor(value),
    factors,
    measuredShare: measuredWeight
  };
}

/* ------------------------------------------------------------------ */
/* Frühwarnung                                                         */
/* ------------------------------------------------------------------ */

const HISTORY_KEY = 'zoa.loadHistory';
export const WARN_THRESHOLD = 75;
export const WARN_DAYS = 3;

export interface HistoryEntry {
  date: string;
  value: number;
}

/** Tageswert festhalten - je Tag der zuletzt gesehene Wert. */
export function recordDailyValue(value: number, now: Date = new Date()): HistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const { date } = localParts(now);
  let history: HistoryEntry[] = [];
  try {
    history = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    history = [];
  }
  history = history.filter((e) => e.date !== date);
  history.push({ date, value });
  history.sort((a, b) => a.date.localeCompare(b.date));
  history = history.slice(-30);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* Speicher verweigert - die Warnung entfaellt dann eben. */
  }
  return history;
}

export function readHistory(): HistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Prueft, ob der Index an mehreren aufeinanderfolgenden Tagen ueber dem
 * Schwellwert lag. Zaehlt nur zusammenhaengende Kalendertage, damit eine
 * Luecke von mehreren Wochen keine falsche Warnung ausloest.
 */
export function checkWarning(
  history: HistoryEntry[],
  threshold = WARN_THRESHOLD,
  minDays = WARN_DAYS
): { active: boolean; days: number } {
  if (history.length === 0) return { active: false, days: 0 };
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  let days = 0;
  let expected: Date | null = null;

  for (const entry of sorted) {
    const d = new Date(`${entry.date}T12:00:00Z`);
    if (expected && d.getTime() !== expected.getTime()) break;
    if (entry.value <= threshold) break;
    days += 1;
    expected = new Date(d.getTime() - 86400000);
  }
  return { active: days >= minDays, days };
}
