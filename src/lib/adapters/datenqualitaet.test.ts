import { describe, it, expect } from 'vitest';
import { deriveOccupancy, shape } from './parking';
import { evaluate as evaluateRoad, parseDailyClosure, type TrafficNotice } from './traffic';
import { computeLoadIndex, checkWarning } from '$lib/logic/load-index';
import { conditionKey, weatherScore, shape as shapeWeather } from './weather';
import { parseCsv, aggregate, toHistory } from './verlauf';
import type { ParkingConfig } from '$lib/config/kastelruth';

/**
 * Diese Tests sichern die Stellen, an denen die App eine Quelle korrigiert
 * oder eine Luecke bewusst offen laesst. Genau dort waere ein Fehler am
 * schaedlichsten: Eine falsche Zahl mit Nachkommastelle wirkt glaubwuerdiger
 * als gar keine.
 */

const cfg = (over: Partial<ParkingConfig> = {}): ParkingConfig => ({
  code: 'test',
  nameDe: 'Test',
  nameIt: 'Test',
  capacity: 218,
  lat: 0,
  lon: 0,
  csvKey: 'test',
  ...over
});

const vals = (o: Record<string, number>) =>
  new Map(Object.entries(o).map(([k, v]) => [k, { value: v, at: '2026-09-05T16:55:00Z' }]));

describe('Parkplatz-Belegung', () => {
  it('verwirft den Gesamtwert 0, wenn Teilwerte Autos melden', () => {
    // Genau der Fall Centralpark: occupied konstant 0, Teilwerte plausibel.
    const r = deriveOccupancy(
      vals({ occupied: 0, occupied_short_stay: 26, occupied_subscribers: 0 }),
      cfg()
    );
    expect(r.occupied).toBe(26);
    expect(r.note).toBe('parking.dataIssue');
  });

  it('erkennt den defekten Gesamtwert auch ohne Konfigurationsflagge', () => {
    const r = deriveOccupancy(
      vals({ occupied: 0, occupied_short_stay: 40, occupied_subscribers: 5 }),
      cfg({ aggregateFieldBroken: false })
    );
    expect(r.occupied).toBe(45);
    expect(r.note).toBe('parking.dataIssue');
  });

  it('uebernimmt einen plausiblen Gesamtwert unveraendert', () => {
    const r = deriveOccupancy(
      vals({ occupied: 16, occupied_short_stay: 7, occupied_subscribers: 9 }),
      cfg({ capacity: 97 })
    );
    expect(r.occupied).toBe(16);
    expect(r.note).toBeUndefined();
  });

  it('meldet keinen Wert, statt bei fehlenden Daten 0 zu behaupten', () => {
    const r = deriveOccupancy(vals({}), cfg());
    expect(r.occupied).toBeNull();
  });

  it('unterdrueckt eine Prognose, die durchgehend 0 sagt, obwohl Autos stehen', () => {
    const lots = shape([
      { scode: 'x', tname: 'occupied_short_stay', mvalue: 26, mvalidtime: 't' },
      { scode: 'x', tname: 'parking-forecast-30', mvalue: 0.1, mvalidtime: 't' },
      { scode: 'x', tname: 'parking-forecast-60', mvalue: -0.1, mvalidtime: 't' }
    ]);
    // shape() arbeitet gegen die echte Konfiguration; der Testcode 'x' kommt
    // dort nicht vor, also darf auch keine Prognose entstehen.
    expect(lots.every((l) => l.forecast.length === 0)).toBe(true);
  });
});

