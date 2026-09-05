# ZOA-App

Bürger-Web-App für die Gemeinde Kastelruth (Südtirol). Sie macht die Belastung
durch den Tourismus in Zahlen sichtbar und soll später Transparenz über die
Gemeindepolitik schaffen.

**Absender ist „Bürger von Kastelruth".** Kein Parteiprojekt, keine Liste, kein
kommerzielles Angebot. Die App speichert keine personenbezogenen Daten und ist
ausdrücklich kein Denunziationswerkzeug.

---

## Grundsatz

> Wo keine Daten existieren, steht das ausdrücklich da. Geschätzt wird nichts.

Jeder angezeigte Wert nennt seine Quelle und sein Alter. Fällt eine Quelle aus,
zeigt die App den letzten bekannten Stand mit Zeitstempel — nie eine leere
Seite. Wo eine Quelle offensichtlich falsche Werte liefert, korrigiert die App
sie und **sagt sichtbar dazu, dass sie es getan hat.**

---

## Schnellstart

```bash
npm install
npm run dev
```

Die App läuft dann auf `http://localhost:5173`. `npm run dev` bindet auch an das
lokale Netz, sodass sie sich vom Handy aus unter `http://<PC-IP>:5173` testen
lässt — dort erscheint auch der Hinweis „Zum Startbildschirm hinzufügen".

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver, auch im lokalen Netz erreichbar |
| `npm run build` | Statischer Export nach `build/` |
| `npm run preview` | Den gebauten Stand lokal ansehen |
| `npm test` | Tests der Datenqualitäts-Logik |
| `npm run check` | TypeScript- und Svelte-Prüfung |
| `npm run daten:pruefen` | Alle Datenquellen gegen das Netz prüfen |

---

## Technik und warum

| Baustein | Wahl | Begründung |
| --- | --- | --- |
| Framework | **SvelteKit** mit `adapter-static` | Erzeugt reines HTML/CSS/JS ohne Server. Deutlich kleinere Bündel als Next.js — auf der Seiser Alm zählt jedes Kilobyte im Mobilfunknetz. |
| CSS | **Tailwind 4** | Keine Laufzeit, keine zusätzliche CSS-Datei im Bündel. |
| PWA | **@vite-pwa/sveltekit** | Home-Screen-Symbol und Offline-Betrieb ohne eigenen Service-Worker-Code. |
| i18n | **eigener Store** (~110 Zeilen) | Bibliotheken wie Paraglide bringen einen Compiler-Schritt mit. Für drei Sprachen mit JSON-Dateien wäre das mehr Aufwand als Nutzen — und Ladinisch (`lld`) ist in vielen Bibliotheken kein bekanntes Gebietsschema. |
| Tests | **Vitest** | Nur für die Logik, die Daten korrigiert oder Lücken erkennt. |

**Service Worker — nur für die App-Hülle.** Er hält HTML, JS, CSS und Symbole
vor, damit die App offline startet. Livedaten cached er bewusst **nicht**: Ein
Service Worker, der API-Antworten zwischenspeichert, liefert sie offline als
normalen Erfolg aus, und die App hielte sie für frisch. Den Rückfall auf den
letzten bekannten Stand macht die Adapter-Schicht — mit echtem Zeitstempel.
Aus demselben Grund holen die Adapter mit `cache: 'no-store'`, sonst springt
der HTTP-Cache des Browsers still ein. Beides am Gerät im Offline-Test
gefunden und verifiziert.

**Hosting:** Der Export ist rein statisch und läuft unverändert auf GitHub
Pages, Cloudflare Pages oder Vercel Free. Alle vier Datenquellen senden
CORS-Header, die den Zugriff aus dem Browser erlauben — es wird **kein Proxy
und kein Server benötigt.** Die Vorgabe „0 €" ist damit dauerhaft erfüllt, nicht
nur bis zum ersten Nutzer.

Für ein Unterverzeichnis (etwa GitHub Pages unter `/zoa-app/`):

```bash
BASE_PATH=/zoa-app npm run build
```

---

## Datenquellen

Alle Quellen sind offen und ohne Schlüssel nutzbar. Geprüft am 05.09.2026.

