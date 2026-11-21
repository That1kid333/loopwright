#!/usr/bin/env python3
"""Build the Loopwright preset library catalog.

Reads the source packs (git clones with their SFZ programs checked out,
audio blobs NOT needed) and writes catalog.json:

  packs: id, name, author, license, source page, repo + commit
  items: playable instruments and drum kits, each with zones that point
         at audio files by their storage key in the "library" bucket
  files: every audio file to copy into storage: [storage key, repo path]

Usage: build_catalog.py <dir with clones> <out catalog.json>
The clones are made by fetch_sources.sh (blobless, SFZ files only).
"""
import json, os, re, subprocess, sys
from collections import defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/sfz")
OUT = sys.argv[2] if len(sys.argv) > 2 else "catalog.json"

PACKS = [
    dict(id="vcsl", dir="VCSL", repo="sgossner/VCSL", name="Versilian Community Sample Library",
         author="Versilian Studios and contributors", license="CC0 1.0",
         source="https://github.com/sgossner/VCSL", page="https://versilian-studios.com/vcsl/",
         about="Pianos, harpsichords, organs, FM keys, winds, mallets, world instruments and hundreds of percussion sounds."),
    dict(id="vsco2", dir="VSCO-2-CE", repo="sgossner/VSCO-2-CE", name="VSCO 2 Community Edition",
         author="Versilian Studios", license="CC0 1.0",
         source="https://github.com/sgossner/VSCO-2-CE", page="https://versilian-studios.com/vsco-community/",
         about="Chamber orchestra: strings, brass, woodwinds, harp, piano, organ and orchestral percussion."),
    dict(id="bigrusty", dir="karoryfer.big-rusty-drums", repo="sfzinstruments/karoryfer.big-rusty-drums",
         name="Big Rusty Drums", author="Karoryfer Samples", license="CC0 1.0",
         source="https://github.com/sfzinstruments/karoryfer.big-rusty-drums",
         page="https://shop.karoryfer.com/pages/free-big-rusty-drums",
         about="A big, roomy acoustic drum kit with sticks, brushes and mallets."),
    dict(id="unruly", dir="karoryfer.unruly-drums", repo="sfzinstruments/karoryfer.unruly-drums",
         name="Unruly Drums", author="Karoryfer Samples", license="CC0 1.0",
         source="https://github.com/sfzinstruments/karoryfer.unruly-drums",
         page="https://shop.karoryfer.com/pages/free-unruly-drums",
         about="A punchy acoustic kit with three snares, sticks and brushes."),
    dict(id="gogodze", dir="karoryfer.gogodze-phu-vol-ii", repo="sfzinstruments/karoryfer.gogodze-phu-vol-ii",
         name="Gogodze Phu Vol II", author="Karoryfer Samples", license="CC0 1.0",
         source="https://github.com/sfzinstruments/karoryfer.gogodze-phu-vol-ii",
         page="https://shop.karoryfer.com/pages/free-gogodze-phu-vol-ii",
         about="A lo-fi drum kit recorded through seven very different mics."),
    dict(id="growlybass", dir="karoryfer.growlybass", repo="sfzinstruments/karoryfer.growlybass",
         name="Growlybass", author="Karoryfer Samples", license="CC0 1.0",
         source="https://github.com/sfzinstruments/karoryfer.growlybass",
         page="https://shop.karoryfer.com/pages/free-growlybass",
         about="A Squier Jazz bass, fingered."),
    dict(id="swagbass", dir="karoryfer.swagbass", repo="sfzinstruments/karoryfer.swagbass",
         name="Swagbass", author="Karoryfer Samples", license="CC0 1.0",
         source="https://github.com/sfzinstruments/karoryfer.swagbass",
         page="https://shop.karoryfer.com/pages/free-swagbass",
         about="A bright electric bass with string noises."),
    dict(id="blackblue", dir="karoryfer.black-and-blue-basses", repo="sfzinstruments/karoryfer.black-and-blue-basses",
         name="Black And Blue Basses", author="Karoryfer Samples", license="CC0 1.0",
         source="https://github.com/sfzinstruments/karoryfer.black-and-blue-basses",
         page="https://shop.karoryfer.com/pages/free-black-and-blue-basses",
         about="Two 5-string bass guitars: plucked, staccato, ghost notes and harmonics."),
]