describe('Sperrzeit aus der amtlichen Meldung', () => {
  const text =
    'Bei St. Valentin (km 2,500) SPERRE von 09:00 bis 17:00 Uhr. Sind die 250 Parkplätze auf der Seiser Alm bereits besetzt, wird schon vor 09:00 Uhr gesperrt (gilt auch für Busse).';

  it('liest das Zeitfenster aus dem Klartext', () => {
    expect(parseDailyClosure(text)).toEqual({ from: '09:00', to: '17:00' });
  });

  it('erfindet kein Zeitfenster, wenn keines im Text steht', () => {
    expect(parseDailyClosure('Keine Beschränkungen.')).toBeNull();
  });

  const notice: TrafficNotice = {
    streetNr: 'LS/SP25',
    streetName: 'Seiser Alm',
    text,
    grade: 'Sperre',
    type: 'Sperre',
    validFrom: '2026-05-22',
    validTo: '2026-11-02',
    lat: null,
    lon: null
  };

  it('meldet gesperrt waehrend des Sperrfensters', () => {
    // 12:00 Uhr Ortszeit Suedtirol
    const r = evaluateRoad([notice], new Date('2026-09-05T10:00:00Z'));
    expect(r.state).toBe('closed');
    expect(r.nextChange).toEqual({ kind: 'opens', time: '17:00', tomorrow: false });
  });

  it('meldet am Morgen offen mit Sperre noch heute', () => {
    const r = evaluateRoad([notice], new Date('2026-09-05T05:00:00Z')); // 07:00 Ortszeit
    expect(r.state).toBe('open');
    expect(r.nextChange).toEqual({ kind: 'closes', time: '09:00', tomorrow: false });
  });

  it('meldet am Abend offen mit Sperre erst morgen', () => {
    const r = evaluateRoad([notice], new Date('2026-09-05T17:40:00Z')); // 19:40 Ortszeit
    expect(r.state).toBe('open');
    expect(r.nextChange?.tomorrow).toBe(true);
  });

  it('behandelt die Strasse ausserhalb der Saison als offen', () => {
    const r = evaluateRoad([notice], new Date('2026-12-20T10:00:00Z'));
    expect(r.state).toBe('open');
    expect(r.seasonActive).toBe(false);
  });

  it('erkennt den Vorbehalt der vorzeitigen Sperre', () => {
    expect(evaluateRoad([notice], new Date('2026-09-05T05:00:00Z')).earlyClosurePossible).toBe(
      true
    );
  });

  it('sagt "unbekannt" statt zu raten, wenn die Meldung fehlt', () => {
    const r = evaluateRoad([], new Date('2026-09-05T10:00:00Z'));
    expect(r.state).toBe('unknown');
    expect(r.dailyClosure).toBeNull();
  });
});

