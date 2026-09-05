import { base } from '$app/paths';
import { loadWithFallback } from './cache';
import type { Adapter, SourceMeta } from './types';
import { shape as shapeParking } from './parking';
import { conditionKey, type Weather } from './weather';
import type { RoadStatus } from './traffic';
import { computeLoadIndex, type HistoryEntry } from '$lib/logic/load-index';
import { PARKPLAETZE, VERLAUF } from '$lib/config/kastelruth';

/**
 * Oeffentliche Zeitreihe aus static/verlauf/verlauf.csv.
 *
 * Die Datei fuellt eine GitHub Action alle 30 Minuten (scripts/sammeln.mjs).
 * Sie enthaelt Rohwerte; die Belegung wird hier mit derselben Pruefung
 * abgeleitet wie im Live-Adapter (shapeParking -> deriveOccupancy). Damit gilt
 * eine Regelaenderung rueckwirkend fuer die gesamte Reihe - und niemand muss
 * eine alte CSV umrechnen.
 */

export interface VerlaufTag {
  /** Lokales Datum (Europe/Rome). */
  date: string;
  samples: number;
  /** Hoechster Belastungs-Index des Tages. */
  maxIndex: number | null;
  /** Anteil der Messungen, bei denen die Strasse gesperrt war, 0 bis 1. */
  closedShare: number;
  /** Hoechste Auslastung der Dorfgaragen, 0 bis 1. */
  peakRatio: number | null;
}

export interface Verlauf {
  days: VerlaufTag[];
  firstSample: string | null;
  lastSample: string | null;
  totalSamples: number;
}

const CACHE_KEY = 'verlauf-kastelruth';

export const VERLAUF_QUELLE: SourceMeta = {
  id: 'local-config',
  labelKey: 'verlauf.source',
  url: 'static/verlauf/verlauf.csv'
};

function localDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/** Sehr kleiner CSV-Leser - die Datei enthaelt keine Anfuehrungszeichen. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

const num = (s: string | undefined): number | null => {
  if (s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Bewertet eine einzelne Messzeile mit der Live-Logik. */
function indexForRow(row: Record<string, string>, at: Date): number | null {
  // Parkplaetze: Rohwerte in dieselbe Form bringen wie die API-Antwort.
  const measurements = PARKPLAETZE.flatMap((cfg) =>
    ['occupied', 'occupied_short_stay', 'occupied_subscribers']
      .map((f) => ({ f, v: num(row[`${cfg.csvKey}_${f}`]) }))
      .filter((x) => x.v !== null)
      .map((x) => ({ scode: cfg.code, tname: x.f, mvalue: x.v as number, mvalidtime: row.zeit_utc }))
  );
  const parking = measurements.length ? shapeParking(measurements) : null;

  const state = row.strasse as RoadStatus['state'] | '';
  const road: RoadStatus | null = state
    ? {
        state,
        dailyClosure: row.sperre_von ? { from: row.sperre_von, to: row.sperre_bis } : null,
        seasonActive: row.sperre_von !== '',
        validFrom: null,
        validTo: null,
        notice: null,
        otherNotices: [],
        earlyClosurePossible: false,
        nextChange: null
      }
    : null;

  // Wetter nur, wenn die Vorhersage fuer den Messtag selbst gilt.
  const day = localDate(at);
  const weather: Weather | null =
    row.wetter && row.wetter_tag === day
      ? {
          days: [
            {
              date: day,
              condition: row.wetter,
              conditionKey: conditionKey(row.wetter),
              tempMax: num(row.temp_max),
              tempMin: null,
              precipitationMm: num(row.regen_mm),
              precipitationProbability: null,
              sunshineHours: null
            }
          ],
          todayMissing: false
        }
      : null;

  return computeLoadIndex({ parking, road, weather }, at).value;
}

export function aggregate(rows: Record<string, string>[]): Verlauf {
  const byDay = new Map<string, { idx: number[]; closed: number; n: number; peak: number[] }>();

  for (const row of rows) {
    const at = new Date(row.zeit_utc);
    if (Number.isNaN(at.getTime())) continue;
    const day = localDate(at);
    const bucket = byDay.get(day) ?? { idx: [], closed: 0, n: 0, peak: [] };
    bucket.n += 1;
    if (row.strasse === 'closed') bucket.closed += 1;

    const idx = indexForRow(row, at);
    if (idx !== null) bucket.idx.push(idx);

    const measurements = PARKPLAETZE.flatMap((cfg) =>
      ['occupied', 'occupied_short_stay', 'occupied_subscribers']
        .map((f) => ({ f, v: num(row[`${cfg.csvKey}_${f}`]) }))
        .filter((x) => x.v !== null)
        .map((x) => ({ scode: cfg.code, tname: x.f, mvalue: x.v as number, mvalidtime: row.zeit_utc }))
    );
    if (measurements.length) {
      const lots = shapeParking(measurements).filter((l) => l.occupied !== null);
      const occ = lots.reduce((s, l) => s + (l.occupied ?? 0), 0);
      const cap = lots.reduce((s, l) => s + l.capacity, 0);
      if (cap > 0) bucket.peak.push(occ / cap);
    }
    byDay.set(day, bucket);
  }

  const days: VerlaufTag[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => ({
      date,
      samples: b.n,
      maxIndex: b.idx.length ? Math.max(...b.idx) : null,
      closedShare: b.n ? b.closed / b.n : 0,
      peakRatio: b.peak.length ? Math.max(...b.peak) : null
    }));

  return {
    days,
    firstSample: rows[0]?.zeit_utc ?? null,
    lastSample: rows[rows.length - 1]?.zeit_utc ?? null,
    totalSamples: rows.length
  };
}

/** Tageswerte in der Form, die die Fruehwarnung erwartet. */
export function toHistory(v: Verlauf): HistoryEntry[] {
  return v.days
    .filter((d) => d.maxIndex !== null)
    .map((d) => ({ date: d.date, value: d.maxIndex as number }));
}

export const verlaufAdapter: Adapter<Verlauf> = {
  key: CACHE_KEY,
  source: VERLAUF_QUELLE,
  maxAgeSeconds: 60 * 60,

  async load(signal) {
    return loadWithFallback<Verlauf>({
      key: CACHE_KEY,
      source: VERLAUF_QUELLE,
      signal,
      fetcher: async (s) => {
        const res = await fetch(`${base}${VERLAUF.pfad}`, { signal: s, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status} beim Verlauf`);
        const rows = parseCsv(await res.text());
        // Eine leere Datei ist kein Fehler - die Sammlung hat dann nur noch
        // nicht begonnen. Die Oberflaeche sagt das.
        return { data: aggregate(rows) };
      }
    });
  }
};