AUDIO = re.compile(r"\.(wav|flac|ogg|mp3)$", re.I)
PC = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}


def git(d, *args):
    return subprocess.run(["git", "-C", d, *args], capture_output=True, text=True, check=True).stdout


def note_midi(tok):
    """'c4' -> 60, 'A#0' -> 22, 'gb4' -> 66, '60' -> 60. None if not a note."""
    if tok is None:
        return None
    tok = str(tok).strip()
    if re.fullmatch(r"-?\d+", tok):
        return int(tok)
    m = re.fullmatch(r"([a-gA-G])(#|b|s)?(-?\d)", tok)
    if not m:
        return None
    n = PC[m.group(1).lower()] + (1 if m.group(2) in ("#", "s") else -1 if m.group(2) == "b" else 0)
    return 12 * (int(m.group(3)) + 1) + n


def storage_key(pack, path):
    p = path.replace("\\", "/").replace("#", "s")
    p = re.sub(r"[^A-Za-z0-9._/\-]", "_", p)
    return f"{pack}/{p}"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def ctype(path):
    e = path.rsplit(".", 1)[-1].lower()
    return {"wav": "audio/wav", "flac": "audio/flac", "ogg": "audio/ogg", "mp3": "audio/mpeg"}[e]


# ---------------------------------------------------------------- SFZ parsing
OPC = re.compile(r"(?:(?<=\s)|^)([A-Za-z_][A-Za-z0-9_]*)=")


def parse_sfz(path):
    """Return list of region dicts with inherited opcodes. No #include support
    (the Versilian programs don't use it)."""
    text = open(path, encoding="utf-8", errors="replace").read()
    defines = {}
    for m in re.finditer(r"#define\s+(\$\w+)\s+(\S+)", text):
        defines[m.group(1)] = m.group(2)
    text = re.sub(r"#define[^\n]*", "", text)
    for k, v in defines.items():
        text = text.replace(k, v)
    scopes = {"control": {}, "global": {}, "master": {}, "group": {}, "region": None}
    regions = []
    cur = None

    def close_region():
        if scopes["region"] is not None:
            r = {}
            for s in ("global", "master", "group", "region"):
                r.update(scopes[s])
            r["_default_path"] = scopes["control"].get("default_path", "")
            regions.append(r)
            scopes["region"] = None

    for raw in text.splitlines():
        line = re.sub(r"//.*", "", raw).strip()
        if not line:
            continue
        # split header tokens off the line
        parts = re.split(r"(<\w+>)", line)
        for part in parts:
            part = part.strip()
            if not part:
                continue
            h = re.fullmatch(r"<(\w+)>", part)
            if h:
                name = h.group(1)
                close_region()
                if name == "region":
                    scopes["region"] = {}
                elif name in ("group", "master", "global", "control"):
                    if name == "global":
                        scopes["master"] = {}
                        scopes["group"] = {}
                    if name == "master":
                        scopes["group"] = {}
                    scopes[name] = {} if name != "control" else scopes["control"]
                    cur = name
                else:
                    cur = None
                continue
            target = scopes["region"] if scopes["region"] is not None else (scopes.get(cur) if cur else None)
            if target is None:
                continue
            ms = list(OPC.finditer(part))
            for i, m in enumerate(ms):
                end = ms[i + 1].start() if i + 1 < len(ms) else len(part)
                key, val = m.group(1), part[m.end():end].strip()
                if key == "sample":
                    # sample path runs to end of line in practice
                    val = part[m.end():].strip()
                    target[key] = val
                    break
                target[key] = val
    close_region()
    return regions


