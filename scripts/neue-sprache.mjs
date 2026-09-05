#!/usr/bin/env node
/**
 * Legt eine neue Sprachdatei als Vorlage an - gleiche Struktur wie de.json,
 * alle Werte leer. Leere Werte fallen in der App automatisch auf Deutsch zurueck,
 * es entstehen also keine leeren Stellen in der Oberflaeche.
 *
 * Aufruf:  node scripts/neue-sprache.mjs <code>
 * Beispiel: node scripts/neue-sprache.mjs en
 *
 * Danach: Datei uebersetzen und in src/lib/i18n/index.ts in LOCALES eintragen.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'src', 'lib', 'i18n', 'locales');

const code = process.argv[2];
if (!code || !/^[a-z]{2,3}$/.test(code)) {
  console.error('Bitte einen Sprachcode angeben, z. B.:  node scripts/neue-sprache.mjs en');
  process.exit(1);
}

const target = join(localesDir, `${code}.json`);
if (existsSync(target)) {
  console.error(`${code}.json existiert bereits. Nichts geaendert.`);
  process.exit(1);
}

const master = JSON.parse(readFileSync(join(localesDir, 'de.json'), 'utf8'));

function blank(node) {
  if (typeof node === 'string') return '';
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = blank(v);
  return out;
}

const template = {
  _meta: {
    status: 'vorlage',
    hinweis:
      'Leere Werte fallen automatisch auf Deutsch zurueck. Uebersetzte Werte eintragen und status auf "geprueft" setzen.',
    geprueftVon: ''
  },
  ...blank(master)
};

writeFileSync(target, JSON.stringify(template, null, 2) + '\n', 'utf8');
console.log(`Vorlage angelegt: src/lib/i18n/locales/${code}.json`);
console.log('Naechster Schritt: in src/lib/i18n/index.ts importieren und in LOCALES eintragen.');
