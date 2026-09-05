import { loadWithFallback, fetchJson } from './cache';
import type { Adapter } from './types';
import { QUELLEN, WETTER } from '$lib/config/kastelruth';

/**
 * Tagesvorhersage des Landeswetterdienstes fuer Kastelruth (Open Data Hub).
 *
 * Das ist eine VORHERSAGE, keine Messung - die Oberflaeche und der
 * Belastungs-Index kennzeichnen sie so. Sie ist trotzdem wertvoll: Das Wetter
 * ist der staerkste Treiber fuer den Andrang auf der Seiser Alm, und ein
 * Schoenwetter-Sonntag im August ist die Kombination, die die Strasse vor
 * neun Uhr schliesst.
 */

export interface WeatherDay {
  /** Lokales Datum (Europe/Rome), ISO. */
  date: string;
  /** Wetterlage im Originalwortlaut der Quelle (englisch), z. B. "partly cloudy". */
  condition: string;
  /** i18n-Schluessel der uebersetzten Wetterlage. */
  conditionKey: string;
  tempMax: number | null;
  tempMin: number | null;
  /** Niederschlagssumme in mm. */
  precipitationMm: number | null;
  /** Regenwahrscheinlichkeit in Prozent. */
  precipitationProbability: number | null;
  sunshineHours: number | null;
}

export interface Weather {
  days: WeatherDay[];
  /** true, wenn der heutige Tag in der Reihe fehlt und der naechste gezeigt wird. */
  todayMissing: boolean;
}

interface Measurement {
  tname: string;
  mvalue: number | string;
  mvalidtime: string;
}

const CACHE_KEY = 'weather-kastelruth';
const BASE = 'https://mobility.api.opendatahub.com/v2/flat/WeatherForecast';
const TYPES = [
  'qualitative-forecast',
  'forecast-air-temperature-max',
  'forecast-air-temperature-min',
  'forecast-precipitation-sum',
  'forecast-precipitation-probability',
  'forecast-sunshine-duration'
];

function localDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Ordnet den englischen Wetterlagen der Quelle einen Uebersetzungsschluessel zu.
 * Reihenfolge ist wichtig: "cloudy with moderate rain" muss als Regen gelten,
 * nicht als bewoelkt.
 */
export function conditionKey(raw: string): string {
  const s = raw.toLowerCase();
  if (/thunder/.test(s)) return 'weather.q.thunderstorm';
  if (/snow/.test(s)) return 'weather.q.snow';
  if (/rain|shower|drizzle/.test(s)) return 'weather.q.rain';
  if (/fog|mist/.test(s)) return 'weather.q.fog';
  if (/overcast/.test(s)) return 'weather.q.overcast';
  if (/very cloudy/.test(s)) return 'weather.q.veryCloudy';
  if (/partly cloudy|partly sunny/.test(s)) return 'weather.q.partlyCloudy';
  if (/cloudy/.test(s)) return 'weather.q.cloudy';
  if (/sunny|clear/.test(s)) return 'weather.q.sunny';
  return 'weather.q.unknown';
}

/**
 * Bewertet einen Vorhersagetag fuer den Belastungs-Index, 0 bis 100.
 *
 * Offengelegte Regel, bewusst grob: Die Wetterlage gibt den Grundwert, Regen
 * und Kaelte ziehen ab, Waerme legt zu. Wer sie aendert, aendert den Index.
 */
export function weatherScore(day: WeatherDay): number {
  const base: Record<string, number> = {
    'weather.q.sunny': 100,
    'weather.q.partlyCloudy': 80,
    'weather.q.cloudy': 55,
    'weather.q.veryCloudy': 45,
    'weather.q.overcast': 35,
    'weather.q.fog': 35,
    'weather.q.rain': 20,
    'weather.q.thunderstorm': 25,
    'weather.q.snow': 30,
    'weather.q.unknown': 50
  };
  let score = base[day.conditionKey] ?? 50;
  if (day.precipitationMm !== null) {
    if (day.precipitationMm > 15) score -= 40;
    else if (day.precipitationMm > 5) score -= 20;
  }
  if (day.tempMax !== null) {
    if (day.tempMax < 8) score -= 25;
    else if (day.tempMax < 14) score -= 10;
    else if (day.tempMax >= 22) score += 10;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function shape(measurements: Measurement[], now: Date): Weather {
  const byDay = new Map<string, Partial<Record<string, number | string>>>();
  for (const m of measurements) {
    // Die Quelle stempelt einen Tageswert auf 22:00 UTC des Vortags, also auf
    // Mitternacht Ortszeit des betreffenden Tages. Zwei Stunden dazu, dann in
    // Ortszeit lesen - so landet der Wert auf dem richtigen Kalendertag.
    const stamped = new Date(new Date(m.mvalidtime).getTime() + 2 * 3600 * 1000);
    const day = localDate(stamped);
    if (!byDay.has(day)) byDay.set(day, {});
    byDay.get(day)![m.tname] = m.mvalue;
  }

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const today = localDate(now);

  const days: WeatherDay[] = [...byDay.entries()]
    .filter(([day]) => day >= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => {
      const condition = String(v['qualitative-forecast'] ?? '');
      return {
        date,
        condition,
        conditionKey: conditionKey(condition),
        tempMax: num(v['forecast-air-temperature-max']),
        tempMin: num(v['forecast-air-temperature-min']),
        precipitationMm: num(v['forecast-precipitation-sum']),
        precipitationProbability: num(v['forecast-precipitation-probability']),
        sunshineHours: num(v['forecast-sunshine-duration'])
      };
    })
    .slice(0, 4);

  return { days, todayMissing: days.length > 0 && days[0].date !== today };
}

export const weatherAdapter: Adapter<Weather> = {
  key: CACHE_KEY,
  source: QUELLEN.odhMobility,
  maxAgeSeconds: 60 * 60 * 6,

  async load(signal) {
    return loadWithFallback<Weather>({
      key: CACHE_KEY,
      source: QUELLEN.odhMobility,
      signal,
      fetcher: async (s) => {
        const now = new Date();
        // Ein Tag zurueck, damit der laufende Tag mitkommt, falls die Quelle
        // ihn noch fuehrt; insgesamt nicht mehr als das anonyme Limit.
        const from = new Date(now.getTime() - 86400 * 1000).toISOString().slice(0, 10);
        const to = new Date(now.getTime() + (WETTER.maxRangeDays - 2) * 86400 * 1000)
          .toISOString()
          .slice(0, 10);
        const params = new URLSearchParams({
          limit: '-1',
          select: 'tname,mvalue,mvalidtime',
          where: `scode.eq."${WETTER.stationCode}",mperiod.eq.86400`
        });
        const url = `${BASE}/${TYPES.join(',')}/${from}/${to}?${params.toString()}`;
        const res = await fetchJson<{ data: Measurement[] }>(url, s);
        const data = shape(res.data ?? [], now);
        if (data.days.length === 0) throw new Error('Keine Tagesvorhersage erhalten');
        return { data };
      }
    });
  }
};
