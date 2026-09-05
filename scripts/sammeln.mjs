#!/usr/bin/env node
/**
 * Haengt eine Messzeile an die oeffentliche Zeitreihe static/verlauf/verlauf.csv.
 *
 * Laeuft als GitHub Action alle 30 Minuten (siehe .github/workflows/sammeln.yml)
 * und kostet nichts. Nach einer Saison liegt damit ein Datensatz vor, den jeder
 * nachpruefen kann - mit Zeitstempel und Commit-Historie. Das ist der Unterschied
 * zwischen "heute ist es voll" und "an 43 Tagen im August war die Strasse vor
 * neun Uhr zu".
 *
 * Es werden ROHWERTE gespeichert, keine abgeleiteten: Die App rechnet die
 * Belegung beim Lesen mit derselben Pruefung wie live (deriveOccupancy).
 * Aendert sich die Regel, gilt sie rueckwirkend fuer die ganze Reihe.
 *
 * Aufruf:  node scripts/sammeln.mjs
 * Rueckgabewert 0 auch bei fehlenden Einzelwerten - eine Luecke in einer Spalte
 * ist ein Messwert ("Quelle lieferte nicht"), kein Grund, den Lauf abzubrechen.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CSV = join(here, '..', 'static', 'verlauf', 'verlauf.csv');

const STATIONS = [
  ['centralpark', 'urn:parking:skidata:872f0c64-6753-57e5-a8f2-4fa7b002b4af'],
  ['albingross', 'urn:parking:skidata:f0d63a37-09bc-5f5c-83f9-f1cfea643b70']
];
const PARK_FIELDS = ['occupied', 'occupied_short_stay', 'occupied_subscribers'];

export const HEADER = [
  'zeit_utc',
  'strasse',
  'sperre_von',
  'sperre_bis',
  ...STATIONS.flatMap(([n]) => PARK_FIELDS.map((f) => `${n}_${f}`)),
  'wetter_tag',
  'wetter',
  'temp_max',
  'regen_mm'
].join(',');

async function json(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

/** Minuten seit Mitternacht in Ortszeit Suedtirol. */
function localMinutes(d) {
  const s = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
  const [h, m] = s.replace('.', ':').split(':').map(Number);
  return h * 60 + m;
}
const toMin = (hhmm) => hhmm.split(':').map(Number).reduce((h, m) => h * 60 + m);

/* ---------------------------- Strasse ---------------------------- */
async function strasse(now) {
  try {
    const data = await json('https://static-verkehr.provinz.bz.it/publications/traffic/traffic.json');
    const n = Object.values(data).find(
      (m) => (m.messageStreetNr ?? '').toUpperCase().replace(/\s+/g, '') === 'LS/SP25'
    );
    if (!n) return { strasse: 'unknown', von: '', bis: '' };
    const text = n.placeDe || n.descriptionDe || '';
    const m = text.match(/von\s+(\d{1,2}[:.]\d{2})\s*(?:Uhr\s*)?bis\s+(\d{1,2}[:.]\d{2})/i);
    const today = now.toISOString().slice(0, 10);
    const inSeason = (!n.beginDate || today >= n.beginDate) && (!n.endDate || today <= n.endDate);
    if (!m) return { strasse: inSeason ? 'restricted' : 'open', von: '', bis: '' };
    const von = m[1].replace('.', ':').padStart(5, '0');
    const bis = m[2].replace('.', ':').padStart(5, '0');
    if (!inSeason) return { strasse: 'open', von, bis };
    const lm = localMinutes(now);
    const closed = lm >= toMin(von) && lm < toMin(bis);
    return { strasse: closed ? 'closed' : 'open', von, bis };
  } catch (e) {
    console.error('Verkehrsbericht:', e.message);
    return { strasse: '', von: '', bis: '' };
  }
}

/* --------------------------- Parkplaetze -------------------------- */
async function parkplaetze() {
  const out = {};
  for (const [n] of STATIONS) for (const f of PARK_FIELDS) out[`${n}_${f}`] = '';
  try {
    const list = STATIONS.map(([, c]) => `"${c}"`).join(',');
    const url =
      'https://mobility.api.opendatahub.com/v2/flat/ParkingStation/*/latest?limit=-1' +
      `&select=scode,tname,mvalue&where=scode.in.(${list}),tname.in.(${PARK_FIELDS.map((f) => `"${f}"`).join(',')})`;
    const res = await json(url);
    for (const r of res.data ?? []) {
      const st = STATIONS.find(([, c]) => c === r.scode);
      if (st && PARK_FIELDS.includes(r.tname)) out[`${st[0]}_${r.tname}`] = String(r.mvalue);
    }
  } catch (e) {
    console.error('Parkplaetze:', e.message);
  }
  return out;
}

/* ----------------------------- Wetter ----------------------------- */
async function wetter(now) {
  try {
    const from = new Date(now.getTime() - 86400 * 1000).toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 2 * 86400 * 1000).toISOString().slice(0, 10);
    const url =
      'https://mobility.api.opendatahub.com/v2/flat/WeatherForecast/' +
      'qualitative-forecast,forecast-air-temperature-max,forecast-precipitation-sum/' +
      `${from}/${to}?limit=-1&select=tname,mvalue,mvalidtime&where=scode.eq."021019",mperiod.eq.86400`;
    const res = await json(url);
    const localDay = (d) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    const today = localDay(now);
    const days = {};
    for (const r of res.data ?? []) {
      const day = localDay(new Date(new Date(r.mvalidtime).getTime() + 2 * 3600 * 1000));
      (days[day] ??= {})[r.tname] = r.mvalue;
    }
    // Heute bevorzugt, sonst der naechste Tag - und das Datum bleibt im Wert erkennbar.
    const key = Object.keys(days).filter((d) => d >= today).sort()[0];
    const v = key ? days[key] : {};
    // wetter_tag sagt, fuer welchen Tag die Vorhersage gilt. Fehlt der heutige
    // in der Reihe, steht hier das morgige Datum - und niemand haelt spaeter
    // die Morgen-Vorhersage fuer das Wetter des Messtags.
    return {
      wetter_tag: key ?? '',
      wetter: v['qualitative-forecast'] ?? '',
      temp_max: v['forecast-air-temperature-max'] ?? '',
      regen_mm: v['forecast-precipitation-sum'] ?? ''
    };
  } catch (e) {
    console.error('Wetter:', e.message);
    return { wetter_tag: '', wetter: '', temp_max: '', regen_mm: '' };
  }
}

/* ------------------------------ Lauf ------------------------------ */
const now = new Date();
const [s, p, w] = await Promise.all([strasse(now), parkplaetze(), wetter(now)]);

const row = [
  now.toISOString().slice(0, 19) + 'Z',
  s.strasse,
  s.von,
  s.bis,
  ...STATIONS.flatMap(([n]) => PARK_FIELDS.map((f) => p[`${n}_${f}`])),
  w.wetter_tag,
  String(w.wetter).replace(/,/g, ';'),
  w.temp_max,
  w.regen_mm
].join(',');

mkdirSync(dirname(CSV), { recursive: true });
let content = existsSync(CSV) ? readFileSync(CSV, 'utf8') : '';
if (!content.startsWith(HEADER)) content = HEADER + '\n' + content.replace(/^[^\n]*\n?/, '');
if (!content.endsWith('\n')) content += '\n';
content += row + '\n';
writeFileSync(CSV, content, 'utf8');

console.log(row);
console.log(`-> ${content.split('\n').filter(Boolean).length - 1} Zeilen in verlauf.csv`);
