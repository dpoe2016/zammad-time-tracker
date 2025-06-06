# Zammad Timetracking Extension

Eine Chrome Extension für automatische Zeiterfassung in Zammad Tickets.

## 📋 Funktionen

- ⏱️ **Zeiterfassung** - Start/Stop Timer für Zammad Tickets
- 🎯 **Automatische Ticket-Erkennung** - Erkennt Ticket-IDs automatisch
- 💾 **Persistente Zeiterfassung** - Timer läuft auch bei Tab-Wechsel weiter
- 🔧 **Automatisches Eintragen** - Trägt Zeit automatisch in Zammad ein
- 🔔 **Browser-Benachrichtigungen** - Informiert über Start/Stop
- 🌐 **Direkte Zammad API-Anbindung** - Zuverlässige Kommunikation über die Zammad REST API
- 🐛 **Debug-Modus** - Umfassendes Logging für Fehlerbehebung

## 🚀 Installation

### Voraussetzungen

- Google Chrome Browser (Version 88+)
- Zugriff auf eine Zammad-Installation
- Aktivierte Zeiterfassung in Zammad

### Schritt 1: Extension-Dateien herunterladen

Klonen oder laden Sie dieses Repository herunter. Die wichtigsten Dateien sind:

```
zammad-time-tracker/
├── manifest.json          # Extension-Konfiguration
├── background.js          # Background Service Worker
├── content.js             # Content Script für Zammad-Integration
├── zammad-api.js          # API-Service für direkte Zammad-Anbindung
├── popup.html             # Popup-Interface
├── popup.js               # Popup-Logik und Zeiterfassung
├── translations.js        # Mehrsprachige Übersetzungen
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
- **Sprache:** Deutsch oder Englisch auswählen

#### API Einstellungen konfigurieren
- Klicken Sie auf "Bearbeiten" neben "API Einstellungen"
- **Base URL:** Die URL Ihrer Zammad-Installation (z.B. https://zammad.example.com)
- **API Token:** Ihr persönlicher Zammad API Token
- Klicken Sie auf "Speichern", um die Einstellungen zu übernehmen

#### Zammad API Token erstellen
1. Melden Sie sich in Ihrer Zammad-Installation an
2. Gehen Sie zu Ihrem Profil (Klick auf Ihren Namen oben rechts)
3. Wählen Sie "Token-Zugriff" oder "API Tokens"
4. Klicken Sie auf "Neuen Token erstellen"
5. Geben Sie einen Namen ein (z.B. "Timetracking Extension")
6. Kopieren Sie den generierten Token und fügen Sie ihn in die Extension ein

#### Persistente Zeiterfassung
- Timer läuft auch bei geschlossenem Popup weiter
- Timer läuft auch bei Tab-Wechsel oder Browser-Neustart weiter
- Rotes Badge (⏱) im Extension-Icon zeigt aktive Zeiterfassung

## 🔧 Konfiguration

### REST API Konfiguration (empfohlen)

Die Extension nutzt die direkte Zammad REST API-Anbindung für eine zuverlässige und robuste Zeiterfassung:

1. **API Einstellungen öffnen:**
   - Klicken Sie auf "Bearbeiten" neben "API Einstellungen" im Popup

2. **Einstellungen konfigurieren:**
   - **Base URL:** Die URL Ihrer Zammad-Installation (z.B. https://zammad.example.com)
   - **API Token:** Ihr persönlicher Zammad API Token (siehe "Zammad API Token erstellen" oben)

3. **Vorteile der direkten API-Anbindung:**
   - **Zuverlässigkeit:** Unabhängig von Änderungen am Zammad UI
   - **Genauigkeit:** Präzise Ticket-Informationen direkt aus der Datenbank
   - **Effizienz:** Direktes Eintragen der Zeit ohne DOM-Manipulation
   - **Flexibilität:** Funktioniert auch wenn das Ticket nicht geöffnet ist
   - **Robustheit:** Weniger anfällig für Fehler durch UI-Änderungen
   - **Vollständigkeit:** Zugriff auf alle Ticket-Informationen und Zeiteinträge

### Zammad-URL-Erkennung anpassen (Fallback-Methode)

Falls Ihre Zammad-Installation nicht automatisch erkannt wird, passen Sie die URL-Patterns in `content.js` an:

```javascript
// Zeile ~15-25 in content.js
function isZammadPage() {
  const indicators = [
    // Fügen Sie Ihre spezifischen URL-Patterns hinzu
    () => /ihre-zammad-domain\.de/i.test(window.location.href),
    () => /support\.ihr-unternehmen\.com/i.test(window.location.href)
    // ... bestehende Patterns
  ];
  return indicators.some(check => check());
}
```

### Zeiterfassungsfelder anpassen (Fallback-Methode)

Falls die automatische Felderkennung nicht funktioniert und Sie die API-Methode nicht nutzen können, passen Sie die Selektoren in `content.js` an:

```javascript
// Zeile ~200+ in content.js
function submitTimeEntry(durationInSeconds) {
  const timeFields = [
    'input[name="time_unit"]',           // Standard Zammad
    'input[name="ihre_zeit_feld"]',      // Ihr custom Feld
    '.ihre-zeit-klasse input'            // Ihr CSS-Selektor
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
# Lösung bei API-Methode:
1. Sind API Einstellungen korrekt konfiguriert?
2. Ist der API Token gültig und hat ausreichende Berechtigungen?
3. Debug-Modus aktivieren und API-Fehler prüfen
4. Prüfen Sie die Netzwerk-Anfragen in den Browser-Entwicklertools

# Lösung bei DOM-Methode:
1. Ist Zeiterfassung in Zammad aktiviert?
2. Haben Sie Berechtigung für Zeiterfassung?
3. Sind Zeiterfassungsfelder sichtbar auf der Seite?
4. Manuelle Feldkonfiguration nötig? (siehe Konfiguration)
```

**Problem:** API Fehler
```bash
# Lösung:
1. Prüfen Sie die Base URL (z.B. https://zammad.example.com ohne abschließenden /)
2. Stellen Sie sicher, dass der API Token gültig ist
3. Prüfen Sie, ob der Token die nötigen Berechtigungen hat
4. Prüfen Sie, ob die Zammad-API erreichbar ist (keine Firewall-Blockierung)
5. CORS-Probleme? Prüfen Sie die Browser-Konsole auf entsprechende Fehler
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

### 3. API-Informationen
```bash
# API-Konfiguration prüfen:
1. Debug-Modus aktivieren
2. API-Einstellungen öffnen und prüfen
3. Netzwerk-Tab in den Entwicklertools öffnen (F12)
4. Aktion durchführen (Start/Stop)
5. API-Anfragen und Antworten prüfen
6. Fehler in der Konsole notieren
```

### 4. Zammad-Informationen
```bash
- Zammad-Version
- URL-Schema (z.B. https://support.company.com/ticket/zoom/123)
- Zeiterfassungs-Konfiguration
- API-Konfiguration und Berechtigungen
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
- [x] REST API Integration
- [ ] Zeiterfassung-Berichte
- [ ] Projektzeit-Kategorien
- [ ] Team-Statistiken
- [ ] Export-Funktionen
- [ ] Mobile Browser Support

---

**Viel Erfolg mit der Zammad Timetracking Extension! ⏱️**
