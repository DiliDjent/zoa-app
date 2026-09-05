import { loadWithFallback, fetchJson } from './cache';
import type { Adapter } from './types';
import { QUELLEN, PARKPLAETZE, type ParkingConfig } from '$lib/config/kastelruth';

/**
 * Parkplatz-Auslastung aus dem Open Data Hub (Mobility, ParkingStation).
 *
 * Besonderheit: Nicht jedes Zaehlwerk liefert brauchbare Summen. Der Adapter
 * prueft jeden Datensatz gegen seine Teilwerte und verwirft den Gesamtwert,
 * wenn er ihnen widerspricht. Lieber ein begruendet korrigierter Wert mit
 * Hinweis als eine glatte Zahl, die falsch ist.
 */

export interface ParkingLot {
  code: string;
  nameDe: string;
  nameIt: string;
  capacity: number;
  /** Belegte Plaetze, nach Pruefung. null wenn nicht ermittelbar. */
  occupied: number | null;
  /** Freie Plaetze, nach Pruefung. null wenn nicht ermittelbar. */
  free: number | null;
  /** Auslastung 0 bis 1. null wenn nicht ermittelbar. */
  ratio: number | null;
  /** Zeitpunkt der juengsten verwendeten Messung. */
  measuredAt: string | null;
  /** Prognose der Belegung in 30/60/120 Minuten, sofern geliefert. */
  forecast: { inMinutes: number; occupied: number }[];
  /** i18n-Schluessel eines Qualitaetshinweises, falls korrigiert wurde. */
  note?: string;
  lat: number;
  lon: number;
}

interface Measurement {
  scode: string;
  tname: string;
  mvalue: number;
  mvalidtime: string;
}

const CACHE_KEY = 'parking-kastelruth';
const BASE = 'https://mobility.api.opendatahub.com/v2/flat/ParkingStation';

/** Baut die Abfrage-URL. Als eigene Funktion, damit sie testbar bleibt. */
export function buildUrl(codes: string[]): string {
  const list = codes.map((c) => `"${c}"`).join(',');
  const params = new URLSearchParams({
    limit: '-1',
    select: 'scode,tname,mvalue,mvalidtime',
    where: `scode.in.(${list})`
  });
  return `${BASE}/*/latest?${params.toString()}`;
}

/**
 * Ermittelt die Belegung eines Parkplatzes aus seinen Messwerten.
 *
 * Reihenfolge:
 *   1. Teilwerte (Kurzparker + Dauerparker) - sie waren in der Pruefung
 *      durchgehend plausibel und sind die feinere Information.
 *   2. Gesamtwert 'occupied', aber nur wenn er den Teilwerten nicht
 *      widerspricht.
 * Widerspricht er, wird er verworfen und ein Hinweis gesetzt.
 */
export function deriveOccupancy(
  values: Map<string, { value: number; at: string }>,
  cfg: ParkingConfig
): { occupied: number | null; note?: string; measuredAt: string | null } {
  const get = (k: string) => values.get(k)?.value ?? null;
  const at = (k: string) => values.get(k)?.at ?? null;

  const shortStay = get('occupied_short_stay');
  const subscribers = get('occupied_subscribers');
  const aggregate = get('occupied');

  const partsSum =
    shortStay !== null || subscribers !== null ? (shortStay ?? 0) + (subscribers ?? 0) : null;

  // Kontrollzahl: Ein Gesamtwert von 0 bei belegten Teilplaetzen ist nicht
  // moeglich. Genauso wenig ein Gesamtwert, der weit unter der Teilsumme liegt.
  const aggregateImplausible =
    aggregate !== null &&
    partsSum !== null &&
    (aggregate === 0 ? partsSum > 0 : aggregate < partsSum - 1);

  if (cfg.aggregateFieldBroken || aggregateImplausible) {
    if (partsSum === null) {
      return { occupied: null, note: 'parking.dataIssue', measuredAt: null };
    }
    return {
      occupied: partsSum,
      note: 'parking.dataIssue',
      measuredAt: at('occupied_short_stay') ?? at('occupied_subscribers')
    };
  }

  if (aggregate !== null) return { occupied: aggregate, measuredAt: at('occupied') };
  if (partsSum !== null) {
    return { occupied: partsSum, measuredAt: at('occupied_short_stay') ?? at('occupied_subscribers') };
  }
  return { occupied: null, measuredAt: null };
}