describe('Belastungs-Index', () => {
  it('verteilt das Gewicht fehlender Faktoren auf die uebrigen', () => {
    const i = computeLoadIndex({ parking: null, road: null }, new Date('2026-08-15T10:00:00Z'));
    const used = i.factors.filter((f) => f.score !== null);
    const sum = used.reduce((s, f) => s + f.effectiveWeight, 0);
    // Saison und Wochentag bleiben uebrig - zusammen muessen sie volle 100 % tragen.
    expect(used).toHaveLength(2);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('kennzeichnet Annahmen und weist den gemessenen Anteil aus', () => {
    const i = computeLoadIndex({ parking: null, road: null }, new Date('2026-08-15T10:00:00Z'));
    expect(i.measuredShare).toBe(0);
    expect(i.factors.filter((f) => f.assumption).map((f) => f.id)).toEqual(['season', 'weekday']);
  });

  it('bleibt im Bereich 0 bis 100', () => {
    const i = computeLoadIndex(
      {
        parking: [
          {
            code: 'a',
            nameDe: 'a',
            nameIt: 'a',
            capacity: 100,
            occupied: 100,
            free: 0,
            ratio: 1,
            measuredAt: null,
            forecast: [],
            lat: 0,
            lon: 0
          }
        ],
        road: {
          state: 'closed',
          dailyClosure: { from: '09:00', to: '17:00' },
          seasonActive: true,
          validFrom: null,
          validTo: null,
          notice: null,
          otherNotices: [],
          earlyClosurePossible: true,
          nextChange: null
        }
      },
      new Date('2026-08-15T10:00:00Z')
    );
    expect(i.value).toBeGreaterThan(0);
    expect(i.value).toBeLessThanOrEqual(100);
  });
});

describe('Fruehwarnung', () => {
  it('schlaegt erst nach drei zusammenhaengenden Tagen an', () => {
    const h = [
      { date: '2026-09-03', value: 80 },
      { date: '2026-09-04', value: 82 },
      { date: '2026-09-05', value: 78 }
    ];
    expect(checkWarning(h).active).toBe(true);
    expect(checkWarning(h).days).toBe(3);
  });

  it('zaehlt eine Luecke im Verlauf nicht als zusammenhaengend', () => {
    const h = [
      { date: '2026-08-01', value: 90 },
      { date: '2026-08-02', value: 90 },
      { date: '2026-09-05', value: 90 }
    ];
    expect(checkWarning(h).active).toBe(false);
  });

  it('schlaegt nicht an, solange der Schwellwert nicht ueberschritten ist', () => {
    const h = [
      { date: '2026-09-03', value: 70 },
      { date: '2026-09-04', value: 74 },
      { date: '2026-09-05', value: 75 }
    ];
    expect(checkWarning(h).active).toBe(false);
  });
});

describe('Wetter-Vorhersage', () => {
  it('ordnet Regen vor Bewoelkung ein', () => {
    expect(conditionKey('cloudy with moderate rain')).toBe('weather.q.rain');
    expect(conditionKey('cloudy, thunderstorms with moderate showers')).toBe('weather.q.thunderstorm');
    expect(conditionKey('partly cloudy')).toBe('weather.q.partlyCloudy');
    expect(conditionKey('very cloudy')).toBe('weather.q.veryCloudy');
  });

  it('bewertet Schoenwetter hoch und Dauerregen niedrig', () => {
    const base = { date: '2026-08-15', condition: '', tempMin: null, precipitationProbability: null, sunshineHours: null };
    const sonne = { ...base, conditionKey: 'weather.q.sunny', tempMax: 28, precipitationMm: 0 };
    const regen = { ...base, conditionKey: 'weather.q.rain', tempMax: 12, precipitationMm: 20 };
    expect(weatherScore(sonne)).toBe(100);
    expect(weatherScore(regen)).toBe(0);
  });

  it('legt einen Tageswert auf den richtigen Kalendertag', () => {
    // 22:00 UTC am 05.09. ist Mitternacht Ortszeit des 06.09.
    const w = shapeWeather(
      [{ tname: 'qualitative-forecast', mvalue: 'sunny', mvalidtime: '2026-09-05 22:00:00.000+0000' }],
      new Date('2026-09-05T18:00:00Z')
    );
    expect(w.days[0].date).toBe('2026-09-06');
    expect(w.todayMissing).toBe(true);
  });
});

describe('Oeffentliche Zeitreihe', () => {
  const csv = [
    'zeit_utc,strasse,sperre_von,sperre_bis,test_occupied,test_occupied_short_stay,test_occupied_subscribers,wetter_tag,wetter,temp_max,regen_mm',
    '2026-08-15T07:00:00Z,open,09:00,17:00,0,40,0,2026-08-15,sunny,28,0',
    '2026-08-15T10:00:00Z,closed,09:00,17:00,0,90,0,2026-08-15,sunny,28,0',
    '2026-08-16T10:00:00Z,open,09:00,17:00,0,10,0,,,,'
  ].join('\n');

  it('liest die Datei und bildet Tageswerte', () => {
    const v = aggregate(parseCsv(csv));
    expect(v.totalSamples).toBe(3);
    expect(v.days.map((d) => d.date)).toEqual(['2026-08-15', '2026-08-16']);
    expect(v.days[0].samples).toBe(2);
    expect(v.days[0].closedShare).toBe(0.5);
    expect(v.days[1].closedShare).toBe(0);
  });

  it('liefert das Tagesmaximum fuer die Fruehwarnung', () => {
    const h = toHistory(aggregate(parseCsv(csv)));
    expect(h).toHaveLength(2);
    expect(h[0].value).toBeGreaterThan(h[1].value);
  });

  it('kommt mit einer leeren Datei zurecht', () => {
    const v = aggregate(parseCsv('zeit_utc,strasse\n'));
    expect(v.days).toEqual([]);
    expect(v.totalSamples).toBe(0);
  });
});
