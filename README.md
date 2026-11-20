# Finanztracker

Ein privater Finanztracker, der komplett im Browser läuft. Es gibt keinen Server, kein Konto und keine Bankanbindung – alle Buchungen liegen nur im Speicher des Browsers auf dem eigenen Gerät.

## Funktionen

- Ausgaben und Einnahmen erfassen, bearbeiten, suchen
- Monatsübersicht mit Kategorien, Budgets und 6-Monats-Verlauf
- Automatische Kategorie anhand des Händlers (lernt aus eigenen Korrekturen)
- Apple-Pay-Zahlungen automatisch erfassen über eine Kurzbefehle-Automation (Anleitung in der App unter „Einstellungen“)
- Bank-CSV importieren, mit Duplikat-Erkennung
- Backup als Datei speichern und wieder einspielen, CSV-Export

## Datenschutz

- Gespeichert wird ausschließlich in `localStorage` des Browsers.
- Die Seite lädt keine fremden Skripte, Schriften oder Analyse-Dienste. Eine Content-Security-Policy in `index.html` verbietet dem Browser jede Verbindung zu anderen Servern.
- Folge davon: Es gibt keine Synchronisierung zwischen Geräten, und wer die Browserdaten löscht, löscht auch die Buchungen. Deshalb regelmäßig „Backup speichern“ nutzen.

## Starten

Es gibt keinen Build-Schritt. Die Dateien müssen nur von einem Webserver ausgeliefert werden:

```
python3 -m http.server 8000
```

Danach `http://localhost:8000` öffnen. Für die Nutzung auf dem iPhone muss die Seite per HTTPS erreichbar sein, zum Beispiel über GitHub Pages.

## Schnellerfassung per Adresse

`…/?betrag=12,34&haendler=REWE` legt sofort eine Ausgabe für heute an. Ein negativer Betrag wird als Einnahme gebucht.

## Variante für die Claude-App

`claude-app.html` ist dieselbe App als Claude-Artifact. Sie braucht kein Hosting und speichert die Buchungen im Claude-Konto statt im Browser. Die Schnellerfassung per Adresse und der Offline-Betrieb gibt es dort nicht.

## Wichtel-Rap (Wichtelautomat)

Im Ordner `wichteln/` liegt ein Wichtelautomat. Über GitHub Pages ist er unter `…/wichteln/` erreichbar.

1. Teilnehmer, Budget, Datum und optional Ausnahmen eintragen (z. B. Paare, die sich nicht ziehen sollen) und „Auslosen“ drücken.
2. Jeder bekommt einen eigenen geheimen Link („Senden“ öffnet das Teilen-Menü bzw. WhatsApp).
3. Wer seinen Link öffnet, hört einen Beat und liest eine Rap-Story in vier Strophen. Am Ende wird mit Trommelwirbel und Konfetti verraten, wen man beschenkt.

Der Organisator sieht die Zuordnung nicht und kann selbst mitmachen. Die Zuordnung steckt verschleiert im `#`-Teil des Links, also gibt es keinen Server und keine Datenbank. Der Link ist allerdings nur verschleiert, nicht sicher verschlüsselt. Für Wichteln unter Freunden reicht das.