def region_zone(r, sfz_dir, repo_dir_rel, pack, known):
    sample = r.get("sample")
    if not sample:
        return None
    rel = os.path.normpath(os.path.join(repo_dir_rel, r["_default_path"].replace("\\", "/"),
                                        sample.replace("\\", "/"))).replace("\\", "/")
    if rel not in known:
        return None
    if "key" in r:
        k = note_midi(r["key"])
        lo = hi = ctr = k
    else:
        lo = note_midi(r.get("lokey", 0)) or 0
        hi = note_midi(r.get("hikey", 127))
        hi = 127 if hi is None else hi
        ctr = note_midi(r.get("pitch_keycenter"))
        if ctr is None:
            ctr = lo if lo == hi else 60
    lv = int(float(r.get("lovel", 1)))
    hv = int(float(r.get("hivel", 127)))
    rr = 1
    if "seq_position" in r:
        rr = int(float(r["seq_position"]))
    elif "lorand" in r:
        rr = int(float(r["lorand"]) * 8) + 1
    tune = int(float(r.get("tune", 0) or 0)) + int(float(r.get("transpose", 0) or 0)) * 100
    vol = round(float(r.get("volume", 0) or 0), 2)
    return dict(f=storage_key(pack, rel), lo=lo, hi=hi, c=ctr, lv=lv, hv=hv, rr=rr, t=tune, v=vol)


def pick_regions(regions):
    """Drop release triggers and choose one controller/keyswitch condition set."""
    regs = [r for r in regions if r.get("trigger", "attack") not in ("release", "release_key")]
    def sig(r):
        return tuple(sorted((k, v) for k, v in r.items() if re.match(r"(lo|hi)cc\d+|sw_", k)))
    groups = defaultdict(list)
    for r in regs:
        groups[sig(r)].append(r)
    if not groups:
        return []
    if () in groups:
        return groups[()]
    def score(item):
        s, rs = item
        d = dict(s)
        pedal_up = "hicc64" in d and int(float(d["hicc64"])) <= 64
        return (pedal_up, len(rs))
    return max(groups.items(), key=score)[1]


# ---------------------------------------------------------------- categories
PITCHED_PERC = re.compile(r"marimba|vibraphone|xylophone|glockenspiel|tubular|hand chimes|balafon|timpani|bells|kalimba|mbira|nyunga|wine glass|slit drum", re.I)


def vcsl_category(rel):
    top = rel.split("/")[0]
    name = os.path.splitext(os.path.basename(rel))[0]
    n = name.lower()
    if "piano" in n:
        return "Keys", "Piano", ["pop", "ballad", "jazz", "lo-fi", "classical", "r&b"]
    if "harpsichord" in n:
        return "Keys", "Harpsichord", ["baroque", "cinematic", "classical"]
    if "organ" in n:
        return "Keys", "Organ", ["gospel", "soul", "church", "rock"]
    if top == "Electrophones" or "tx81z" in rel.lower():
        return "Synths", "FM keys", ["80s", "synthwave", "r&b", "city pop"]
    if "harmonica" in n:
        return "Winds", "Harmonica", ["blues", "country", "folk"]
    if "sax" in n:
        return "Winds", "Saxophone", ["jazz", "r&b", "lo-fi", "funk"]
    if "recorder" in n or "ocarina" in n:
        return "Winds", "Flutes", ["folk", "medieval", "game", "chill"]
    if "didgeridoo" in n:
        return "World", "Didgeridoo", ["world", "ambient"]
    if "whistle" in n or "siren" in n:
        return "FX", "Whistles and sirens", ["fx", "dancehall", "carnival"]
    if "harp" in n:
        return "Strings", "Harp", ["cinematic", "classical", "fantasy"]
    if "strumstick" in n:
        return "Guitar and plucked", "Strumstick", ["folk", "acoustic"]
    if "dan tranh" in n or "psaltery" in n:
        return "World", "Zithers", ["world", "asian", "ambient"]
    if re.search(r"kalimba|mbira|nyunga", n):
        return "World", "Kalimba and mbira", ["afrobeats", "chill", "lo-fi", "world"]
    if "wine glass" in n:
        return "FX", "Textures", ["ambient", "cinematic"]
    if "timpani" in n:
        return "Orchestra", "Timpani", ["cinematic", "orchestral", "epic"]
    if PITCHED_PERC.search(n):
        return "Mallets", name.split(" ")[0], ["pop", "tropical house", "afrobeats", "cinematic"]
    if re.search(r"conga|bongo|darbuka|frame drum|cajon|agogo|cabasa|guiro|shaker|tambourine|claves|cowbell|woodblock|vibraslap|ratchet|slapstick|sleigh|triangle|bell tree|mark tree|finger|anvil|brake|flexatone|ocean|gong", n):
        return "Percussion", name, ["latin", "afro house", "reggaeton", "pop", "world"]
    if re.search(r"snare|tom|bass drum|cymbal|hi-hat|claps", n):
        sub = "Snare" if "snare" in n else "Tom" if "tom" in n else "Kick" if "bass drum" in n else "Hi-hat" if "hi-hat" in n else "Clap" if "clap" in n else "Cymbal"
        return "Drums", sub, ["acoustic", "rock", "pop", "orchestral"]
    return "Percussion", name, ["world"]


