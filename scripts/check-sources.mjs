#!/usr/bin/env node
/**
 * Prueft alle Datenquellen der App und meldet, was nicht mehr liefert.
 *
 * Hintergrund: Bei der ersten Erkundung standen zwei Webcams im Open Data Hub
 * als "Active: true", lieferten aber seit 2023 dasselbe Bild. So etwas faellt
 * im Betrieb sonst niemandem auf - die App zeigt dann monatelang ein altes
 * Bild als aktuelle Lage.
 *
 * Aufruf:  npm run daten:pruefen
 * Rueckgabewert 1, wenn mindestens eine Quelle beanstandet wird - damit sich
 * das Skript in einen Zeitplan oder eine CI-Pipeline haengen laesst.
 */

const OK = '✓';
const WARN = '!';
const FAIL = '✗';

let problems = 0;
const line = (mark, label, detail) => console.log(`  ${mark} ${label.padEnd(34)} ${detail}`);

async function head(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    // Body verwerfen, aber Header behalten.
    const lastModified = res.headers.get('last-modified');
    const type = res.headers.get('content-type') ?? '';
    const buf = res.ok ? await res.arrayBuffer() : null;
    return { ok: res.ok, status: res.status, lastModified, type, bytes: buf?.byteLength ?? 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function json(url, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function ageHours(lastModified) {
  if (!lastModified) return null;
  const d = new Date(lastModified);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3600000;
}

/* ------------------------------------------------------------------ */

async function pruefeVerkehr() {
  console.log('\nVerkehrsmeldedienst des Landes');
  try {
    const data = await json('https://static-verkehr.provinz.bz.it/publications/traffic/traffic.json');
    const all = Object.values(data);
    const seiser = all.find(
      (m) => (m.messageStreetNr ?? '').toUpperCase().replace(/\s+/g, '') === 'LS/SP25'
    );
    if (!seiser) {
      line(FAIL, 'Meldung LS/SP25 Seiser Alm', 'FEHLT - Ampel kann nichts anzeigen');
      problems++;
      return;
    }
    const text = seiser.placeDe ?? seiser.descriptionDe ?? '';
    const zeit = text.match(/von\s+(\d{1,2}[:.]\d{2})\s*(?:Uhr\s*)?bis\s+(\d{1,2}[:.]\d{2})/i);
    line(OK, 'Meldung LS/SP25 vorhanden', `${all.length} Meldungen gesamt`);
    if (zeit) {
      line(OK, 'Sperrzeit lesbar', `${zeit[1]} bis ${zeit[2]}, gueltig bis ${seiser.endDate}`);
    } else {
      line(WARN, 'Sperrzeit NICHT lesbar', 'Textformat geaendert - parseDailyClosure pruefen');
      problems++;
    }
  } catch (e) {
    line(FAIL, 'Verkehrsbericht', e.message);
    problems++;
  }
}

async function pruefeParkplaetze() {
  console.log('\nParkplaetze (Open Data Hub)');
  const codes = [
    ['Centralpark – Garage Dorf', 'urn:parking:skidata:872f0c64-6753-57e5-a8f2-4fa7b002b4af'],
    ['Albin Gross Zentrum Garage', 'urn:parking:skidata:f0d63a37-09bc-5f5c-83f9-f1cfea643b70']
  ];
  const list = codes.map(([, c]) => `"${c}"`).join(',');
  const url =
    'https://mobility.api.opendatahub.com/v2/flat/ParkingStation/*/latest?limit=-1' +
    `&select=scode,tname,mvalue,mvalidtime&where=scode.in.(${list})`;
  try {
    const res = await json(url);
    for (const [name, code] of codes) {
      const rows = (res.data ?? []).filter((r) => r.scode === code);
      if (rows.length === 0) {
        line(FAIL, name, 'keine Messwerte');
        problems++;
        continue;
      }
      const occ = rows.find((r) => r.tname === 'occupied');
      const short = rows.find((r) => r.tname === 'occupied_short_stay');
      // Prognosewerte tragen Zeitstempel in der Zukunft und wuerden ein
      // negatives Datenalter ergeben - hier zaehlen nur echte Messungen.
      const newest = rows
        .filter((r) => !r.tname.startsWith('parking-forecast'))
        .map((r) => new Date(r.mvalidtime).getTime())
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => b - a)[0];
      const minutes =
        newest === undefined ? null : Math.round((Date.now() - newest) / 60000);

      // Kontrollzahl: Gesamtwert 0 bei belegten Teilplaetzen heisst defektes Zaehlwerk.
      const broken = occ && short && occ.mvalue === 0 && short.mvalue > 0;
      const stale = minutes === null || minutes > 60;
      if (stale) problems++;
      line(
        stale ? FAIL : broken ? WARN : OK,
        name,
        (minutes === null ? 'keine echte Messung' : `juengster Wert ${minutes} Min. alt`) +
          (broken ? ` | occupied=0 trotz short_stay=${short.mvalue} (Korrektur greift)` : '')
      );
    }
  } catch (e) {
    line(FAIL, 'Parkplatz-Abfrage', e.message);
    problems++;
  }
}

async function pruefeWebcams() {
  console.log('\nWebcams (Bildalter)');
  const cams = [
    ['Kastelruth Dorf', 'https://kastelruth.it-wms.com/panorama1.jpg'],
    ['Seis am Schlern', 'https://seisamschlern.it-wms.com/panorama1.jpg'],
    ['Compatsch', 'https://panodata.panomax.com/cams/1389/preview_og.jpg'],
    ['Puflatsch', 'https://live-image.panomax.com/cams/7296/preview_og.jpg'],
    ['Goldknopf', 'https://live-image.panomax.com/cams/7293/preview_og.jpg']
  ];
  for (const [name, url] of cams) {
    try {
      const r = await head(url);
      if (!r.ok) {
        line(FAIL, name, `HTTP ${r.status}`);
        problems++;
        continue;
      }
      const h = ageHours(r.lastModified);
      const kb = Math.round(r.bytes / 1024);
      if (h === null) {
        line(OK, name, `${kb} KB, Alter unbekannt (kein Last-Modified)`);
      } else if (h > 24) {
        line(FAIL, name, `Bild ist ${(h / 24).toFixed(0)} Tage alt - Kamera tot?`);
        problems++;
      } else if (h > 3) {
        line(WARN, name, `Bild ist ${h.toFixed(1)} Stunden alt`);
        problems++;
      } else {
        line(OK, name, `${kb} KB, ${Math.round(h * 60)} Min. alt`);
      }
    } catch (e) {
      line(FAIL, name, e.message);
      problems++;
    }
  }
}

async function pruefeAstat() {
  console.log('\nASTAT-Jahresstatistik (WFS)');
  const layers = [
    ['Naechtigungen/Betten', 'TouristOvernightStays', 'FN_NACHT'],
    ['Wohnbevoelkerung', 'OfficialResidentPopulation', 'BW_WOHNBEV'],
    ['Fahrzeuge', 'RegisteredVehicles-PRA', 'VK_PRA_C_V']
  ];
  for (const [name, layer, field] of layers) {
    const url =
      'https://geoservices1.civis.bz.it/geoserver/p_bz-Astat/ows?service=WFS&version=2.0.0' +
      `&request=GetFeature&typeNames=p_bz-Astat:${layer}&outputFormat=application/json` +
      '&CQL_FILTER=ISTAT_CODE=21019';
    try {
      const fc = await json(url);
      const props = fc.features?.[0]?.properties;
      const v = props?.[field];
      if (typeof v === 'number') line(OK, name, `${field} = ${v.toLocaleString('de-DE')}`);
      else {
        line(FAIL, name, `Feld ${field} fehlt - Schema geaendert?`);
        problems++;
      }
    } catch (e) {
      line(FAIL, name, e.message);
      problems++;
    }
  }
}

async function pruefeWetter() {
  console.log('\nWettervorhersage (Landeswetterdienst, Open Data Hub)');
  const from = new Date(Date.now() - 86400 * 1000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 3 * 86400 * 1000).toISOString().slice(0, 10);
  const url =
    'https://mobility.api.opendatahub.com/v2/flat/WeatherForecast/qualitative-forecast,forecast-air-temperature-max/' +
    `${from}/${to}?limit=-1&select=tname,mvalue,mvalidtime&where=scode.eq."021019",mperiod.eq.86400`;
  try {
    const res = await json(url);
    const days = new Set((res.data ?? []).map((r) => r.mvalidtime.slice(0, 10)));
    if (days.size === 0) {
      line(FAIL, 'Tagesvorhersage Kastelruth', 'keine Werte - Station 021019 pruefen');
      problems++;
    } else {
      line(OK, 'Tagesvorhersage Kastelruth', `${days.size} Tage vorhanden`);
    }
  } catch (e) {
    line(FAIL, 'Tagesvorhersage Kastelruth', e.message);
    problems++;
  }
}

async function pruefeUmlaufbahn() {
  console.log('\nUmlaufbahn-Fahrplan (gepflegte Konfiguration)');
  // Der Fahrplan kommt nicht aus einer Schnittstelle, sondern aus der
  // Konfiguration. Geprueft wird deshalb nur, ob er noch in die Zukunft reicht -
  // ein abgelaufener Fahrplan liesse die App "Betriebspause" behaupten.
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/lib/config/kastelruth.ts', import.meta.url), 'utf8');
  const enden = [...src.matchAll(/bis:\s*'(\d{4}-\d{2}-\d{2})'/g)].map((m) => m[1]).sort();
  const letztes = enden.at(-1);
  const heute = new Date().toISOString().slice(0, 10);

  if (!letztes) {
    line(FAIL, 'Fahrplan', 'kein Betriebszeitraum hinterlegt');
    problems++;
  } else if (letztes < heute) {
    line(FAIL, 'Fahrplan', `abgelaufen am ${letztes} - in kastelruth.ts nachtragen`);
    problems++;
  } else {
    line(OK, 'Fahrplan', `hinterlegt bis ${letztes}`);
  }
}

/* ------------------------------------------------------------------ */

console.log('Pruefe die Datenquellen der ZOA-App …');
await pruefeVerkehr();
await pruefeParkplaetze();
await pruefeWebcams();
await pruefeAstat();
await pruefeWetter();
await pruefeUmlaufbahn();

console.log(
  problems === 0
    ? '\nAlle Quellen liefern wie erwartet.\n'
    : `\n${problems} Beanstandung(en). Bitte pruefen, bevor die App etwas Falsches anzeigt.\n`
);
process.exit(problems === 0 ? 0 : 1);
