# Loopwright preset library

The free preset library is about 22,000 real recordings from public domain (CC0) packs.
Audio lives in the Supabase Storage bucket `library` (public), never in git.

- `build_catalog.py` reads each pack's git tree and SFZ programs and writes `catalog.json`
  (packs, instruments and kits with their zones, and the list of files to copy).
- `licenses/` has one file per pack: license, source page and the pack's own license text.
- The `library-import` edge function (`supabase/functions/library-import`) seeds the
  `library_packs`, `library_items` and `library_files` tables from `catalog.json` and copies
  every file from the pack's GitHub repo (pinned commit) into storage. A pg_cron job runs it
  every minute until `library_files` has no pending rows, then it is unscheduled.
- The browser reads the catalog through `library_search()` and `library_items` (public read)
  and plays sounds with `site/assets/library.js`.
- `site/assets/originals.js` adds "Loopwright Originals": about 160 electronic presets made in
  code (22 genre drum kits, FX kits, 808s and synth bass, leads, pads, plucks, electric keys,
  a plucked-string guitar model and vowel vocal chops). They need no files or storage, and
  `library.js` lists and plays them next to the recorded packs.

Using it in a page:

```html
<script src="/assets/originals.js"></script>
<script src="/assets/library.js"></script>
<script>
  const ctx = new AudioContext();
  const { items } = await LoopwrightLibrary.search("trap", { category: "Drums" });
  const kit = await LoopwrightLibrary.load(items[0].id, ctx);
  kit.play("Kick", 110);             // kit: hit name, index or GM key
  const keys = await LoopwrightLibrary.load("orig-electric-piano", ctx);
  keys.play(60, 90, ctx.currentTime, { duration: 1 });   // instrument: MIDI note, velocity
</script>
```

Packs were chosen only if the license on the pack's own page or repository is CC0 or public
domain. Left out on purpose: anything CC-BY (attribution), NC, GPL, "personal use" or unclear.
