import type { SourceMeta } from '$lib/adapters/types';

/**
 * Feste Kennungen der Gemeinde Kastelruth.
 *
 * Alle Werte hier wurden am 05.09.2026 gegen die jeweiligen Schnittstellen
 * geprueft. Was nicht geliefert wurde, steht als Kommentar dabei - damit
 * spaeter niemand dieselbe Sackgasse noch einmal erkundet.
 */

export const GEMEINDE = {
  nameDe: 'Kastelruth',
  nameIt: 'Castelrotto',
  /** ISTAT-Gemeindecode, Schluessel fuer alle ASTAT-Abfragen. */
  istatCode: 21019,
  plz: '39040',
  /** Kennung in der Tourism-API des Open Data Hub. */
  odhMunicipalityId: '2119D9D1C4744C4E9701BF837DF63FFD',
  center: { lat: 46.5679, lon: 11.5594 },
  /** Umschliessendes Rechteck fuer Stationsabfragen: lonMin, latMin, lonMax, latMax. */
  bbox: [11.515, 46.505, 11.665, 46.605] as const
};

/* ------------------------------------------------------------------ */
/* Parkplaetze                                                         */
/* ------------------------------------------------------------------ */

export interface ParkingConfig {
  /** Stationscode im Open Data Hub. */
  code: string;
  nameDe: string;
  nameIt: string;
  capacity: number;
  lat: number;
  lon: number;
  /**
   * Manche Zaehlwerke liefern ein defektes Summenfeld. Ist das hier gesetzt,
   * rechnet der Adapter die Belegung aus den Teilwerten statt aus 'occupied'.
   * Geprueft am 05.09.2026: Centralpark meldet 'occupied' ueber 24 Stunden
   * konstant 0, waehrend 'occupied_short_stay' plausibel zwischen 11 und 54
   * schwankt. Ohne diese Korrektur zeigt die App einen leeren Parkplatz an,
   * obwohl er voll ist.
   */
  aggregateFieldBroken?: boolean;
  /** Spaltenpraefix in der oeffentlichen Zeitreihe (static/verlauf/verlauf.csv). */
  csvKey: string;
}

export const PARKPLAETZE: ParkingConfig[] = [
  {
    code: 'urn:parking:skidata:872f0c64-6753-57e5-a8f2-4fa7b002b4af',
    nameDe: 'Centralpark – Garage Dorf',
    nameIt: 'Centralpark – Garage Paese',
    capacity: 218,
    lat: 46.5666,
    lon: 11.5595,
    aggregateFieldBroken: true,
    csvKey: 'centralpark'
  },
  {
    code: 'urn:parking:skidata:f0d63a37-09bc-5f5c-83f9-f1cfea643b70',
    nameDe: 'Albin Gross Zentrum Garage',
    nameIt: 'Albin Gross Zentrum Garage',
    capacity: 97,
    lat: 46.5679,
    lon: 11.5613,
    csvKey: 'albingross'
  }
];

/**
 * Compatsch auf der Seiser Alm: 250 Plaetze laut amtlicher Sperrverordnung.
 * Es gibt dafuer KEINE offene Livedatenquelle - weder im Open Data Hub
 * (ParkingStation, ParkingFacility, ParkingSensor alle ohne Treffer) noch
 * beim Betreiber. Die Zahl wird deshalb nur als Kapazitaet gezeigt, nie als
 * Auslastung, und der Belastungs-Index rechnet sie nicht mit.
 * Sobald eine Quelle vorliegt, hier einen Adapter einhaengen.
 */
export const COMPATSCH = {
  capacity: 250,
  lat: 46.5406,
  lon: 11.6197,
  liveDataAvailable: false as const
};

/* ------------------------------------------------------------------ */
/* Seiser Alm-Strasse                                                  */
/* ------------------------------------------------------------------ */

/**
 * Kennung der Strasse im Verkehrsmeldedienst des Landes. Der amtliche
 * Datensatz enthaelt die Tagessperre im Klartext, inklusive Gueltigkeitszeitraum.
 * Deshalb sind hier keine Sperrzeiten hinterlegt - sie kommen aus der Quelle.
 */
