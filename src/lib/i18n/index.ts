import { derived, writable, get } from 'svelte/store';
import { browser } from '$app/environment';

import de from './locales/de.json';
import it from './locales/it.json';
import lld from './locales/lld.json';

/**
 * Eine neue Sprache ergaenzen:
 *   1. src/lib/i18n/locales/<code>.json anlegen (Kopie von de.json, Werte uebersetzen)
 *   2. hier importieren und in LOCALES eintragen
 * Sonst ist nichts zu tun - fehlende Schluessel fallen automatisch auf Deutsch zurueck.
 */
export const LOCALES = [
  { code: 'de', label: 'Deutsch', messages: de },
  { code: 'it', label: 'Italiano', messages: it },
  { code: 'lld', label: 'Ladin', messages: lld }
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: LocaleCode = 'de';
const STORAGE_KEY = 'zoa.locale';

type Messages = Record<string, unknown>;

const bundles = new Map<string, Messages>(LOCALES.map((l) => [l.code, l.messages as Messages]));

function detectLocale(): LocaleCode {
  if (!browser) return DEFAULT_LOCALE;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && bundles.has(saved)) return saved as LocaleCode;
  for (const nav of navigator.languages ?? [navigator.language]) {
    const base = nav.toLowerCase().split('-')[0];
    const match = LOCALES.find((l) => l.code === base || l.code.startsWith(base));
    if (match) return match.code;
  }
  return DEFAULT_LOCALE;
}

export const locale = writable<LocaleCode>(DEFAULT_LOCALE);

export function initLocale() {
  if (!browser) return;
  const detected = detectLocale();
  locale.set(detected);
  document.documentElement.lang = detected;
}

export function setLocale(code: LocaleCode) {
  locale.set(code);
  if (browser) {
    localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
  }
}

function lookup(bundle: Messages | undefined, path: string): string | undefined {
  if (!bundle) return undefined;
  let node: unknown = bundle;
  for (const part of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  // Ein leerer String gilt als "noch nicht uebersetzt" und loest den Rueckfall
  // auf Deutsch aus. So kann eine Sprachdatei als Vorlage ausgeliefert werden,
  // ohne dass in der Oberflaeche leere Stellen entstehen.
  return typeof node === 'string' && node.length > 0 ? node : undefined;
}

/** Anteil uebersetzter Schluessel, 0 bis 1. Basis ist die deutsche Datei. */
export function coverage(code: LocaleCode): number {
  const master = bundles.get(DEFAULT_LOCALE);
  const bundle = bundles.get(code);
  if (!master || !bundle) return 0;
  let total = 0;
  let filled = 0;
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      total += 1;
      if (lookup(bundle, path)) filled += 1;
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(master, '');
  return total === 0 ? 0 : filled / total;
}

/** Platzhalter der Form {name} ersetzen. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in vars ? String(vars[key]) : whole
  );
}

/**
 * Uebersetzt einen Schluessel. Fehlt er in der aktiven Sprache, greift Deutsch;
 * fehlt er auch dort, wird der Schluessel selbst gezeigt - so faellt eine Luecke
 * beim Testen sofort auf, statt still leer zu bleiben.
 */
export const t = derived(locale, ($locale) => {
  return (key: string, vars?: Record<string, string | number>): string => {
    const hit = lookup(bundles.get($locale), key) ?? lookup(bundles.get(DEFAULT_LOCALE), key);
    return hit ? interpolate(hit, vars) : key;
  };
});

/** Ausserhalb von Komponenten nutzbar (z. B. in Adaptern). */
export function translate(key: string, vars?: Record<string, string | number>): string {
  return get(t)(key, vars);
}

/** Zahl in der aktiven Sprache formatieren. */
export const fmtNumber = derived(locale, ($locale) => {
  const tag = $locale === 'lld' ? 'it' : $locale; // Ladinisch hat kein eigenes Zahlenformat
  const nf = new Intl.NumberFormat(tag);
  return (n: number, digits = 0) =>
    new Intl.NumberFormat(tag, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(n) || nf.format(n);
});

/** Uhrzeit/Datum in der aktiven Sprache formatieren. */
export const fmtTime = derived(locale, ($locale) => {
  const tag = $locale === 'lld' ? 'it' : $locale;
  return (d: Date | string, withDate = false) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(date.getTime())) return '–';
    return new Intl.DateTimeFormat(tag, {
      hour: '2-digit',
      minute: '2-digit',
      ...(withDate ? { day: '2-digit', month: '2-digit' } : {})
    }).format(date);
  };
});
