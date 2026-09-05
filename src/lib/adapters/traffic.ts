import { loadWithFallback, fetchJson } from './cache';
import type { Adapter, SourceResult } from './types';
import { QUELLEN, SEISER_ALM_STRASSE } from '$lib/config/kastelruth';

/**
 * Verkehrsmeldedienst des Landes Suedtirol.
 *
 * Der Datensatz enthaelt die Tagessperre der Seiser Alm-Strasse als amtliche
 * Meldung im Klartext, inklusive Gueltigkeitszeitraum. Deshalb werden hier
 * keine Sperrzeiten fest hinterlegt - sie werden aus der Meldung gelesen.
 * Scheitert das Lesen, zeigt die App den Originaltext der Meldung, statt eine
 * Zeit zu erfinden.
 */

export type RoadState = 'open' | 'closed' | 'restricted' | 'unknown';

export interface TrafficNotice {
  streetNr: string;
  streetName: string;
  /** Volltext der amtlichen Meldung. */
  text: string;
  /** Einstufung durch die Quelle: "Sperre", "Behinderung", ... */
  grade: string;
  type: string;
  validFrom: string | null;
  validTo: string | null;
  lat: number | null;
  lon: number | null;
}

export interface RoadStatus {
  /** Ampelzustand jetzt. */
  state: RoadState;
  /** Aus der Meldung gelesene Tagessperre, falls erkannt. */
  dailyClosure: { from: string; to: string } | null;
  /** true, wenn die Sperrregelung heute ueberhaupt gilt (Saison). */
  seasonActive: boolean;
  /** Gueltigkeit der Sperrregelung. */
  validFrom: string | null;
  validTo: string | null;
  /** Die Meldung zur Seiser Alm-Strasse selbst. */
  notice: TrafficNotice | null;
  /** Weitere Meldungen im Gemeindegebiet. */
  otherNotices: TrafficNotice[];
  /**
   * true, wenn die Meldung erwaehnt, dass bei vollen Parkplaetzen frueher
   * gesperrt wird. Dann ist "offen" nie eine Garantie.
   */
  earlyClosurePossible: boolean;
  /**
   * Naechster Zustandswechsel. `tomorrow` unterscheidet "offen bis 9 Uhr"
   * (morgens) von "naechste Sperre morgen ab 9 Uhr" (abends) - ohne diese
   * Unterscheidung liest sich die Anzeige am Abend falsch.
   */
  nextChange: { kind: 'closes' | 'opens'; time: string; tomorrow: boolean } | null;
}

interface RawNotice {
  descriptionDe?: string;
  descriptionIt?: string;
  placeDe?: string;
  placeIt?: string;
  beginDate?: string;
  endDate?: string;
  tycodeDe?: string;
  subTycodeDe?: string;
  messageGradDescDe?: string;
  messageStreetNr?: string;
  messageStreetInternetDescDe?: string;
  messageStreetWapDescDe?: string;
  messageZoneDescDe?: string;
  X?: number;
  Y?: number;
}

const CACHE_KEY = 'traffic-seiseralm';

/** Normalisiert Strassennummern: "LS/SP 25", "ls/sp25" -> "LS/SP25". */
function normStreet(nr: string | undefined): string {
  return (nr ?? '').toUpperCase().replace(/\s+/g, '');
}

function toNotice(raw: RawNotice): TrafficNotice {
  return {
    streetNr: normStreet(raw.messageStreetNr),
    streetName: raw.messageStreetInternetDescDe ?? raw.messageStreetWapDescDe ?? '',
    // Der Meldungstext steht in diesem Dienst im Feld "placeDe"; "descriptionDe"
    // ist in der Praxis leer. Beide werden geprueft, damit ein spaeterer
    // Feldwechsel der Quelle die Anzeige nicht leer laufen laesst.
    text: (raw.placeDe || raw.descriptionDe || '').replace(/\s+/g, ' ').trim(),
    grade: raw.messageGradDescDe ?? '',
    type: [raw.tycodeDe, raw.subTycodeDe].filter(Boolean).join(' / '),
    validFrom: raw.beginDate || null,
    validTo: raw.endDate || null,
    lat: typeof raw.Y === 'number' ? raw.Y : null,
    lon: typeof raw.X === 'number' ? raw.X : null
  };
}

/** Liest "SPERRE von 09:00 bis 17:00 Uhr" aus dem Meldungstext. */
export function parseDailyClosure(text: string): { from: string; to: string } | null {
  const m = text.match(/von\s+(\d{1,2}[:.]\d{2})\s*(?:Uhr\s*)?bis\s+(\d{1,2}[:.]\d{2})/i);
  if (!m) return null;
  const norm = (s: string) => {
    const [h, min] = s.replace('.', ':').split(':');
    return `${h.padStart(2, '0')}:${min}`;
  };
  return { from: norm(m[1]), to: norm(m[2]) };
}

