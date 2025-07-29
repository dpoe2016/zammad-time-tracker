#!/bin/bash
# Build-Skript für die Bereitstellung der Browser-Erweiterung
set -e

DIST_DIR="dist"
ZIP_NAME="zammad-time-tracker-extension.zip"

# Vorheriges Build-Verzeichnis und altes ZIP-Archiv entfernen
rm -rf "$DIST_DIR"
rm -f "$ZIP_NAME"

mkdir "$DIST_DIR"

# Relevante Dateien und Ordner kopieren
shopt -s extglob
cp -r !(dist|*.md|build.sh|.git|.DS_Store|$ZIP_NAME) "$DIST_DIR"/

# ZIP-Archiv im dist-Verzeichnis erstellen
cd "$DIST_DIR"
zip -r "../$ZIP_NAME" .
cd ..

echo "Build abgeschlossen. Das Deployment-Paket befindet sich in $DIST_DIR und als $ZIP_NAME."
