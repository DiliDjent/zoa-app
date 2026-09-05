/**
 * Gemeinsame Typen der Adapter-Schicht.
 *
 * Jede Datenquelle wird hinter einem Adapter gekapselt, der immer dieselbe
 * Huelle liefert. Dadurch laesst sich eine Quelle austauschen, ohne dass die
 * Oberflaeche angepasst werden muss - und jeder Wert traegt seine Herkunft,
 * sein Alter und seinen Zustand mit sich.
 */

export type SourceId =
  | 'odh-mobility'
  | 'odh-tourism'
  | 'traffic-bulletin'
  | 'astat-wfs'
  | 'local-config';

export interface SourceMeta {
  /** Interner Bezeichner der Quelle. */
  id: SourceId;
  /** i18n-Schluessel des Anzeigenamens, z. B. "sources.odhMobility". */
  labelKey: string;
  /** Oeffentlicher Einstiegspunkt, damit jeder Wert nachprüfbar bleibt. */
  url: string;
  /** Lizenz der Quelle, soweit angegeben. */
  license?: string;
}

/** Zustand eines Adapter-Ergebnisses. */
export type ResultState =
  /** Frisch vom Netz geholt. */
  | 'live'
  /** Netz nicht erreichbar, angezeigt wird der letzte bekannte Stand. */
  | 'cached'
  /** Weder Netz noch Zwischenspeicher - es gibt nichts anzuzeigen. */
  | 'unavailable'
  /** Die Quelle liefert diesen Wert grundsaetzlich nicht (bewusste Luecke). */
  | 'not-published';

export interface SourceResult<T> {
  state: ResultState;
  /** Nutzdaten. Nur bei state 'unavailable' oder 'not-published' null. */
  data: T | null;
  /** Zeitpunkt, zu dem diese Daten geholt wurden. */
  fetchedAt: Date | null;
  /** Herkunft, fuer die Quellenangabe in der Oberflaeche. */
  source: SourceMeta;
  /** Klartext-Fehler, falls etwas schiefging. Nur fuer Diagnose, nicht fuer Nutzer. */
  error?: string;
  /**
   * Hinweise zur Datenqualitaet, die in der Oberflaeche sichtbar werden sollen.
   * i18n-Schluessel, z. B. "parking.dataIssue".
   */
  notes?: string[];
}

/** Einheitliche Signatur aller Adapter. */
export interface Adapter<T> {
  readonly key: string;
  readonly source: SourceMeta;
  /** Wie lange ein zwischengespeicherter Wert als brauchbar gilt (Sekunden). */
  readonly maxAgeSeconds: number;
  load(signal?: AbortSignal): Promise<SourceResult<T>>;
}

/** Alter eines Ergebnisses in Minuten, oder null wenn unbekannt. */
export function ageInMinutes(result: SourceResult<unknown>): number | null {
  if (!result.fetchedAt) return null;
  return Math.max(0, Math.round((Date.now() - result.fetchedAt.getTime()) / 60000));
}

/** true, wenn die Daten aelter sind als der Adapter erlaubt. */
export function isStale(result: SourceResult<unknown>, maxAgeSeconds: number): boolean {
  const age = ageInMinutes(result);
  return age !== null && age * 60 > maxAgeSeconds;
}