/** Minuten seit Mitternacht fuer "HH:MM". */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function withinSeason(now: Date, from: string | null, to: string | null): boolean {
  const today = now.toISOString().slice(0, 10);
  if (from && today < from) return false;
  if (to && today > to) return false;
  return true;
}

/**
 * Bewertet den Zustand der Strasse zum Zeitpunkt `now` (lokale Zeit Europe/Rome).
 * Als eigene Funktion herausgezogen, damit sie ohne Netz pruefbar ist.
 */
export function evaluate(notices: TrafficNotice[], now: Date): RoadStatus {
  const target = normStreet(SEISER_ALM_STRASSE.streetNr);
  const notice = notices.find((n) => n.streetNr === target) ?? null;

  const others = notices.filter(
    (n) =>
      n.streetNr !== target &&
      (SEISER_ALM_STRASSE.weitereStrassenNr.map(normStreet).includes(n.streetNr) ||
        /kastelruth|castelrotto|seis|siusi|runggaditsch|st\.?\s*valentin/i.test(n.text))
  );

  if (!notice) {
    return {
      state: 'unknown',
      dailyClosure: null,
      seasonActive: false,
      validFrom: null,
      validTo: null,
      notice: null,
      otherNotices: others,
      earlyClosurePossible: false,
      nextChange: null
    };
  }

  const seasonActive = withinSeason(now, notice.validFrom, notice.validTo);
  const dailyClosure = parseDailyClosure(notice.text);
  const earlyClosurePossible = /bereits besetzt|schon vor|già occupati|prima delle/i.test(
    notice.text
  );

  let state: RoadState;
  let nextChange: RoadStatus['nextChange'] = null;

  if (!seasonActive) {
    state = 'open';
  } else if (dailyClosure) {
    // Lokale Zeit in Suedtirol, unabhaengig von der Zeitzone des Geraets.
    const local = new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Rome',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
    const nowMin = toMinutes(local.replace('.', ':'));
    const from = toMinutes(dailyClosure.from);
    const to = toMinutes(dailyClosure.to);

    if (nowMin >= from && nowMin < to) {
      state = 'closed';
      nextChange = { kind: 'opens', time: dailyClosure.to, tomorrow: false };
    } else {
      state = 'open';
      // Vor dem Sperrfenster gilt die Sperre noch heute, danach erst morgen.
      nextChange = { kind: 'closes', time: dailyClosure.from, tomorrow: nowMin >= to };
    }
  } else {
    // Sperrmeldung vorhanden, aber Zeitfenster nicht lesbar: nicht raten.
    state = /sperre/i.test(notice.grade) ? 'restricted' : 'unknown';
  }

  return {
    state,
    dailyClosure,
    seasonActive,
    validFrom: notice.validFrom,
    validTo: notice.validTo,
    notice,
    otherNotices: others,
    earlyClosurePossible,
    nextChange
  };
}

export const trafficAdapter: Adapter<TrafficNotice[]> = {
  key: CACHE_KEY,
  source: QUELLEN.trafficBulletin,
  maxAgeSeconds: 60 * 30,

  async load(signal) {
    return loadWithFallback<TrafficNotice[]>({
      key: CACHE_KEY,
      source: QUELLEN.trafficBulletin,
      signal,
      fetcher: async (s) => {
        const raw = await fetchJson<Record<string, RawNotice>>(QUELLEN.trafficBulletin.url, s);
        const all = Object.values(raw).map(toNotice);
        // Nur Meldungen aus dem Bezirk und der Gemeinde behalten - der
        // Gesamtdatensatz umfasst ganz Suedtirol und waere unnoetig gross
        // fuer den Zwischenspeicher auf dem Handy.
        const relevantStreets = [
          normStreet(SEISER_ALM_STRASSE.streetNr),
          ...SEISER_ALM_STRASSE.weitereStrassenNr.map(normStreet)
        ];
        const relevant = all.filter(
          (n) =>
            relevantStreets.includes(n.streetNr) ||
            /kastelruth|castelrotto|seiser alm|alpe di siusi|seis |siusi|st\.?\s*valentin|runggaditsch/i.test(
              n.text
            )
        );
        if (relevant.length === 0) {
          throw new Error('Verkehrsbericht enthaelt keine Meldung fuer Kastelruth');
        }
        return { data: relevant };
      }
    });
  }
};

/** Bequemer Aufruf fuer die Oberflaeche: laedt und bewertet in einem Schritt. */
export async function loadRoadStatus(
  signal?: AbortSignal
): Promise<SourceResult<RoadStatus>> {
  const res = await trafficAdapter.load(signal);
  if (!res.data) return { ...res, data: null };
  return { ...res, data: evaluate(res.data, new Date()) };
}
