#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting The Carded System tracker..."
npm start

echo
echo "Tracker stopped. Close this window to exit."
read -r -p "Press Return to close this window..." _