export const SEISER_ALM_STRASSE = {
  streetNr: 'LS/SP25',
  nameDe: 'Seiser Alm',
  /** Weitere Strassen der Gemeinde, deren Meldungen ebenfalls angezeigt werden. */
  weitereStrassenNr: ['LS/SP64', 'LS/SP24'],
  /** Bezirk im Verkehrsbericht, dient als grober Vorfilter. */
  zone: 'Salten-Schlern'
};

/* ------------------------------------------------------------------ */
/* Webcams                                                             */
/* ------------------------------------------------------------------ */

export interface WebcamConfig {
  id: string;
  nameDe: string;
  nameIt: string;
  url: string;
  /** Quelle der Bild-URL, fuer die Quellenangabe. */
  attribution: string;
}

/**
 * Kuratierte Auswahl. Die Bild-URLs stammen aus der Tourism-API des Open Data
 * Hub, wurden aber einzeln geprueft: Zwei dort als aktiv gefuehrte Kameras
 * liefern seit 2023 dasselbe alte Bild und sind hier bewusst NICHT enthalten:
 *   - seis.it-wms.com/big_panorama1.jpg          (Stand 18.03.2023, dazu 19,5 MB)
 *   - seiseralmgoldknopf.it-wms.com/panorama1_raw.jpg (Stand 01.08.2023)
 * Alle unten aufgefuehrten Kameras waren bei der Pruefung wenige Minuten alt.
 */
export const WEBCAMS: WebcamConfig[] = [
  {
    id: 'kastelruth-dorf',
    nameDe: 'Kastelruth Dorf',
    nameIt: 'Castelrotto paese',
    url: 'https://kastelruth.it-wms.com/panorama1.jpg',
    attribution: 'it-wms.com'
  },
  {
    id: 'seis',
    nameDe: 'Seis am Schlern',
    nameIt: 'Siusi allo Sciliar',
    url: 'https://seisamschlern.it-wms.com/panorama1.jpg',
    attribution: 'it-wms.com'
  },
  {
    id: 'compatsch',
    nameDe: 'Compatsch (Seiser Alm)',
    nameIt: 'Compaccio (Alpe di Siusi)',
    url: 'https://panodata.panomax.com/cams/1389/preview_og.jpg',
    attribution: 'Panomax'
  },
  {
    id: 'puflatsch',
    nameDe: 'Puflatsch',
    nameIt: 'Bullaccia',
    url: 'https://live-image.panomax.com/cams/7296/preview_og.jpg',
    attribution: 'Panomax'
  },
  {
    id: 'goldknopf',
    nameDe: 'Goldknopf',
    nameIt: 'Punta d’Oro',
    url: 'https://live-image.panomax.com/cams/7293/preview_og.jpg',
    attribution: 'Panomax'
  }
];

/* ------------------------------------------------------------------ */
/* Umlaufbahn                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fuer die Umlaufbahn Seis - Seiser Alm gibt es keine Status-Schnittstelle.
 * Im Open Data Hub existiert nur ein Punkt-Eintrag "Talstation", ohne
 * Betriebsdaten und ohne Wartezeiten. Die Zeiten hier stammen aus dem
 * veroeffentlichten Fahrplan des Betreibers und muessen zu Saisonbeginn
 * nachgetragen werden. Die App kennzeichnet sie ausdruecklich als Fahrplan,
 * nicht als Live-Status.
 */
export interface Betriebszeitraum {
  /** ISO-Datum, einschliesslich. */
  von: string;
  /** ISO-Datum, einschliesslich. */
  bis: string;
  /** Erste Bergfahrt, lokale Zeit. */
  ab: string;
  /** Letzte Talfahrt, lokale Zeit. */
  bis_uhr: string;
  labelDe: string;
}

