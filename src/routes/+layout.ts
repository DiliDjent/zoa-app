// Statischer Export: jede Route wird als eigene HTML-Datei vorgerendert.
// Das macht die App offline-tauglich und laesst sie ohne Server laufen.
export const prerender = true;
// Kein clientseitiges Routing-Preloading auf Datenebene noetig - alle
// Livedaten werden bewusst erst im Browser geholt, damit sie aktuell sind.
export const ssr = true;
