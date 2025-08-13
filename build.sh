#!/bin/bash
# Build-Skript für die Bereitstellung der Browser-Erweiterung
# 
# Usage:
#   ./build.sh                 - Build without version increment
#   ./build.sh --patch         - Increment patch version (1.0.3 -> 1.0.4)
#   ./build.sh --minor         - Increment minor version (1.0.3 -> 1.1.0)
#   ./build.sh --major         - Increment major version (1.0.3 -> 2.0.0)
#   ./build.sh --version TYPE  - Increment version by TYPE (patch, minor, major)
#
set -e

DIST_DIR="dist"
ZIP_NAME="zammad-time-tracker-extension.zip"
MANIFEST_FILE="manifest.json"

# Versioning function
increment_version() {
    local version_type=${1:-patch}  # patch, minor, major
    
    # Extract current version from manifest.json
    current_version=$(grep '"version"' "$MANIFEST_FILE" | sed 's/.*"version": "\(.*\)".*/\1/')
    
    if [[ ! "$current_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "Error: Invalid version format in manifest.json: $current_version"
        exit 1
    fi
    
    # Split version into components
    IFS='.' read -r major minor patch <<< "$current_version"
    
    # Increment based on type
    case "$version_type" in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch"|*)
            patch=$((patch + 1))
            ;;
    esac
    
    new_version="$major.$minor.$patch"
    
    # Update manifest.json
    sed -i.bak "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/" "$MANIFEST_FILE"
    rm -f "${MANIFEST_FILE}.bak"
    
    echo "Version updated: $current_version -> $new_version"
    
    # Update ZIP name to include version
    ZIP_NAME="zammad-time-tracker-extension-v$new_version.zip"
}

# Handle versioning if requested
if [[ "$1" == "--version" ]]; then
    increment_version "$2"
elif [[ "$1" == "--major" ]]; then
    increment_version "major"
elif [[ "$1" == "--minor" ]]; then
    increment_version "minor"
elif [[ "$1" == "--patch" ]]; then
    increment_version "patch"
fi

# Vorheriges Build-Verzeichnis und altes ZIP-Archiv entfernen
rm -rf "$DIST_DIR"
rm -f "$ZIP_NAME"
rm -f zammad-time-tracker-extension-v*.zip

mkdir "$DIST_DIR"

# Relevante Dateien und Ordner kopieren
shopt -s extglob
cp -r !(dist|*.md|build.sh|.git|.DS_Store|$ZIP_NAME) "$DIST_DIR"/

# ZIP-Archiv im dist-Verzeichnis erstellen
cd "$DIST_DIR"
zip -r "../$ZIP_NAME" .
cd ..

echo "Build abgeschlossen. Das Deployment-Paket befindet sich in $DIST_DIR und als $ZIP_NAME."
rm -rf "$DIST_DIR"
echo "Bereinigung abgeschlossen."