def vsco_category(name):
    n = name.lower()
    if re.search(r"violin|viola|cello|contrabass", n):
        return "Strings", re.sub(r"(Ens|S)?(Violin|Viola|Cello|Contrabass).*", r"\2", name), ["cinematic", "orchestral", "pop ballad", "classical"]
    if re.search(r"bassoon|clarinet|flute|oboe|piccolo", n):
        return "Winds", re.match(r"[A-Z][a-z]+", name).group(0), ["cinematic", "orchestral", "classical"]
    if re.search(r"horn|trombone|trumpet|tuba", n):
        return "Brass", "French horn" if "horn" in n else re.match(r"[A-Z][a-z]+", name).group(0), ["cinematic", "funk", "orchestral", "ska"]
    if "organ" in n:
        return "Keys", "Organ", ["church", "gospel", "cinematic"]
    if "piano" in n or "upright" in n:
        return "Keys", "Piano", ["pop", "ballad", "lo-fi", "classical"]
    if "harp" in n:
        return "Strings", "Harp", ["cinematic", "fantasy"]
    if "timpani" in n:
        return "Orchestra", "Timpani", ["cinematic", "epic"]
    if re.search(r"glock|marimba|xylo|tubular", n):
        return "Mallets", pretty_vsco(name), ["cinematic", "pop"]
    return "Percussion", "Orchestral percussion", ["cinematic", "orchestral"]


def pretty_vsco(name):
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name).replace("Ens", "ensemble").replace("SViolin", "Solo violin")
    s = s.replace(" Sus", " sustain").replace(" Stac", " staccato").replace(" Vib", " vibrato").replace("Pizz", "pizzicato")
    s = s.replace("Spic", "spiccato").replace("Trem", "tremolo").replace("-Quiet", " (quiet)").replace(" NV", " no vibrato").replace(" VB", " vibrato")
    s = s.replace("FHorn", "French horn").replace(" Exp ", " expressive ").replace(" Mute", " mute").replace(" Loud", " loud").replace(" Quiet", " quiet").replace(" Pedal", " pedal").replace(" Harmon", " harmon").replace(" Straight", " straight").replace(" Rolls", " rolls").replace(" Bells", " bells").replace(" Piano", " piano")
    return s[0].upper() + s[1:]


# ---------------------------------------------------------------- builders
def hit_name(f):
    stem = os.path.splitext(os.path.basename(f))[0]
    stem = re.sub(r"(_v\d+|_vl\d+|_rr\d+|_\d+|-\d+|_main|_close)+$", "", stem, flags=re.I)
    stem = re.sub(r"^(JH|MO)?", "", stem)
    return re.sub(r"[_\-]+", " ", stem).strip()


