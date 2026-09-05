import type { SourceResult } from './types';
import { QUELLEN, UMLAUFBAHN } from '$lib/config/kastelruth';

/**
 * Umlaufbahn Seis - Seiser Alm.
 *
 * Es gibt fuer diese Bahn keine oeffentliche Status-Schnittstelle. Im Open Data
 * Hub existiert nur ein Punkt-Eintrag "Talstation" ohne Betriebsdaten, und der
 * Betreiber veroeffentlicht weder Status noch Wartezeiten maschinenlesbar.
 *
 * Dieser Adapter arbeitet deshalb bewusst offline gegen den gepflegten
 * Fahrplan in der Konfiguration. Er gibt niemals vor, ein Live-Status zu sein:
 * das Feld `isSchedule` ist immer true, und die Oberflaeche weist darauf hin.
 *
 * Sobald der Betreiber Daten bereitstellt, kann dieser Adapter durch einen
 * netzgestuetzten ersetzt werden - die Signatur bleibt gleich.
 */

export interface CablecarStatus {
  /** true, wenn die Bahn laut Fahrplan gerade faehrt. */
  running: boolean;
  /** true, wenn heute ueberhaupt Betriebssaison ist. */
  inSeason: boolean;
  from: string | null;
  to: string | null;
  /** Beginn des naechsten Betriebszeitraums, falls gerade Pause ist. */
  nextSeasonStart: string | null;
  /** Immer true: Diese Angabe stammt aus einem Fahrplan, nicht aus Messdaten. */
  isSchedule: true;
  waitingTimeAvailable: false;
  operatorUrl: string;
}

function localDateParts(now: Date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const time = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
  return { date: fmt.format(now), minutes: toMinutes(time.replace('.', ':')) };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function evaluate(now: Date): CablecarStatus {
  const { date, minutes } = localDateParts(now);

  const current = UMLAUFBAHN.zeitraeume.find((z) => date >= z.von && date <= z.bis) ?? null;
  const upcoming = UMLAUFBAHN.zeitraeume
    .filter((z) => z.von > date)
    .sort((a, b) => a.von.localeCompare(b.von))[0];

  if (!current) {
    return {
      running: false,
      inSeason: false,
      from: null,
      to: null,
      nextSeasonStart: upcoming?.von ?? null,
      isSchedule: true,
      waitingTimeAvailable: false,
      operatorUrl: UMLAUFBAHN.website
    };
  }

  const running = minutes >= toMinutes(current.ab) && minutes < toMinutes(current.bis_uhr);
  return {
    running,
    inSeason: true,
    from: current.ab,
    to: current.bis_uhr,
    nextSeasonStart: null,
    isSchedule: true,
    waitingTimeAvailable: false,
    operatorUrl: UMLAUFBAHN.website
  };
}

export async function loadCablecarStatus(): Promise<SourceResult<CablecarStatus>> {
  // Kein Netzabruf noetig - der Fahrplan liegt in der App und funktioniert
  // damit auch offline.
  return {
    state: 'live',
    data: evaluate(new Date()),
    fetchedAt: new Date(),
    source: QUELLEN.lokal,
    notes: ['cablecar.noLiveStatus']
  };
}
