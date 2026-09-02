#!/usr/bin/env bash
# Resonance Studio launcher for Linux and macOS.
set -e
cd "$(dirname "$0")"

echo "Resonance Studio - démarrage..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18+ est requis (https://nodejs.org)." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installation des dépendances (première fois)..."
  npm install
fi

if [ ! -x node_modules/.bin/electron ] && [ ! -d node_modules/electron/dist ]; then
  echo "Préparation d'Electron..."
  npm rebuild electron
fi

# Always rebuild so the launched app reflects the current code.
echo "Compilation de l'interface..."
npm run build

echo "Lancement de Resonance."
exec npm run desktop:start