def sfz_items(pack, files, kind_of, categorize, pretty, skip):
    items = []
    base = os.path.join(SRC, pack["dir"])
    known = set(files)
    for root, _, names in os.walk(base):
        if "/.git" in root:
            continue
        for nm in sorted(names):
            if not nm.lower().endswith(".sfz"):
                continue
            full = os.path.join(root, nm)
            rel = os.path.relpath(full, base)
            name = os.path.splitext(nm)[0]
            if skip(name):
                continue
            regs = pick_regions(parse_sfz(full))
            zones = [z for z in (region_zone(r, root, os.path.dirname(rel), pack["id"], known) for r in regs) if z]
            if not zones:
                print("  no zones:", rel, file=sys.stderr)
                continue
            cat, sub, tags = categorize(rel)
            kind = kind_of(cat, name)
            item = dict(id=f"{pack['id']}:{slug(name)}", pack=pack["id"], name=pretty(name), kind=kind,
                        category=cat, sub=sub, tags=tags)
            if kind == "kit":
                hits = defaultdict(list)
                for z in zones:
                    hits[(z["lo"], z["hi"])].append(z)
                item["hits"] = [dict(name=hit_name(zs[0]["f"]).capitalize(), key=k[0],
                                     z=[[z["f"], z["lv"], z["hv"], z["rr"], z["v"]] for z in zs])
                                for k, zs in sorted(hits.items())]
            else:
                item["zones"] = [[z["f"], z["lo"], z["hi"], z["c"], z["lv"], z["hv"], z["rr"], z["t"], z["v"]] for z in zones]
            items.append(item)
    return items


VL = re.compile(r"^(?P<stem>.*?)_vl(?P<vl>\d+)_rr(?P<rr>\d+)$")
DRUM_WORDS = [
    (r"^k(ick)?(_|\d|$)|kick", "Kick"), (r"^s(nare)?\d|snare|^s1[34]|^s22", "Snare"), (r"hihat|hi-hat|^h\d|^h[cfhlot]$", "Hi-hat"),
    (r"^t[hlm]$|tom|^t\d", "Tom"), (r"ride|^r\d", "Ride"), (r"crash|china|splash|^c\d", "Cymbal"),
    (r"^ns$|noise", "Noises"), (r"^wb$|block", "Woodblock"),
]
GOGODZE = {"hc": "Hi-hat closed", "ho": "Hi-hat open", "hf": "Hi-hat foot", "hh": "Hi-hat half open", "hl": "Hi-hat loose",
           "ht": "Hi-hat tip", "ks": "Kick", "sc": "Snare center", "se": "Snare edge", "ss": "Side stick",
           "th": "Tom high", "tm": "Tom mid", "tl": "Tom low"}
UNRULY_DRUMS = {"c16": "Crash 16", "h14": "Hi-hat 14", "k20": "Kick 20", "ns": "Noises", "r20": "Ride 20",
                "s13": "Snare 13", "s14": "Snare 14", "s22": "Snare 22", "wb": "Woodblock"}


def drum_sub(name):
    n = name.lower()
    for pat, sub in DRUM_WORDS:
        if re.search(pat, n):
            return sub
    return "Percussion"


