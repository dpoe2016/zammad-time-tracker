#!/bin/bash
# Build-Skript für die Bereitstellung der Browser-Erweiterung
set -e

DIST_DIR="dist"

# Vorheriges Build-Verzeichnis entfernen
rm -rf "$DIST_DIR"
mkdir "$DIST_DIR"

# Relevante Dateien und Ordner kopieren
shopt -s extglob
cp -r !(dist|*.md|build.sh|.git|.DS_Store) "$DIST_DIR"/

# Optional: ZIP-Archiv erstellen
cd "$DIST_DIR"
zip -r ../zammad-time-tracker-extension.zip .
cd ..

echo "Build abgeschlossen. Das Deployment-Paket befindet sich in $DIST_DIR und als zammad-time-tracker-extension.zip."