export const UMLAUFBAHN = {
  nameDe: 'Umlaufbahn Seis – Seiser Alm',
  nameIt: 'Cabinovia Siusi – Alpe di Siusi',
  betreiber: 'Seiser Alm Bahn AG',
  website: 'https://www.seiseralm.it/de/seiser-alm-bahn.html',
  liveStatusAvailable: false as const,
  /**
   * Zuletzt gepflegt am 05.09.2026. Quelle: seiseralm.it.
   * Vor jeder Saison pruefen - ein falscher Fahrplan ist schlimmer als keiner.
   */
  zeitraeume: [
    {
      von: '2026-05-16',
      bis: '2026-11-02',
      ab: '08:00',
      bis_uhr: '18:00',
      labelDe: 'Sommerbetrieb'
    }
  ] as Betriebszeitraum[]
};

/* ------------------------------------------------------------------ */
/* Wetter                                                              */
/* ------------------------------------------------------------------ */

/**
 * Tagesvorhersage des Landeswetterdienstes fuer Kastelruth (Open Data Hub,
 * Stationstyp WeatherForecast). Geprueft am 05.09.2026: liefert Wetterlage,
 * Temperatur, Niederschlag und Sonnenstunden fuer die naechsten vier Tage.
 * Der laufende Tag faellt aus der Reihe, sobald er begonnen hat - der Adapter
 * nimmt dann den naechsten verfuegbaren Tag und sagt das dazu.
 * Anonyme Abfragen duerfen hoechstens 5 Tage umfassen (API-Quota).
 */
export const WETTER = {
  stationCode: '021019',
  nameDe: 'Kastelruth (Landeswetterdienst)',
  maxRangeDays: 5
};

/* ------------------------------------------------------------------ */
/* Verlauf                                                             */
/* ------------------------------------------------------------------ */

/**
 * Oeffentliche Zeitreihe. Eine GitHub Action haengt alle 30 Minuten eine Zeile
 * an diese Datei (siehe scripts/sammeln.mjs). Sie liegt unter static/, damit
 * sie mit ausgeliefert wird und die App sie ohne Fremd-URL laden kann.
 */
export const VERLAUF = {
  pfad: '/verlauf/verlauf.csv',
  /** So viele Tage zeigt die Statistik-Seite. */
  anzeigeTage: 30
};

/* ------------------------------------------------------------------ */
/* Quellenangaben                                                      */
/* ------------------------------------------------------------------ */

/**
 * Bezugsjahr der ASTAT-Ebenen. Der WFS selbst nennt es nicht im Datensatz;
 * es steht im Katalogeintrag der Provinz ("Turismo Pernottamenti 2023",
 * "Popolazione residente Anagrafe 2023"), geprueft am 05.09.2026.
 * Bei einer Aktualisierung des Geodienstes hier nachziehen - sonst weist die
 * App korrekte Zahlen mit falschem Jahr aus.
 */
export const ASTAT_BEZUGSJAHR = 2023;

export const QUELLEN: Record<
  'odhMobility' | 'odhTourism' | 'trafficBulletin' | 'astat' | 'lokal',
  SourceMeta
> = {
  odhMobility: {
    id: 'odh-mobility' as const,
    labelKey: 'sources.odhMobility',
    url: 'https://mobility.api.opendatahub.com',
    license: 'CC0 / CC-BY'
  },
  odhTourism: {
    id: 'odh-tourism' as const,
    labelKey: 'sources.odhTourism',
    url: 'https://tourism.api.opendatahub.com',
    license: 'CC0 / CC-BY'
  },
  trafficBulletin: {
    id: 'traffic-bulletin' as const,
    labelKey: 'sources.trafficBulletin',
    url: 'https://static-verkehr.provinz.bz.it/publications/traffic/traffic.json',
    license: 'CC0'
  },
  astat: {
    id: 'astat-wfs' as const,
    labelKey: 'sources.astat',
    url: 'https://geoservices1.civis.bz.it/geoserver/p_bz-Astat/ows',
    license: 'CC0'
  },
  lokal: {
    id: 'local-config' as const,
    labelKey: 'sources.cablecarOperator',
    url: 'https://www.seiseralm.it'
  }
};
