import { browser } from '$app/environment';
import type { SourceResult, SourceMeta } from './types';

/**
 * Letzter bekannter Stand je Adapter, im localStorage.
 *
 * Zweck: Faellt eine Quelle aus, zeigt die App den letzten bekannten Wert mit
 * Zeitstempel statt einer leeren Seite. Es werden ausschliesslich oeffentliche
 * Messwerte gespeichert, nie personenbezogene Daten.
 */

const PREFIX = 'zoa.cache.';
/** Aelteres als das wird beim Lesen verworfen - lieber nichts als Vorjahresdaten. */
const HARD_LIMIT_MS = 1000 * 60 * 60 * 24 * 30;

interface Entry<T> {
  data: T;
  fetchedAt: string;
}

export function readCache<T>(key: string): { data: T; fetchedAt: Date } | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    const fetchedAt = new Date(entry.fetchedAt);
    if (Number.isNaN(fetchedAt.getTime())) return null;
    if (Date.now() - fetchedAt.getTime() > HARD_LIMIT_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return { data: entry.data, fetchedAt };
  } catch {
    // Defektes oder gesperrtes localStorage darf die App nicht aufhalten.
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (!browser) return;
  try {
    const entry: Entry<T> = { data, fetchedAt: new Date().toISOString() };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Speicher voll oder verweigert - der Live-Betrieb funktioniert trotzdem.
  }
}

export function clearCache(): void {
  if (!browser) return;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignoriert */
  }
}

/**
 * Holt Daten vom Netz und faellt bei Fehlern auf den letzten bekannten Stand
 * zurueck. Das ist der einzige Weg, auf dem Adapter Daten laden - damit gilt
 * die Regel "nie eine leere Seite" ueberall gleich.
 */
export async function loadWithFallback<T>(opts: {
  key: string;
  source: SourceMeta;
  fetcher: (signal?: AbortSignal) => Promise<{ data: T; notes?: string[] }>;
  signal?: AbortSignal;
  /** Zeitlimit fuer den Netzabruf in Millisekunden. */
  timeoutMs?: number;
}): Promise<SourceResult<T>> {
  const { key, source, fetcher, signal, timeoutMs = 12000 } = opts;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const merged = signal ? mergeSignals(signal, timeout.signal) : timeout.signal;

  try {
    const { data, notes } = await fetcher(merged);
    clearTimeout(timer);
    writeCache(key, data);
    return { state: 'live', data, fetchedAt: new Date(), source, notes };
  } catch (err) {
    clearTimeout(timer);
    const cached = readCache<T>(key);
    if (cached) {
      return {
        state: 'cached',
        data: cached.data,
        fetchedAt: cached.fetchedAt,
        source,
        error: err instanceof Error ? err.message : String(err)
      };
    }
    return {
      state: 'unavailable',
      data: null,
      fetchedAt: null,
      source,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (a.aborted || b.aborted) ctrl.abort();
  a.addEventListener('abort', onAbort, { once: true });
  b.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}

/**
 * Kleiner Helfer: JSON holen und bei HTTP-Fehler sauber scheitern.
 *
 * `cache: 'no-store'` ist hier entscheidend. Ohne diese Angabe liefert der
 * Browser offline eine alte Antwort aus seinem HTTP-Cache - und zwar als
 * ganz normalen Erfolg. Der Adapter haelt die Daten dann fuer frisch und
 * zeigt "gerade eben" ohne Offline-Hinweis. Am Geraet im Flugmodus so
 * beobachtet. Mit 'no-store' scheitert der Abruf ehrlich, und der Rueckfall
 * auf den eigenen Zwischenspeicher greift - mit dem echten Zeitstempel.
 */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    signal,
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
  return (await res.json()) as T;
}