| Was | Quelle | Lizenz | Art |
| --- | --- | --- | --- |
| Sperre Seiser Alm-Straße | [Verkehrsmeldedienst des Landes](https://static-verkehr.provinz.bz.it/publications/traffic/traffic.json) | CC0 | live |
| Parkgaragen im Dorf | [Open Data Hub – Mobility](https://mobility.api.opendatahub.com) | CC0 / CC-BY | live, ~1 Min. |
| Webcams | [Open Data Hub – Tourism](https://tourism.api.opendatahub.com) | CC0 / CC-BY | live |
| Nächtigungen, Betten, Bevölkerung, Fahrzeuge | [ASTAT über den Geodienst der Provinz](https://geoservices1.civis.bz.it/geoserver/p_bz-Astat/ows) | CC0 | Jahreswerte 2023 |
| Betriebszeiten Umlaufbahn | Fahrplan Seiser Alm Bahn AG | — | gepflegte Konfiguration |

Jede Quelle liegt hinter einem Adapter in `src/lib/adapters/`. Alle Adapter
liefern dieselbe Hülle (`SourceResult<T>` mit Zustand, Zeitstempel und Herkunft),
sodass sich eine Quelle austauschen lässt, ohne die Oberfläche anzufassen.

### Der wichtigste Fund

Die Tagessperre der Seiser Alm-Straße steht **amtlich und maschinenlesbar** im
Verkehrsmeldedienst — inklusive des entscheidenden Vorbehalts:

> „Bei St. Valentin (km 2,500) SPERRE von 09:00 bis 17:00 Uhr. Sind die 250
> Parkplätze auf der Seiser Alm bereits besetzt, wird schon vor 09:00 Uhr
> gesperrt (gilt auch für Busse)."

Deshalb sind **keine Sperrzeiten im Code hinterlegt.** Ändert die Gemeinde die
Regelung, zieht die App automatisch nach. Und weil „offen" laut Quelle keine
Zusage ist, zeigt die Ampel diesen Vorbehalt immer mit an.

---

## Bekannte Lücken

Diese drei Punkte sind **keine Fehler, sondern fehlende Daten.** Die App weist
sie sichtbar aus, statt sie zu überspielen.

1. **Compatsch (250 Plätze) hat keine Livedaten.** Nirgends im Open Data Hub —
   `ParkingStation`, `ParkingFacility` und `ParkingSensor` liefern alle keinen
   Treffer. Ausgerechnet die Zahl, wegen der die Straße gesperrt wird. Der
   Belastungs-Index rechnet sie deshalb **nicht** mit und benennt diese Grenze.
   *Nächster Schritt: Datenzugang bei Seiser Alm Bahn AG und Gemeinde anfragen.*
   Sobald eine Quelle vorliegt, genügt ein neuer Adapter.
2. **Die Umlaufbahn hat keine Status-Schnittstelle.** Im Open Data Hub existiert
   nur ein Punkt-Eintrag „Talstation" ohne Betriebsdaten. Die App zeigt deshalb
   den gepflegten Fahrplan und **kennzeichnet ihn als solchen.** Wartezeiten
   werden nirgends veröffentlicht.
3. **Wasser- und Müllverbrauch sind nicht offen verfügbar.** Der Landesdatensatz
   „Raccolta rifiuti" enthält nur Containerstandorte, keine Mengen.

### Zwei Quellen liefern falsche Werte — die App fängt das ab

* **Centralpark meldet `occupied` konstant 0.** Über 24 Stunden und 40
  Messpunkte, während `occupied_short_stay` plausibel zwischen 11 und 54
  schwankt. Ungeprüft würde die App „Parkplatz leer" anzeigen, wenn er voll ist.
  Der Adapter erkennt den Widerspruch, rechnet aus den Teilwerten und setzt
  einen sichtbaren Hinweis.
* **Die Prognose derselben Station ist ebenfalls unbrauchbar** (sagt durchgehend
  0 voraus), weil sie beim Anbieter aus derselben defekten Reihe stammt. Sie
  wird verworfen statt angezeigt.
* **Zwei Webcams sind seit 2023 tot,** stehen im Open Data Hub aber als
  `Active: true`. Sie sind bewusst nicht eingebunden; die Begründung steht in
  `src/lib/config/kastelruth.ts`.

`npm run daten:pruefen` prüft all das gegen das Netz und liefert Rückgabewert 1,
wenn etwas nicht stimmt. **Vor jeder Saison und nach jeder Meldung über
seltsame Zahlen laufen lassen.**

---

## Der Belastungs-Index

Eine Tageskennzahl von 0 bis 100. Die Rechnung ist in der App vollständig
aufklappbar — Gewicht und Beitrag jedes Faktors stehen dort als Tabelle.

| Faktor | Gewicht | Grundlage |
| --- | --- | --- |
| Auslastung der Dorf-Parkgaragen | 40 % | Messung |
| Sperrstatus Seiser Alm-Straße | 20 % | Messung |
| Saison | 25 % | feste Tabelle, als Annahme gekennzeichnet |
| Wochentag | 15 % | feste Tabelle, als Annahme gekennzeichnet |

**Fehlt ein Faktor, wird nichts geschätzt** — sein Gewicht verteilt sich
anteilig auf die übrigen, und die Tabelle weist das aus. Die Saison- und
Wochentagstabellen stehen gesammelt in `src/lib/logic/load-index.ts`; wer sie
ändert, ändert den Index, deshalb liegen sie an einer Stelle.

**Frühwarnung:** Liegt der Index an drei aufeinanderfolgenden Kalendertagen über
75, erscheint ein Hinweisbanner. Lücken im Verlauf zählen nicht als
zusammenhängend.

---

## Eine Sprache ergänzen

```bash
node scripts/neue-sprache.mjs en
```

Das legt `src/lib/i18n/locales/en.json` mit der Struktur von `de.json` an, alle
Werte leer. Dann:

1. Werte in der neuen Datei übersetzen.
2. In `src/lib/i18n/index.ts` importieren und in `LOCALES` eintragen.

Mehr ist nicht nötig. **Leere Werte fallen automatisch auf Deutsch zurück**, es
entstehen also nie leere Stellen in der Oberfläche. Liegt die Abdeckung unter
50 %, zeigt die App einen ehrlichen Hinweis, dass die Sprache noch nicht
übersetzt ist.

### Ladinisch

`lld.json` ist derzeit eine **leere Vorlage.** Eine maschinell erzeugte
Übersetzung wäre gegenüber einer Sprachminderheit nicht angemessen — die Datei
gehört einem ladinischen Muttersprachler in die Hand. Bis dahin fällt die
Oberfläche sichtbar und begründet auf Deutsch zurück.

---

## Aufbau

```
src/
  lib/
    adapters/      eine Datei je Datenquelle, alle mit gleicher Signatur
      cache.ts     letzter bekannter Stand + Rückfall bei Ausfall
      types.ts     SourceResult<T>: Zustand, Zeitstempel, Herkunft
    config/
      kastelruth.ts  alle geprüften Stations-IDs, mit Begründungen
    i18n/          Store + Sprachdateien
    logic/
      load-index.ts  Belastungs-Index und Frühwarnung
    models/
      phase2.ts    Datenmodelle der zweiten Ausbaustufe (noch ohne Code)
    components/
  routes/
    +page.svelte           Barometer (Ampel, Index, Parkplätze, Bahn, Webcams)
    statistik/             Zahlen zur Gemeinde
    transparenz/           Phase 2 – Übersicht
    voting/ melden/ wohnen/  Phase 2 – Platzhalter
    info/                  Quellen, Datenschutz, Absender
scripts/
  check-sources.mjs   Datenquellen gegen das Netz prüfen
  neue-sprache.mjs    Sprachvorlage erzeugen
  icons.mjs           PWA-Symbole aus icon.svg erzeugen
```

---

## Phase 2 (vorbereitet, nicht gebaut)

Routen, Navigationspunkte und Datenmodelle stehen; es gibt noch keine
Implementierung. Zwei Regeln sind bereits **in den Typen** verankert, nicht nur
in dieser Datei (`src/lib/models/phase2.ts`):

* `Meldung.oeffentlich` ist auf `false` festgelegt und `empfaenger` auf
  `'gemeinde'`. Bürgermeldungen können typseitig nicht öffentlich werden.
* `WohnZone` kennt nur Zonenwerte mit einer Mindestgröße von 30 Wohneinheiten —
  keine Adressen, keine Eigentümer.

Personenbezug gibt es ausschließlich bei gewählten Mandatsträgern in ihrer
öffentlichen Funktion, belegt durch öffentliche Sitzungsprotokolle.

---

## Push-Benachrichtigungen

Vorbereitet, **nicht aktiviert.** Der Service Worker ist eingerichtet, es wird
noch keine Berechtigung abgefragt und nichts versendet. Web Push braucht einen
Dienst für den Versand — sobald einer feststeht, der die 0-€-Vorgabe erfüllt,
lässt sich das ergänzen, ohne die Adapter anzufassen.

---

## Mitarbeit

Fehler in den Zahlen sind das Schlimmste, was dieser App passieren kann. Wer
einen findet: bitte melden, mit Datum und Screenshot.
