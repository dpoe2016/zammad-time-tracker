# Auto-Submit Funktion - Erklärung

## Deutsch

Der "Auto-Submit"-Button in der Zammad Timetracking Extension steuert, ob die erfasste Zeit automatisch in Zammad eingetragen werden soll, wenn die Zeiterfassung gestoppt wird.

### Funktionsweise:

1. **Wenn aktiviert (Standardeinstellung):**
   - Nach dem Stoppen der Zeiterfassung versucht die Extension automatisch, die erfasste Zeit in Zammad einzutragen.
   - Zuerst wird versucht, die Zeit über die Zammad API einzutragen (wenn API-Einstellungen konfiguriert sind).
   - Falls die API-Methode fehlschlägt oder nicht konfiguriert ist, wird als Fallback versucht, die Zeit direkt über die Benutzeroberfläche einzutragen.
   - Bei erfolgreicher Eintragung wird eine Erfolgsmeldung angezeigt: "Zeit automatisch eingetragen."

2. **Wenn deaktiviert:**
   - Die API-Methode wird übersprungen.
   - Es wird nur versucht, die Zeit über die Benutzeroberfläche einzutragen.
   - Falls auch dies fehlschlägt, wird eine Meldung angezeigt, dass die Zeit manuell eingetragen werden muss.

### Vorteile:
- Spart Zeit durch automatische Eintragung
- Reduziert manuelle Fehler
- Funktioniert auch, wenn das Ticket nicht mehr geöffnet ist (bei API-Nutzung)

### Wann sollte man es deaktivieren?
- Wenn man die Zeit manuell mit zusätzlichen Informationen eintragen möchte
- Bei Problemen mit der automatischen Eintragung
- Wenn man verschiedene Zeitkategorien verwenden möchte

## English

The "Auto-Submit" button in the Zammad Timetracking Extension controls whether the tracked time should be automatically entered in Zammad when time tracking is stopped.

### How it works:

1. **When enabled (default setting):**
   - After stopping time tracking, the extension automatically tries to enter the tracked time in Zammad.
   - It first attempts to submit the time via the Zammad API (if API settings are configured).
   - If the API method fails or is not configured, it falls back to trying to enter the time directly through the user interface.
   - Upon successful entry, a success message is displayed: "Time automatically entered."

2. **When disabled:**
   - The API method is skipped.
   - It only tries to enter the time through the user interface.
   - If this also fails, a message is displayed that the time must be entered manually.

### Benefits:
- Saves time through automatic entry
- Reduces manual errors
- Works even when the ticket is no longer open (when using API)

### When to disable it:
- When you want to enter time manually with additional information
- If there are problems with automatic entry
- When you want to use different time categories