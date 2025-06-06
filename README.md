# Zammad Timetracking Extension

Eine Chrome Extension für automatische Zeiterfassung in Zammad Tickets.

## 📋 Funktionen

- ⏱️ **Zeiterfassung** - Start/Stop Timer für Zammad Tickets
- 🎯 **Automatische Ticket-Erkennung** - Erkennt Ticket-IDs automatisch
- 💾 **Persistente Zeiterfassung** - Timer läuft auch bei Tab-Wechsel weiter
- 🔧 **Automatisches Eintragen** - Trägt Zeit automatisch in Zammad ein
- 🔔 **Browser-Benachrichtigungen** - Informiert über Start/Stop
- 🐛 **Debug-Modus** - Umfassendes Logging für Fehlerbehebung

## 🚀 Installation

### Voraussetzungen

- Google Chrome Browser (Version 88+)
- Zugriff auf eine Zammad-Installation
- Aktivierte Zeiterfassung in Zammad

### Schritt 1: Extension-Dateien herunterladen

Erstellen Sie einen neuen Ordner `zammad-timetracking` und laden Sie folgende Dateien herunter:

```
zammad-timetracking/
├── manifest.json          # Extension-Konfiguration
├── background.js           # Background Service Worker
├── content.js             # Content Script für Zammad-Integration
├── popup.html             # Popup-Interface
├── style.css              # Styling
└── icons/                 # Extension-Icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Schritt 2: Icons erstellen

**Option A: Automatisch generieren**
1. Öffnen Sie den Icon-Generator (falls bereitgestellt)
2. Laden Sie alle drei PNG-Icons herunter
3. Speichern Sie sie im `icons/` Ordner

**Option B: Eigene Icons verwenden**
- Erstellen Sie PNG-Icons in den Größen 16x16, 48x48 und 128x128 Pixel
- Benennen Sie sie: `icon16.png`, `icon48.png`, `icon128.png`

### Schritt 3: Extension in Chrome installieren

1. **Chrome Extensions-Seite öffnen:**
   ```
   chrome://extensions/
   ```

2. **Entwicklermodus aktivieren:**
   - Toggle "Entwicklermodus" oben rechts aktivieren

3. **Extension laden:**
   - Klicken Sie auf "Entpackte Erweiterung laden"
   - Wählen Sie den `zammad-timetracking` Ordner aus
   - Klicken Sie "Ordner auswählen"

4. **Installation verifizieren:**
   - Extension sollte in der Liste erscheinen
   - Icon sollte in der Chrome-Toolbar sichtbar sein
   - Status sollte "Aktiviert" anzeigen

## 📖 Verwendung

### Grundlegende Nutzung

1. **Zammad-Ticket öffnen**
   - Navigieren Sie zu einem beliebigen Ticket in Ihrer Zammad-Installation

2. **Zeiterfassung starten**
   - Klicken Sie auf das Extension-Icon in der Chrome-Toolbar
   - Klicken Sie den blauen "Start"-Button
   - Timer beginnt automatisch zu laufen

3. **Zeiterfassung beenden**
   - Öffnen Sie das Popup erneut
   - Klicken Sie den roten "Stop"-Button
   - Zeit wird automatisch in Zammad eingetragen

### Erweiterte Funktionen

#### Debug-Modus aktivieren
- **Doppelklick** auf "Zammad Timetracking" im Popup-Header
- Gelbe Debug-Box wird angezeigt
- Zeigt detaillierte Informationen über alle Vorgänge

#### Einstellungen anpassen
- **Benachrichtigungen:** Ein/Aus schalten
- **Auto-Submit:** Automatisches Eintragen aktivieren/deaktivieren

#### Persistente Zeiterfassung
- Timer läuft auch bei geschlossenem Popup weiter
- Timer läuft auch bei Tab-Wechsel oder Browser-Neustart weiter
- Rotes Badge (⏱) im Extension-Icon zeigt aktive Zeiterfassung

## 🔧 Konfiguration

### Zammad-URL-Erkennung anpassen

Falls Ihre Zammad-Installation nicht automatisch erkannt wird, passen Sie die URL-Patterns in `content.js` an:

```javascript
// Zeile ~15-25 in content.js
isZammadPage() {
  const indicators = [
    // Fügen Sie Ihre spezifischen URL-Patterns hinzu
    () => /ihre-zammad-domain\.de/i.test(window.location.href),
    () => /support\.ihr-unternehmen\.com/i.test(window.location.href),
    // ... bestehende Patterns
  ];
}
```

### Zeiterfassungsfelder anpassen

Falls die automatische Felderkennung nicht funktioniert, passen Sie die Selektoren in `content.js` an:

```javascript
// Zeile ~200+ in content.js
submitTimeEntry(durationInSeconds) {
  const timeFields = [
    'input[name="time_unit"]',           // Standard Zammad
    'input[name="ihre_zeit_feld"]',      // Ihr custom Feld
    '.ihre-zeit-klasse input',           // Ihr CSS-Selektor
    // ... weitere Selektoren
  ];
}
```

## 🐛 Fehlerbehebung

### Extension lädt nicht

**Problem:** Extension erscheint nicht in Chrome
```bash
# Lösung:
1. Überprüfen Sie die Ordnerstruktur
2. Stellen Sie sicher, dass manifest.json vorhanden ist
3. Prüfen Sie chrome://extensions/ auf Fehlermeldungen
4. Entwicklermodus aktiviert?
```

**Problem:** Service Worker Fehler
```bash
# Lösung:
1. chrome://extensions/ → Extension Details
2. Prüfen Sie "Service worker" Status
3. Bei Fehlern: Extension neu laden (Reload-Button)
4. Browser neu starten
```

### Timer startet nicht

**Problem:** Start-Button reagiert nicht
```bash
# Lösung:
1. Debug-Modus aktivieren (Doppelklick auf Header)
2. Prüfen Sie Debug-Meldungen
3. Browser-Konsole öffnen (F12)
4. Extension neu laden
```

**Problem:** Ticket-ID nicht gefunden
```bash
# Lösung:
1. Sind Sie in einem Zammad-Ticket?
2. URL enthält Ticket-Nummer?
3. Zammad-Seite vollständig geladen?
4. Content Script funktioniert? (Debug-Modus prüfen)
```

### Zeit wird nicht eingetragen

**Problem:** Automatisches Eintragen fehlgeschlagen
```bash
# Lösung:
1. Ist Zeiterfassung in Zammad aktiviert?
2. Haben Sie Berechtigung für Zeiterfassung?
3. Sind Zeiterfassungsfelder sichtbar auf der Seite?
4. Manuelle Feldkonfiguration nötig? (siehe Konfiguration)
```

### Häufige Lösungsansätze

```bash
# 1. Hard Refresh
Ctrl+Shift+R auf Zammad-Seite

