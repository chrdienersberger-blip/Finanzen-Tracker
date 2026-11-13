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
