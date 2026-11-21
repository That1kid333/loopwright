# Loopwright

Make songs from your own sounds. This repo holds the website (Netlify) and the desktop app (Electron).

## Layout
- `site/` – static website published by Netlify (`netlify.toml` at the root). Pages: home, pricing, sign in, account, download, browser studio.
- `desktop/` – Electron app: sign-in screen, then the studio. Uses the same Supabase project and publishable key as the site.
- `tools/` – `build.py` writes the site pages; `wrap_demo.py` turns the demo (`tools/loopwright-demo.html`) into `site/studio/index.html` and `desktop/src/studio.html`.

## Rebuild
```
python3 tools/build.py site
python3 tools/wrap_demo.py tools/loopwright-demo.html site/studio/index.html web
python3 tools/wrap_demo.py tools/loopwright-demo.html desktop/src/studio.html desktop
cp node_modules/@supabase/supabase-js/dist/umd/supabase.js desktop/src/   # supabase-js 2.49.4
```

## Package the Mac app
```
cd desktop && npm i -D @electron/packager@20.3.0
node pack.mjs "$PWD" ../out <electron-zip-cache-or-empty> build/icon.icns
```
On a Mac, ad-hoc sign afterwards: `codesign --force --deep -s - out/Loopwright-darwin-arm64/Loopwright.app`.
Release builds are packed as .tar.xz (under GitHub's 100 MB file limit) into `site/downloads/`, which Netlify serves.

The app is unsigned (no Apple Developer ID yet), so macOS asks for confirmation the first time.
