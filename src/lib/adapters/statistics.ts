import { loadWithFallback, fetchJson } from './cache';
import type { Adapter } from './types';
import { QUELLEN, GEMEINDE, ASTAT_BEZUGSJAHR } from '$lib/config/kastelruth';

/**
 * Jahresstatistik der Gemeinde aus dem ASTAT-Geodienst (WFS).
 *
 * Diese Zahlen sind Jahreswerte, keine Livedaten. Sie werden deshalb mit
 * Bezugsjahr ausgewiesen. Werte, die ASTAT nicht veroeffentlicht - etwa
 * Wasser- und Muellverbrauch - werden nicht geschaetzt und nicht ersetzt.
 */

export interface Statistics {
  inhabitants: number | null;
  /** Gaestebetten. ASTAT liefert einen Jahresdurchschnitt mit Nachkommastelle. */
  beds: number | null;
  overnightStays: number | null;
  arrivals: number | null;
  summerStays: number | null;
  winterStays: number | null;
  domesticStays: number | null;
  foreignStays: number | null;
  /** Bettenauslastung in Prozent. */
  bedOccupancy: number | null;
  vehicles: number | null;
  /** Bezugsjahr, sofern die Quelle es nennt. */
  referenceYear: number | null;
}

const CACHE_KEY = 'astat-kastelruth';
const WFS = QUELLEN.astat.url;

function wfsUrl(layer: string): string {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: `p_bz-Astat:${layer}`,
    outputFormat: 'application/json',
    CQL_FILTER: `ISTAT_CODE=${GEMEINDE.istatCode}`
  });
  return `${WFS}?${params.toString()}`;
}

interface FeatureCollection {
  features?: { properties?: Record<string, unknown> }[];
}

function num(props: Record<string, unknown> | undefined, key: string): number | null {
  const v = props?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

async function firstProps(
  layer: string,
  signal?: AbortSignal
): Promise<Record<string, unknown> | undefined> {
  const fc = await fetchJson<FeatureCollection>(wfsUrl(layer), signal);
  return fc.features?.[0]?.properties;
}

export const statisticsAdapter: Adapter<Statistics> = {
  key: CACHE_KEY,
  source: QUELLEN.astat,
  // Jahreswerte - ein Tag Zwischenspeicher ist reichlich.
  maxAgeSeconds: 60 * 60 * 24,

  async load(signal) {
    return loadWithFallback<Statistics>({
      key: CACHE_KEY,
      source: QUELLEN.astat,
      signal,
      timeoutMs: 20000,
      fetcher: async (s) => {
        // Die drei Ebenen werden parallel geholt; faellt eine aus, bleiben die
        // uebrigen Werte erhalten und die Luecke wird als "nicht verfuegbar"
        // angezeigt, statt die ganze Seite scheitern zu lassen.
        const [tourism, population, vehicles] = await Promise.allSettled([
          firstProps('TouristOvernightStays', s),
          firstProps('OfficialResidentPopulation', s),
          firstProps('RegisteredVehicles-PRA', s)
        ]);

        const tp = tourism.status === 'fulfilled' ? tourism.value : undefined;
        const pp = population.status === 'fulfilled' ? population.value : undefined;
        const vp = vehicles.status === 'fulfilled' ? vehicles.value : undefined;

        const data: Statistics = {
          inhabitants: num(pp, 'BW_WOHNBEV'),
          beds: num(tp, 'FN_BETTEN'),
          overnightStays: num(tp, 'FN_NACHT'),
          arrivals: num(tp, 'FN_ANK'),
          summerStays: num(tp, 'FN_NACHTSO'),
          winterStays: num(tp, 'FN_NACHTWI'),
          domesticStays: num(tp, 'FN_NACHTIN'),
          foreignStays: num(tp, 'FN_NACHTAU'),
          bedOccupancy: num(tp, 'FN_BETTLAS'),
          vehicles: num(vp, 'VK_PRA_C_V'),
          // Der WFS nennt das Bezugsjahr nicht im Datensatz; es stammt aus
          // dem Katalogeintrag der Provinz (siehe Konstante in der Konfiguration).
          referenceYear: ASTAT_BEZUGSJAHR
        };

        if (data.inhabitants === null && data.overnightStays === null) {
          throw new Error('ASTAT lieferte weder Bevoelkerung noch Naechtigungen');
        }
        return { data };
      }
    });
  }
};

/** Abgeleitete Verhaeltniszahlen. Gibt null zurueck, wenn die Basis fehlt. */
export function ratios(s: Statistics | null) {
  if (!s || !s.inhabitants) return { bedsPerInhabitant: null, staysPerInhabitant: null };
  return {
    bedsPerInhabitant: s.beds ? s.beds / s.inhabitants : null,
    staysPerInhabitant: s.overnightStays ? s.overnightStays / s.inhabitants : null
  };
}
