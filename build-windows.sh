#!/usr/bin/env bash
set -e

echo "==> Installing mobile dependencies..."
cd mobile
npm install

echo "==> Building Expo web bundle..."
npx expo export --platform web

echo "==> Packaging Windows installer..."
npx electron-builder --win --config electron-builder.json

echo ""
echo "Done! Your Windows files are in: mobile/dist-electron/"
echo "  • Chatsplat Setup *.exe  — installer"
echo "  • Chatsplat-portable.exe — no-install portable version"