/**
 * Sammelt die Prognosewerte - aber nur, wenn sie zur gemessenen Belegung passen.
 *
 * Kontrollzahl: Die Prognose wird beim Anbieter aus derselben Zeitreihe
 * gerechnet wie das Feld 'occupied'. Ist dieses Feld defekt, ist auch die
 * Prognose wertlos - sie sagt dann durchgehend "0 belegt" voraus, waehrend der
 * Parkplatz in Wirklichkeit gefuellt ist. Eine solche Prognose anzuzeigen waere
 * schlimmer als gar keine, deshalb wird sie in diesem Fall verworfen.
 */
function collectForecast(
  values: Map<string, { value: number; at: string }>,
  measuredOccupied: number | null
): { inMinutes: number; occupied: number }[] {
  const out: { inMinutes: number; occupied: number }[] = [];
  for (const horizon of [30, 60, 120]) {
    const v = values.get(`parking-forecast-${horizon}`);
    // Die Quelle liefert gelegentlich leicht negative Prognosen; auf 0 kappen.
    if (v) out.push({ inMinutes: horizon, occupied: Math.max(0, Math.round(v.value)) });
  }
  if (out.length === 0) return out;

  // Alle Prognosen bei 0, obwohl gerade nachweislich Autos stehen: unbrauchbar.
  const allZero = out.every((f) => f.occupied === 0);
  if (allZero && (measuredOccupied ?? 0) > 2) return [];

  return out;
}

export function shape(measurements: Measurement[]): ParkingLot[] {
  const byStation = new Map<string, Map<string, { value: number; at: string }>>();
  for (const m of measurements) {
    if (!byStation.has(m.scode)) byStation.set(m.scode, new Map());
    byStation.get(m.scode)!.set(m.tname, { value: m.mvalue, at: m.mvalidtime });
  }

  return PARKPLAETZE.map((cfg) => {
    const values = byStation.get(cfg.code) ?? new Map();
    const { occupied, note, measuredAt } = deriveOccupancy(values, cfg);
    // Die Kapazitaet aus der Konfiguration gilt, nicht ein gemeldeter Restwert:
    // sie wurde gegen die Stationsbeschreibung geprueft und ist stabil.
    const clamped = occupied === null ? null : Math.min(occupied, cfg.capacity);
    return {
      code: cfg.code,
      nameDe: cfg.nameDe,
      nameIt: cfg.nameIt,
      capacity: cfg.capacity,
      occupied: clamped,
      free: clamped === null ? null : cfg.capacity - clamped,
      ratio: clamped === null ? null : clamped / cfg.capacity,
      measuredAt,
      forecast: collectForecast(values, clamped),
      note,
      lat: cfg.lat,
      lon: cfg.lon
    };
  });
}

export const parkingAdapter: Adapter<ParkingLot[]> = {
  key: CACHE_KEY,
  source: QUELLEN.odhMobility,
  maxAgeSeconds: 60 * 10,

  async load(signal) {
    return loadWithFallback<ParkingLot[]>({
      key: CACHE_KEY,
      source: QUELLEN.odhMobility,
      signal,
      fetcher: async (s) => {
        const url = buildUrl(PARKPLAETZE.map((p) => p.code));
        const res = await fetchJson<{ data: Measurement[] }>(url, s);
        const lots = shape(res.data ?? []);
        if (lots.every((l) => l.occupied === null)) {
          throw new Error('Keine verwertbaren Parkplatz-Messwerte erhalten');
        }
        const notes = lots.some((l) => l.note) ? ['parking.dataIssue'] : undefined;
        return { data: lots, notes };
      }
    });
  }
};