# 2. Extension neu laden
chrome://extensions/ → Reload-Button

# 3. Browser Cache leeren
Ctrl+Shift+Del → Bilder und Dateien im Cache

# 4. Extension neu installieren
Extension löschen → Neu laden → Neu installieren
```

## 📊 Debug-Informationen sammeln

Bei Problemen sammeln Sie folgende Informationen:

### 1. Browser-Informationen
```bash
# Chrome-Version prüfen:
chrome://version/

# Extension-Status prüfen:
chrome://extensions/
```

### 2. Debug-Logs sammeln
```bash
1. Debug-Modus aktivieren (Doppelklick auf Popup-Header)
2. Aktion durchführen (Start/Stop)
3. Debug-Meldungen kopieren
4. Browser-Konsole öffnen (F12) → Console Tab
5. Fehlermeldungen kopieren
```

### 3. Zammad-Informationen
```bash
- Zammad-Version
- URL-Schema (z.B. https://support.company.com/ticket/zoom/123)
- Zeiterfassungs-Konfiguration
- Browser-Berechtigungen
```

## 🔄 Updates

### Extension aktualisieren
1. Neue Dateien in den Extension-Ordner kopieren
2. `chrome://extensions/` öffnen
3. Reload-Button bei der Extension klicken
4. Neue Features sind sofort verfügbar

### Änderungen verfolgen
- Prüfen Sie die `manifest.json` Version
- Neue Features werden im Debug-Modus angezeigt
- Background Script zeigt Versionsinformationen

## ⚙️ Entwicklung

### Voraussetzungen für Entwicklung
- Node.js (optional, für erweiterte Features)
- Chrome Developer Tools
- Code Editor (z.B. VS Code, IntelliJ)

### Entwicklung in IntelliJ IDEA

1. **Projekt öffnen:**
   ```bash
   File → Open → zammad-timetracking Ordner wählen
   ```

2. **Chrome Extension APIs aktivieren:**
   ```bash
   Settings → Languages & Frameworks → JavaScript → Libraries
   → Add... → Download... → "chrome" suchen und installieren
   ```

3. **TypeScript Support (optional):**
   ```bash
   npm install --save-dev @types/chrome
   ```

4. **Live Development:**
   ```bash
   # Datei-Watcher einrichten für automatisches Reload
   Settings → Tools → File Watchers
   ```

### Code-Qualität

```bash
# ESLint Setup
npm install --save-dev eslint

# .eslintrc.js
module.exports = {
  env: { webextensions: true },
  globals: { chrome: 'readonly' }
};
```

## 📝 Lizenz

MIT License - Freie Nutzung und Anpassung erlaubt.

## 🤝 Support

Bei Problemen oder Fragen:

1. **Debug-Modus verwenden** - Zeigt detaillierte Fehlermeldungen
2. **Browser-Konsole prüfen** - `F12` → Console Tab
3. **Extension neu laden** - Oft löst das bereits Probleme
4. **Dokumentation prüfen** - Alle wichtigen Informationen sind hier

## 📈 Roadmap

Geplante Funktionen:
- [ ] Zeiterfassung-Berichte
- [ ] Projektzeit-Kategorien
- [ ] Team-Statistiken
- [ ] Export-Funktionen
- [ ] Mobile Browser Support

---

**Viel Erfolg mit der Zammad Timetracking Extension! ⏱️**