def karoryfer_kit(pack, files):
    """Kit items from Samples/<drum>/.../<mic>/<stem>_vlN_rrM files."""
    pieces = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))  # drum -> hit -> (vl,rr) -> [mic files]
    for f in files:
        parts = f.split("/")
        if parts[0] != "Samples":
            continue
        stem = os.path.splitext(parts[-1])[0]
        m = VL.match(stem)
        if not m:
            continue
        dirs = [p for p in parts[1:-1] if not re.fullmatch(r"rr\d+", p)]
        if pack["id"] == "gogodze":
            if dirs[0] != "front_mic":
                continue  # one mic is plenty for the browser; others stay in storage
            drum, hit = "kit", GOGODZE.get(m.group("stem"), m.group("stem"))
        elif pack["id"] == "unruly":
            drum = UNRULY_DRUMS.get(dirs[0], dirs[0])
            hit = m.group("stem")
        else:  # bigrusty: drum/artic/mic
            drum = dirs[0].replace("_", " ").capitalize()
            hit = (dirs[1] if len(dirs) > 2 else "") + ":" + m.group("stem")
        pieces[drum][hit][(int(m.group("vl")), int(m.group("rr")))].append(storage_key(pack["id"], f))
    items = []
    lofi = pack["id"] == "gogodze"
    for drum, hits in sorted(pieces.items()):
        hlist = []
        for hit, layers in sorted(hits.items()):
            vls = sorted({vl for vl, _ in layers})
            n = len(vls)
            z = []
            for (vl, rr), fs in sorted(layers.items()):
                i = vls.index(vl)
                lv = 1 + (127 * i) // n
                hv = (127 * (i + 1)) // n
                z.append([sorted(fs), lv, hv, rr, 0])
            label = hit.split(":")[-1].replace("_", " ")
            art = hit.split(":")[0] if ":" in hit else ""
            if art and art not in label:
                label = f"{label} ({art})"
            hlist.append(dict(name=label if lofi else f"{drum} {label}".strip(), z=z))
        if pack["id"] == "gogodze":
            name, sub = "Gogodze lo-fi kit", "Kit"
        else:
            name, sub = f"{pack['name']}: {drum}", drum_sub(drum)
        tags = ["lo-fi", "hip hop", "boom bap", "indie"] if lofi else ["acoustic", "rock", "pop", "funk", "indie"]
        items.append(dict(id=f"{pack['id']}:{slug(drum)}", pack=pack["id"], name=name, kind="kit",
                          category="Drums", sub=sub, tags=tags, hits=hlist))
    return items


NOTE_TOK = re.compile(r"(?:^|_)([a-g](?:b|#|s)?-?\d)(?=_|$)", re.I)
DYN = {"ppp": 1, "pp": 2, "p": 3, "mp": 4, "mf": 5, "f": 6, "ff": 7, "fff": 8}


def karoryfer_bass(pack, files):
    groups = defaultdict(list)
    noise = []
    for f in files:
        d = os.path.dirname(f)
        stem = os.path.splitext(os.path.basename(f))[0]
        leaf = d.split("/")[-1] if d else ""
        if re.search(r"rel(ease)?$", leaf):
            continue
        m = NOTE_TOK.search(stem)
        if not m or re.search(r"noise|scrape", d):
            noise.append(f)
            continue
        midi = note_midi(m.group(1).lower())
        toks = stem.split("_")
        dyn = next((DYN[t] for t in toks if t in DYN), 5)
        rr = next((int(t[2:]) for t in toks if re.fullmatch(r"rr\d+", t)), 1)
        groups[d].append((midi, dyn, rr, f))
    items = []
    for d, zs in sorted(groups.items()):
        notes = sorted({z[0] for z in zs})
        bounds = {}
        for i, n in enumerate(notes):
            lo = 0 if i == 0 else (notes[i - 1] + n) // 2 + 1
            hi = 127 if i == len(notes) - 1 else (n + notes[i + 1]) // 2
            bounds[n] = (lo, hi)
        dyns = sorted({z[1] for z in zs})
        zones = []
        for midi, dyn, rr, f in sorted(zs):
            i = dyns.index(dyn)
            lv = 1 + (127 * i) // len(dyns)
            hv = (127 * (i + 1)) // len(dyns)
            lo, hi = bounds[midi]
            zones.append([storage_key(pack["id"], f), lo, hi, midi, lv, hv, rr, 0, 0])
        segs = [x for x in d.replace("Samples/", "").split("/") if x]
        leaf = segs[-1] if segs else "notes"
        art = {"reg": "plucked", "stac": "staccato", "btb": "behind the bridge", "btb_extra": "behind the bridge extras",
               "fake_det": "harmonics", "fake_ntp": "harmonics, muted", "ghost": "ghost notes", "sustain": "sustain",
               "staccato": "staccato", "notes": "fingered"}.get(leaf, leaf.replace("_", " "))
        if len(segs) > 1:
            body = {"babyblue": "Baby Blue", "darkblack": "Dark Black"}.get(segs[0], segs[0].capitalize())
            art = f"{body} {art}"
        items.append(dict(id=f"{pack['id']}:{slug(d or 'notes')}", pack=pack["id"], name=f"{pack['name']}: {art}",
                          kind="instrument", category="Bass", sub="Electric bass",
                          tags=["funk", "rock", "pop", "r&b", "hip hop", "neo soul"], zones=zones))
    if noise:
        hits = defaultdict(list)
        for f in noise:
            stem = os.path.splitext(os.path.basename(f))[0]
            key = re.sub(r"_rr\d+$", "", stem)
            rr = int(re.search(r"_rr(\d+)$", stem).group(1)) if re.search(r"_rr(\d+)$", stem) else 1
            hits[key].append([storage_key(pack["id"], f), 1, 127, rr, 0])
        items.append(dict(id=f"{pack['id']}:noises", pack=pack["id"], name=f"{pack['name']}: string noises",
                          kind="kit", category="FX", sub="Bass noises", tags=["texture", "fx", "funk"],
                          hits=[dict(name=k.replace("_", " ").capitalize(), z=z) for k, z in sorted(hits.items())]))
    return items


