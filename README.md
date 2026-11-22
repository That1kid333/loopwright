# Loopwright

Make songs from your own sounds. This repo holds the website (Netlify) and the desktop app (Electron).

## Layout
- `site/` – static website published by Netlify (`netlify.toml` at the root). Pages: home, pricing, sign in, account, download, browser studio.
- `desktop/` – Electron app: sign-in screen, then the studio. Uses the same Supabase project and publishable key as the site.
- `tools/` – `build.py` writes the site pages; `wrap_demo.py` turns the demo (`tools/loopwright-demo.html`) into `site/studio/index.html` and `desktop/src/studio.html`.

## One studio, three places
`tools/loopwright-demo.html` is the only studio source. The claude.ai demo, the site's browser studio (`/studio/`) and the Mac app are all built from it, so they look and work the same. Change the studio there, then run the two `wrap_demo.py` lines below. The wrapper only adds the host links in the studio's top bar (back to the site, or account and sign out in the app) and a plain download for export.

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
On a Mac, ad-hoc sign afterwards: `codesign --force --deep -s - out/Loopwright-darwin-arm64/Loopwright.app`. On Linux, `rcodesign sign out/Loopwright-darwin-arm64/Loopwright.app` (apple-codesign 0.29.0) does the same. The app version comes from `desktop/package.json`.
Release builds are packed as .tar.xz (under GitHub's 100 MB file limit) into `site/downloads/`, which Netlify serves.

The app is unsigned (no Apple Developer ID yet), so macOS asks for confirmation the first time.

## Sound Maker
Type a description, get a new sound you own. Claude writes a synthesis recipe (`supabase/functions/make-sound`), and `site/assets/sound-maker.js` renders it to audio on the user's machine (Web Audio, offline). No samples, no model weights, nothing to license.
In the studio it's the Make a sound box under Browser > My sounds. It works in the Mac app (AI is Mac-only); on the web it shows as a Mac app feature. Each try returns 2 takes; Add saves one to My sounds.
Test renders: `npm i node-web-audio-api@1.0.4` somewhere, then
`node tools/sound-maker/render_examples.mjs <path>/node_modules/node-web-audio-api/index.cjs out/` renders `tools/sound-maker/examples.json` to WAV and checks each one.
