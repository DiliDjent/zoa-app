/**
 * Datenmodelle fuer Phase 2.
 *
 * Diese Typen sind bewusst schon jetzt festgelegt, damit die Adapter-Schicht
 * spaeter dagegen bauen kann. Es gibt noch keine Implementierung.
 *
 * Zwei Regeln sind in die Modelle eingebaut, nicht nur in die Doku:
 *  - Keine personenbezogenen Daten Dritter. Wo Personen vorkommen, sind es
 *    ausschliesslich gewaehlte Mandatstraeger in ihrer oeffentlichen Rolle -
 *    das ist Zeitgeschehen, kein Privatleben.
 *  - Meldungen von Buergern sind nie oeffentlich. Der Typ trennt deshalb
 *    strikt zwischen dem, was die Gemeinde bekommt, und dem, was die App zeigt.
 */

/* ------------------------------------------------------------------ */
/* Transparenz-Ticker                                                  */
/* ------------------------------------------------------------------ */

export type BeschlussArt = 'gemeinderat' | 'gemeindeausschuss' | 'buergermeister' | 'bauantrag';

export interface Beschluss {
  id: string;
  /** Aktenzeichen im Albo Pretorio. */
  aktenzeichen: string;
  art: BeschlussArt;
  datum: string;
  /** Amtlicher Titel, unveraendert aus der Quelle. */
  titelOriginal: string;
  /**
   * Zusammenfassung in einfacher Sprache, je Sprachcode.
   * Muss immer als Zusammenfassung gekennzeichnet werden, nie als amtlicher
   * Text - und der Originaltext bleibt jederzeit einsehbar.
   */
  zusammenfassung: Record<string, string>;
  /** true, wenn die Zusammenfassung maschinell erstellt wurde. */
  maschinellZusammengefasst: boolean;
  /** Link zum amtlichen Dokument, damit jede Aussage pruefbar bleibt. */
  quelleUrl: string;
  /** Betrag in Euro, falls der Beschluss Geld bewegt. */
  betragEuro?: number;
  themen: string[];
}

export type Stimmverhalten = 'dafuer' | 'dagegen' | 'enthaltung' | 'abwesend';

export interface Abstimmung {
  beschlussId: string;
  /**
   * Gewaehlte Mandatstraeger in oeffentlicher Funktion. Keine Privatpersonen.
   * Quelle ist immer das oeffentliche Sitzungsprotokoll.
   */
  stimmen: { mandatar: string; liste: string; verhalten: Stimmverhalten }[];
  protokollUrl: string;
}

export type VersprechenStand = 'offen' | 'in_arbeit' | 'umgesetzt' | 'aufgegeben' | 'unklar';

export interface Versprechen {
  id: string;
  /** Alle Listen werden gleich behandelt - der Tracker ist kein Wahlkampfmittel. */
  liste: string;
  wahljahr: number;
  text: Record<string, string>;
  stand: VersprechenStand;
  /** Belege fuer die Einstufung. Ohne Beleg keine Einstufung. */
  belege: { titel: string; url: string; datum: string }[];
  /** Wann die Einstufung zuletzt geprueft wurde. */
  geprueftAm: string;
}

export interface Einnahmeposten {
  jahr: number;
  /** z. B. "Ortstaxe", "Parkgebuehren". */
  kategorie: string;
  einnahmenEuro: number | null;
  /** Wofuer das Geld laut Haushalt verwendet wurde. */
  verwendung: { zweck: string; betragEuro: number }[];
  quelleUrl: string;
}

/* ------------------------------------------------------------------ */
/* Bürger-Voting                                                       */
/* ------------------------------------------------------------------ */

export interface Umfrage {
  id: string;
  startDatum: string;
  endDatum: string;
  frage: Record<string, string>;
  optionen: { id: string; text: Record<string, string> }[];
  /** Ergebnisse erst nach Ende sichtbar, um Meinungsbildung nicht zu lenken. */
  ergebnisSichtbarAb: string;
}

export interface UmfrageErgebnis {
  umfrageId: string;
  /** Nur Summen. Es wird nicht gespeichert, wer wie gestimmt hat. */
  stimmenJeOption: Record<string, number>;
  gesamt: number;
  /**
   * Diese Umfrage ist kein Referendum und nicht repraesentativ.
   * Das Feld zwingt die Oberflaeche, den Vorbehalt anzuzeigen.
   */
  hinweisKeineRepraesentativitaet: true;
}

/* ------------------------------------------------------------------ */
/* Melder                                                              */
/* ------------------------------------------------------------------ */

export type MeldungKategorie =
  | 'muell'
  | 'infrastruktur'
  | 'beleuchtung'
  | 'weg'
  | 'sonstiges';

/**
 * Eine Meldung an die Gemeinde.
 *
 * Bewusst OHNE Absenderfeld: Die App leitet die Meldung weiter, ohne eine
 * Identitaet zu speichern. Wer eine Rueckmeldung will, gibt seine Adresse
 * direkt im Text an - dann liegt die Entscheidung bei ihm.
 */
export interface Meldung {
  id: string;
  kategorie: MeldungKategorie;
  /** Freitext des Melders. */
  beschreibung: string;
  /** Grob gerundeter Ort, damit kein Haus eindeutig bestimmbar wird. */
  ortUngefaehr: { lat: number; lon: number };
  fotoDataUrl?: string;
  erstelltAm: string;
  /**
   * Immer false. Meldungen werden nie oeffentlich angezeigt - weder Text noch
   * Ort noch Foto. Das Feld existiert, damit diese Regel im Typ steht und
   * nicht nur in einer Notiz.
   */
  oeffentlich: false;
  /** Empfaenger ist ausschliesslich die Gemeinde. */
  empfaenger: 'gemeinde';
}

/* ------------------------------------------------------------------ */
/* Wohnen                                                              */
/* ------------------------------------------------------------------ */

/** Minimaler GeoJSON-Polygonausschnitt - vermeidet eine zusaetzliche Abhaengigkeit. */
export interface ZonenPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

/**
 * Leerstand und Zweitwohnungen - ausschliesslich als Zonenwert.
 *
 * Es werden keine Adressen, Katasterdaten oder Eigentuemer gespeichert. Eine
 * Zone wird nur ausgewiesen, wenn sie genug Wohneinheiten enthaelt, damit sich
 * daraus keine einzelne Wohnung ableiten laesst.
 */
export interface WohnZone {
  zoneId: string;
  bezeichnung: Record<string, string>;
  /** Umriss der Zone. */
  geometrie: ZonenPolygon | null;
  wohneinheitenGesamt: number;
  anteilZweitwohnungen: number | null;
  anteilLeerstand: number | null;
  /** Mindestgroesse, unter der nichts ausgewiesen wird. */
  readonly mindestWohneinheiten: 30;
  bezugsjahr: number;
  quelleUrl: string;
}

export interface WohnungsAngebot {
  id: string;
  /** Nur fuer Ansaessige. Pruefung laeuft ueber die Gemeinde, nicht ueber die App. */
  nurFuerAnsaessige: boolean;
  zimmer: number;
  flaecheQm: number;
  kaltmieteEuro: number | null;
  zoneId: string;
  /** Kontakt laeuft ueber die Gemeinde, damit keine Daten in der App liegen. */
  kontaktUeberGemeinde: true;
  eingestelltAm: string;
}