def main():
    out = dict(version=1, packs=[], items=[], files={})
    seen_keys = {}
    for p in PACKS:
        d = os.path.join(SRC, p["dir"])
        sha = git(d, "rev-parse", "HEAD").strip()
        files = [f for f in git(d, "ls-tree", "-r", "HEAD", "--name-only").splitlines() if AUDIO.search(f)]
        for f in files:
            k = storage_key(p["id"], f)
            assert k not in seen_keys, (k, f, seen_keys[k])
            seen_keys[k] = f
        out["files"][p["id"]] = [[storage_key(p["id"], f), f, ctype(f)] for f in files]
        if p["id"] == "vcsl":
            items = sfz_items(p, files,
                              lambda cat, n: "kit" if cat in ("Percussion", "Drums") or (cat == "FX" and "glass" not in n.lower()) else "instrument",
                              vcsl_category, lambda n: n, lambda n: "keyswitch" in n.lower() or "legacy" in n.lower())
        elif p["id"] == "vsco2":
            items = sfz_items(p, files,
                              lambda cat, n: "kit" if cat == "Percussion" else "instrument",
                              lambda rel: vsco_category(os.path.splitext(os.path.basename(rel))[0]),
                              pretty_vsco, lambda n: n.endswith("-KS"))
        elif p["id"] in ("bigrusty", "unruly", "gogodze"):
            items = karoryfer_kit(p, files)
        else:
            items = karoryfer_bass(p, files)
        p2 = {k: v for k, v in p.items() if k != "dir"}
        p2.update(sha=sha, file_count=len(files), item_count=len(items))
        out["packs"].append(p2)
        out["items"].extend(items)
        print(f"{p['id']}: {len(files)} files, {len(items)} items", file=sys.stderr)
    # preview: a mid zone of each item
    for it in out["items"]:
        if it["kind"] == "instrument":
            zs = it["zones"]
            best = min(zs, key=lambda z: (abs(z[3] - 60), -z[5], z[6]))
            it["preview"] = best[0]
            it["range"] = [min(z[1] for z in zs), max(z[2] for z in zs)]
        else:
            z = it["hits"][0]["z"]
            f = z[len(z) // 2][0]
            it["preview"] = f[0] if isinstance(f, list) else f
    json.dump(out, open(OUT, "w"), separators=(",", ":"))
    print(f"items: {len(out['items'])}, files: {sum(len(v) for v in out['files'].values())}, bytes: {os.path.getsize(OUT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
