import os, sys
OUT = sys.argv[1]
HEAD = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}">
<meta name="theme-color" content="#0b0d10">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<script>document.documentElement.classList.add("js");setTimeout(function(){{if(!document.documentElement.classList.contains("motion-ready"))document.documentElement.classList.add("reveal-all")}},2500)</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/style.css?v=5">
<script src="/assets/supabase.js"></script><script src="/assets/app.js"></script>
<script src="/assets/motion.js?v=3" defer></script>
</head><body>
<header class="site"><div class="wrap">
<a class="brand" href="/"><span class="logo"><i class="on"></i><i></i><i class="t"></i><i></i><i class="on"></i><i></i><i class="t"></i><i></i><i class="on"></i></span>Loopwright</a>
<nav class="main">
<a href="/#how" class="hide-sm">How it works</a><a href="/pricing/" {a_pricing}>Pricing</a><a href="/download/" class="hide-xs{a_download}">Download</a><a href="/studio/" class="hide-sm" {a_studio}>Try it</a>
<span id="navAuth"></span>
</nav></div></header>
<main>
"""
FOOT = """</main>
<footer class="site"><div class="wrap">
<a class="brand" href="/" style="font-size:1rem"><span class="logo"><i class="on"></i><i></i><i class="t"></i><i></i><i class="on"></i><i></i><i class="t"></i><i></i><i class="on"></i></span>Loopwright</a>
<span class="links small"><a href="/#how">How it works</a><a href="/pricing/">Pricing</a><a href="/download/">Download</a><a href="/studio/">Try it</a><a href="/signin/">Sign in</a></span>
<span class="muted small" style="flex-basis:100%">Make songs from your own sounds.</span>
</div></footer>
{script}
</body></html>
"""
def page(path, title, desc, body, active="", script=""):
    a = {k: "" for k in ("a_pricing","a_download","a_studio")}
    if active: a["a_"+active] = 'class="active"'
    if active == "download": a["a_download"] = " active"
    html = HEAD.format(title=title, desc=desc, **a) + body + FOOT.format(script=script)
    d = os.path.join(OUT, path); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w").write(html)

def steps(pattern, cls="on"):
    return '<div class="steps16">' + "".join(f'<i class="{cls}"></i>' if c=="x" else "<i></i>" for c in pattern) + "</div>"

def svg(d, extra=""):
    return f'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"{extra}>{d}</svg>'
I = {
 "folder": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 14h2l1-3 2 6 1-3h2"/>',
 "sliders": '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
 "mic": '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/>',
 "upload": '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/>',
 "plug": '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
 "check": '<path d="M5 12l5 5L20 7"/>',
 "wave": '<path d="M2 12h2l2-6 3 12 3-9 3 6 2-3h5"/>',
 "spark": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
 "play": '<path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none"/>',
 "stop": '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>',
 "apple": '<path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.2 5.7c.6-.8 1.1-1.8 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3z" fill="currentColor" stroke="none"/>',
 "chip": '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
 "win": '<path d="M3 5.5l7.5-1v7H3zM12.5 4.2L21 3v8.5h-8.5zM3 12.5h7.5v7L3 18.5zM12.5 12.5H21V21l-8.5-1.2z"/>',
 "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
}
ARR = '<span class="arr">' + svg(I["arrow"], ' width="16" height="16"') + '</span>'
TICK = svg(I["check"])

SONG = [("kick","x...x...x...x...",False),("hats","..x...x...x...xx",False),("bass","x..x....x.x.....",False),
        ("my_vocal.wav",".x...x...x...x..",True),("guitar_loop","x.......x.......",True)]
SEQ = "".join(f'<div class="row{" yours" if y else ""}"><span class="name">{n}</span>{steps(p, "y" if y else "on")}</div>' for n,p,y in SONG)
PADS = "".join(f'<div class="pad"><span>{n}</span></div>' for n in ("KCK","HAT","BAS","VOX","GTR","CLP","SNR","KEY"))
CHIPS = [("kick",""),("snare",""),("clap",""),("hats",""),("808 bass",""),("keys","t"),("warm pad","t"),("my_vocal.wav","y"),
         ("pitch","t"),("reverse","t"),("chop","t"),("stretch","t"),("guitar_loop.wav","y"),("filter","t"),("drive","t"),("delay","t"),("reverb","t"),("Mic take 1","y")]
def chiprow(hidden=False):
    ah = ' aria-hidden="true"' if hidden else ""
    return "".join(f'<span class="chip {c}"{ah}><i></i>{n}</span>' for n,c in CHIPS)
WAVE = "".join(f'<b style="--d:{i};--h:{[.5,.9,.7,1,.6,.85,.4,.95,.65,.8,.5,.75,.9,.45,.7,.6][i%16]}"></b>' for i in range(26))
EQ = "".join(f'<b style="--d:{i};--h:{.3 + (i*37 % 70)/100}"></b>' for i in range(48))
MINI = "".join(f'<i style="--d:{i}"></i>' for i in range(8))

HOME = f"""
<section class="hero"><div class="hero-bg" aria-hidden="true"><div class="grid"></div><div class="orb a"></div><div class="orb b"></div></div>
<div class="wrap hero-grid">
<div class="hero-copy">
<span class="eyebrow">Desktop app · Mac first</span>
<h1 style="margin-top:18px">Make songs from <span class="grad">your own sounds.</span></h1>
<p class="lead">Start with a free library of drums, bass, keys and effects. Add your own samples, vocals and recordings. Then describe the song in plain words, and Loopwright arranges it. <b class="hi">The music stays yours.</b></p>
<div class="ctas"><a class="btn primary lg" href="/download/">Download for Mac {ARR}</a><a class="btn lg ghost" href="/studio/">Try it in your browser</a></div>
<div class="trust"><span>{TICK}200 free credits</span><span>{TICK}No card needed</span><span>{TICK}Free sounds, no license strings</span></div>
</div>
<div class="console-wrap">
<div class="console" id="console" aria-label="Loopwright studio arranging a song">
<div class="floaty f1" aria-hidden="true"><i></i>my_vocal.wav added</div>
<div class="floaty f2" aria-hidden="true"><i></i>chop · offbeat</div>
<div class="c-top">
<div class="c-dots" aria-hidden="true"><i></i><i></i><i></i></div>
<span class="c-title">untitled-song · arrange</span>
<div class="transport" aria-hidden="true"><span class="tbtn play">{svg(I["play"])}</span><span class="tbtn">{svg(I["stop"])}</span><span class="tbtn rec"><i></i></span><span class="bpm"><span data-bpm>84</span> BPM</span></div>
</div>
<div class="seq">{SEQ}<div class="playhead" aria-hidden="true"></div></div>
<div class="c-bottom" aria-hidden="true">
<div class="pads">{PADS}</div>
<div class="mix">
<div class="knob"><i style="--v:.35"></i>Filter</div><div class="knob"><i style="--v:.6"></i>Drive</div><div class="knob"><i style="--v:.7"></i>Space</div>
<div class="meter"><b></b><b></b></div>
</div>
</div>
<div class="prompt-bar"><b>›</b><span class="txt">slow lo-fi beat, my vocal chopped on the offbeat</span><i class="caret" aria-hidden="true"></i><span class="status">84 bpm</span></div>
</div>
</div>
</div></section>

<div class="marquee" aria-label="Sounds and effects"><div class="track">{chiprow()}{chiprow(True)}</div></div>

<section class="block" id="how"><div class="wrap">
<div class="sec-head" data-reveal><span class="eyebrow">How it works</span><h2>Three steps from idea to track.</h2><p>A plain-words prompt does the arranging. You keep full control of every step afterwards.</p></div>
<div class="steps" data-stagger>
<div class="card" data-reveal><div class="viz"><div class="wave">{WAVE}</div><span class="drop">+ my_vocal.wav</span></div><span class="num">01</span><h3>Pick your sounds</h3><p class="muted">Start from the free starter library, drop in your own WAVs, loops and vocals, or record straight from your mic.</p></div>
<div class="card" data-reveal><div class="viz"><div class="typing"><b>›</b><span>dark trap at 140, my guitar reversed</span><i class="caret"></i></div></div><span class="num">02</span><h3>Describe the song</h3><p class="muted">“Dark trap at 140, my guitar pitched down and reversed.” Loopwright picks the steps, effects and levels from your library.</p></div>
<div class="card" data-reveal><div class="viz"><div class="mini-seq" style="margin-top:-18px">{MINI}</div><div class="export"><span>track.wav</span><span class="bar"></span></div></div><span class="num">03</span><h3>Shape it and export</h3><p class="muted">Edit any step, play parts live on the on-screen keyboard, tweak the effects, then export a WAV.</p></div>
</div>
</div></section>

<section class="block"><div class="wrap">
<div class="sec-head" data-reveal><span class="eyebrow">What you get</span><h2>A full kit on day one, and room for yours.</h2><p>Loopwright comes loaded with sounds and effects you can use anywhere. Bring your own whenever you're ready.</p></div>
<div class="bento" data-stagger>
<div class="card wide" data-reveal><div class="icon amber">{svg(I["folder"])}</div><h3>Free starter library</h3><p class="muted">Drums, bass, keys and pads come built in. They're made in code, so they're free to use in anything you release, with no license strings attached.</p>
<div class="lib"><span class="chip"><i></i>kick</span><span class="chip"><i></i>snare</span><span class="chip"><i></i>clap</span><span class="chip"><i></i>hats</span><span class="chip"><i></i>808 bass</span><span class="chip t"><i></i>keys</span><span class="chip t"><i></i>piano</span><span class="chip t"><i></i>warm pad</span></div></div>
<div class="card wide" data-reveal><div class="icon">{svg(I["sliders"])}</div><h3>Effects included</h3><p class="muted">Pitch, reverse, chop, stretch, filter, drive, delay and reverb come with the app at no extra cost.</p>
<div class="fx-row" aria-hidden="true"><div class="knob"><i style="--v:.45"></i>Pitch</div><div class="knob"><i style="--v:.6"></i>Filter</div><div class="knob"><i style="--v:.35"></i>Drive</div><div class="knob"><i style="--v:.7"></i>Delay</div><div class="knob"><i style="--v:.5"></i>Reverb</div></div></div>
<div class="card" data-reveal><div class="icon green">{svg(I["upload"])}</div><h3>Upload your samples</h3><p class="muted">Drop in WAV loops, one-shots and vocals and use them right next to the starter sounds.</p></div>
<div class="card" data-reveal><div class="icon green">{svg(I["mic"])}</div><h3>Make your own sounds</h3><p class="muted">Record your voice or an instrument from the mic, or play a part on the on-screen keyboard and keep the take.</p></div>
<div class="card" data-reveal><div class="icon">{svg(I["plug"])}</div><span class="tag soon" style="margin-bottom:10px">Coming to the desktop app</span><h3>Manage your plugins</h3><p class="muted">Point Loopwright at your plugin folders and use your own instruments and effects alongside the built-in ones.</p></div>
</div>
</div></section>

<section class="block"><div class="wrap split">
<div data-reveal="left">
<span class="eyebrow">Your music stays yours</span>
<h2>The AI arranges. It never makes the audio.</h2>
<p class="muted" style="font-size:1.06rem">Loopwright only decides which of your sounds play when, and with which effects. Every note you hear comes from the starter library or from you.</p>
<ul class="checks">
<li><span class="tick">{TICK}</span><span><b>Your audio stays on your computer.</b> Only sound names and lengths go to the arranger, never the recordings.</span></li>
<li><span class="tick">{TICK}</span><span><b>Starter sounds are license-free.</b> Use them in anything you put out.</span></li>
<li><span class="tick">{TICK}</span><span><b>Credits you can see.</b> 1 credit is 1 cent, you see the most a run can cost, and failed runs are free.</span></li>
</ul>
</div>
<div class="flow" data-reveal="scale" aria-label="How a song is made">
<div class="node you"><span class="dot">{svg(I["folder"])}</span><div>Your sounds + starter library<small>samples, vocals, mic takes, built-in kit</small></div></div>
<div class="link" aria-hidden="true"></div>
<div class="node ai"><span class="dot">{svg(I["spark"])}</span><div>The arranger reads your prompt<small>sees sound names and lengths only</small></div></div>
<div class="link" aria-hidden="true"></div>
<div class="node out"><span class="dot">{svg(I["wave"])}</span><div>Your song plays on your computer<small>edit any step, then export a WAV</small></div></div>
</div>
</div></section>

<section class="block"><div class="wrap">
<div class="stats" data-stagger>
<div class="stat-card" data-reveal><div class="n led" data-count="200">200</div><p>free credits when you sign up</p></div>
<div class="stat-card" data-reveal><div class="n t">1¢</div><p>per credit, so no surprise bills</p></div>
<div class="stat-card" data-reveal><div class="n" data-count="8">8</div><p>effects included free</p></div>
<div class="stat-card" data-reveal><div class="n" data-count="4">4</div><p>arranging modes, from Quick to Studio</p></div>
</div>
</div></section>

<section style="padding:24px 0 40px"><div class="wrap">
<div class="cta-band" data-reveal="scale">
<div class="eq" aria-hidden="true">{EQ}</div>
<span class="eyebrow">Free to start</span>
<h2 style="margin-top:14px">Your sounds. Your song.</h2>
<p>Create a free account and get 200 credits to arrange with. No card needed.</p>
<div class="ctas"><a class="btn primary lg" href="/signin/?mode=signup">Create a free account {ARR}</a><a class="btn lg ghost" href="/pricing/">See pricing</a></div>
</div>
</div></section>
"""
page("", "Loopwright", "Make songs from your own sounds and a free starter library. Describe the song in plain words and Loopwright arranges it.", HOME)


PRICING = f"""
<section class="page-hero"><div class="hero-bg" aria-hidden="true"><div class="grid"></div><div class="orb a"></div></div><div class="wrap hero-copy">
<span class="eyebrow">Pricing</span>
<h1>Simple credits, <span class="grad">no surprise bills.</span></h1>
<p class="lead">1 credit = 1 cent. Credits pay for the AI that arranges your songs. Playing, editing, effects and export run on your computer and are always free.</p>
</div></section>
<section style="padding-bottom:40px"><div class="wrap">
<div class="plans" data-stagger>
<div class="plan" data-reveal><span class="label">Free</span><div class="price">$0</div><span class="credits">200 credits once</span><ul><li>All built-in sounds and effects</li><li>Upload and record your own sounds</li><li>WAV export</li></ul><a class="btn" href="/signin/?mode=signup">Create account</a></div>
<div class="plan" data-reveal><span class="label">Starter</span><div class="price">$8<small>/month</small></div><span class="credits">1,000 credits a month</span><ul><li>Everything in Free</li><li>Top up any time</li></ul><button class="btn" disabled>Coming soon</button></div>
<div class="plan best" data-reveal><span class="badge">Most popular</span><span class="label" style="color:var(--accent)">Pro</span><div class="price">$20<small>/month</small></div><span class="credits">3,000 credits a month</span><ul><li>Everything in Free</li><li>Room for Pro and Studio modes</li></ul><button class="btn primary" disabled>Coming soon</button></div>
<div class="plan" data-reveal><span class="label">Studio</span><div class="price">$50<small>/month</small></div><span class="credits">8,000 credits a month</span><ul><li>Everything in Free</li><li>For heavy daily use</li></ul><button class="btn" disabled>Coming soon</button></div>
</div>
<p class="muted small" style="margin-top:16px;text-align:center">Paid plans and top-ups open soon. Every new account gets 200 free credits.</p>

<div class="grid2" style="margin-top:48px" data-stagger>
<div class="card" data-reveal><h3>Top-ups</h3><table class="simple"><tr><th>Pack</th><th>Credits</th></tr>
<tr><td>$5</td><td>500</td></tr><tr><td>$20</td><td>2,100</td></tr><tr><td>$50</td><td>5,500</td></tr></table></div>
<div class="card" data-reveal><h3>Arranging modes</h3><table class="simple"><tr><th>Mode</th><th>About per arrangement</th></tr>
<tr><td>Quick</td><td>1 to 3 credits</td></tr><tr><td>Standard (default)</td><td>about 12 credits</td></tr><tr><td>Pro</td><td>about 23 credits</td></tr><tr><td>Studio</td><td>about 65 credits</td></tr></table>
<p class="muted small" style="margin-top:10px">Estimates. You always see the cap before a run, and a run that fails costs nothing.</p></div>
</div>
</div></section>
<section class="block" style="padding-top:56px"><div class="wrap">
<div class="sec-head center" data-reveal><span class="eyebrow">Questions</span><h2>Good to know</h2></div>
<div class="faq" data-stagger>
<details data-reveal><summary>What do credits pay for?</summary><p>Only the AI that arranges your song from your prompt. Playing, editing, effects and exporting run on your computer and never use credits.</p></details>
<details data-reveal><summary>Can I use the starter sounds in songs I release?</summary><p>Yes. The built-in drums, bass, keys and pads are made in code and come with no license strings.</p></details>
<details data-reveal><summary>What happens if a run fails?</summary><p>It costs nothing. Before a big run you also see the most it can cost, and you can set your own cap per prompt in your account.</p></details>
<details data-reveal><summary>Do my recordings get uploaded?</summary><p>No. Only sound names and lengths are sent to the arranger. Your audio stays on your computer.</p></details>
</div>
</div></section>
"""
page("pricing", "Pricing · Loopwright", "Loopwright pricing: 1 credit is 1 cent, 200 free credits, plans from $8 a month.", PRICING, "pricing")


SIGNIN = """
<section class="auth"><div class="hero-bg" aria-hidden="true"><div class="grid"></div><div class="orb a"></div><div class="orb b"></div></div><div class="wrap narrow">
<div class="leds" aria-hidden="true"><i style="--d:0"></i><i style="--d:1"></i><i style="--d:2"></i><i style="--d:3"></i><i style="--d:4"></i><i style="--d:5"></i><i style="--d:6"></i><i style="--d:7"></i></div>
<h1 data-reveal>Welcome to Loopwright</h1>
<p class="sub" data-reveal style="--i:1">One account for the website and the desktop app.</p>
<div class="panel glow" data-reveal="scale" style="--i:2">
<div class="tabs" role="tablist"><button id="tabIn" class="on" type="button">Sign in</button><button id="tabUp" type="button">Create account</button></div>
<form id="authForm" class="stack" novalidate>
<label class="f" id="nameRow" hidden>Name<input id="name" autocomplete="name" placeholder="What should we call you?"></label>
<label class="f">Email<input id="email" type="email" autocomplete="email" required></label>
<label class="f">Password<input id="password" type="password" autocomplete="current-password" minlength="8" required></label>
<label class="check" id="termsRow" hidden><input type="checkbox" id="terms"> <span>I'll only upload sounds I own or have the rights to use.</span></label>
<div id="msg" class="msg" hidden></div>
<button class="btn primary" id="submit" type="submit">Sign in</button>
<button class="btn sm" id="forgot" type="button" style="background:transparent;border:0;color:var(--fg-2)">Forgot your password?</button>
</form>
</div>
<p class="muted small" style="text-align:center;margin-top:18px">New accounts start with 200 free credits.</p>
</div></section>
"""

SIGNIN_JS = """<script>
const {sb,$,show}=LW; let mode=new URLSearchParams(location.search).get("mode")==="signup"?"up":"in";
function setMode(m){mode=m;$("tabIn").classList.toggle("on",m==="in");$("tabUp").classList.toggle("on",m==="up");
 $("nameRow").hidden=m!=="up";$("termsRow").hidden=m!=="up";$("submit").textContent=m==="up"?"Create account":"Sign in";
 $("password").autocomplete=m==="up"?"new-password":"current-password";$("forgot").hidden=m==="up";show($("msg"));}
$("tabIn").onclick=()=>setMode("in");$("tabUp").onclick=()=>setMode("up");setMode(mode);
LW.user().then(u=>{if(u)location.replace("/account/");});
$("authForm").onsubmit=async e=>{e.preventDefault();const email=$("email").value.trim(),password=$("password").value;
 if(!email||!password){show($("msg"),"Enter your email and password.","err");return;}
 const b=$("submit");b.disabled=true;
 try{
  if(mode==="up"){
   if(password.length<8){show($("msg"),"Use at least 8 characters for your password.","err");return;}
   if(!$("terms").checked){show($("msg"),"Please confirm you'll only upload sounds you have the rights to.","err");return;}
   const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+"/account/",data:{display_name:$("name").value.trim()||undefined}}});
   if(error)throw error;
   if(data.session){location.replace("/account/");}
   else show($("msg"),"Check your email to confirm your account, then sign in.","ok");
  }else{
   const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;location.replace("/account/");
  }
 }catch(err){show($("msg"),err.message||"Something went wrong. Try again.","err");}
 finally{b.disabled=false;}
};
$("forgot").onclick=async()=>{const email=$("email").value.trim();if(!email){show($("msg"),"Type your email first, then tap Forgot.","err");return;}
 const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/account/?reset=1"});
 show($("msg"),error?error.message:"If that email has an account, a reset link is on its way.",error?"err":"ok");};
</script>"""
page("signin", "Sign in · Loopwright", "Sign in or create your Loopwright account.", SIGNIN, script=SIGNIN_JS)

ACCOUNT = """
<section style="padding:56px 0"><div class="wrap">
<div id="loading" class="skeleton" aria-label="Loading your account"><i style="width:30%;height:34px"></i><i style="width:55%"></i><i style="height:120px"></i></div>
<div id="acct" hidden>
<div class="acct-head" data-reveal>
<div><span class="eyebrow">Account</span><h1 id="hello" style="font-size:clamp(1.8rem,4vw,2.4rem);margin-top:10px">Your account</h1><p class="who" id="who"></p></div>
<div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn primary" href="/download/">Download the app</a><button class="btn" id="signout" type="button">Sign out</button></div>
</div>
<div id="resetBox" class="panel glow" hidden style="margin-bottom:18px"><h3 style="margin-bottom:12px">Set a new password</h3>
<form id="resetForm" class="stack"><input id="newpw" type="password" minlength="8" autocomplete="new-password" placeholder="New password (8+ characters)"><button class="btn primary" type="submit">Save password</button><div id="resetMsg" class="msg" hidden></div></form></div>
<div class="grid2" data-stagger>
<div class="card" data-reveal><span class="label">Plan</span><div class="stat" id="plan" style="margin-top:8px">Free</div><p class="muted small" id="planNote">Paid plans open soon.</p><a class="btn sm" href="/pricing/" style="margin-top:14px">See plans</a></div>
<div class="card" data-reveal><span class="label">Credits</span><div class="stat led" id="credits" style="margin-top:8px">0</div><p class="muted small" id="creditNote">1 credit = 1 cent. Buying credits opens soon.</p></div>
</div>
<div class="panel" style="margin-top:18px" data-reveal><h3 style="margin-bottom:16px">Settings</h3>
<form id="settingsForm" class="stack">
<div class="grid2">
<label class="f">Display name<input id="sName" maxlength="60"></label>
<label class="f">Default arranging mode<select id="sMode"><option value="quick">Quick</option><option value="standard">Standard</option><option value="pro">Pro</option><option value="studio">Studio</option></select></label>
<label class="f">Most credits one prompt may use<input id="sCap" type="number" min="1" max="1000" step="1"></label>
<label class="f">Theme<select id="sTheme"><option value="dark">Dark studio</option><option value="light">Light</option></select></label>
</div>
<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn primary" type="submit">Save settings</button><span id="sMsg" class="muted small"></span></div>
</form>
<p class="muted small" style="margin-top:14px">Audio device, MIDI and plugin folders are set in the desktop app.</p>
</div>
</div>
</div></section>
"""

ACCOUNT_JS = """<script>
const {sb,$,show}=LW;
(async()=>{
 const u=await LW.user(); if(!u){location.replace("/signin/");return;}
 $("loading").hidden=true;$("acct").hidden=false;$("who").textContent=u.email;
 if(new URLSearchParams(location.search).get("reset")==="1")$("resetBox").hidden=false;
 const [p,s,c,sub]=await Promise.all([
  sb.from("profiles").select("display_name,plan").eq("id",u.id).maybeSingle(),
  sb.from("user_settings").select("default_mode,credit_cap_per_prompt,theme").eq("user_id",u.id).maybeSingle(),
  sb.from("credit_balance").select("balance").eq("user_id",u.id).maybeSingle(),
  sb.from("subscriptions").select("plan,status,current_period_end").eq("user_id",u.id).maybeSingle()]);
 const name=p.data&&p.data.display_name; if(name)$("hello").textContent="Hi, "+name; $("sName").value=name||"";
 const plan=(sub.data&&sub.data.plan)||(p.data&&p.data.plan)||"free"; $("plan").textContent=plan[0].toUpperCase()+plan.slice(1);
 if(sub.data&&sub.data.status&&sub.data.status!=="active")$("planNote").textContent="Status: "+sub.data.status;
 const bal=(c.data&&c.data.balance)||0;$("credits").textContent=bal.toLocaleString();if(!bal)$("creditNote").textContent="Your 200 free credits are added when AI arranging opens. 1 credit = 1 cent.";
 const st=s.data||{default_mode:"standard",credit_cap_per_prompt:100,theme:"dark"};
 $("sMode").value=st.default_mode;$("sCap").value=st.credit_cap_per_prompt;$("sTheme").value=st.theme;
 $("settingsForm").onsubmit=async e=>{e.preventDefault();$("sMsg").textContent="Saving…";
  const cap=Math.max(1,Math.min(1000,parseInt($("sCap").value,10)||100));
  const r1=await sb.from("user_settings").upsert({user_id:u.id,default_mode:$("sMode").value,credit_cap_per_prompt:cap,theme:$("sTheme").value});
  const r2=await sb.from("profiles").update({display_name:$("sName").value.trim()||null}).eq("id",u.id);
  const err=r1.error||r2.error; $("sMsg").textContent=err?("Couldn't save: "+err.message):"Saved.";
  if(!err&&$("sName").value.trim())$("hello").textContent="Hi, "+$("sName").value.trim();};
 $("resetForm").onsubmit=async e=>{e.preventDefault();const {error}=await sb.auth.updateUser({password:$("newpw").value});
  show($("resetMsg"),error?error.message:"Password updated.",error?"err":"ok");};
 $("signout").onclick=async()=>{await sb.auth.signOut();location.replace("/");};
})();
</script>"""
page("account", "Account · Loopwright", "Your Loopwright plan, credits and settings.", ACCOUNT, script=ACCOUNT_JS)

DOWNLOAD = f"""
<section class="page-hero left"><div class="hero-bg" aria-hidden="true"><div class="grid"></div><div class="orb a"></div></div><div class="wrap hero-copy">
<span class="eyebrow">Version 0.1.1</span>
<h1>Download <span class="grad">Loopwright</span></h1>
<p class="lead">Install the desktop app, then sign in with your Loopwright account.</p>
</div></section>
<section style="padding-bottom:30px"><div class="wrap">
<div class="dl" data-stagger>
<div class="card rec" data-reveal><div style="display:flex;justify-content:space-between;align-items:start"><span class="os">{svg(I["apple"])}</span><span class="tag on">Recommended</span></div><h3>Mac with Apple chip</h3><p class="muted small">M1, M2, M3, M4 or newer. macOS 12 or later.</p><a class="btn primary" href="/downloads/Loopwright-mac-arm64.tar.xz" download>Download for Apple chip {ARR}</a><span class="muted small">__ARM_MB__ MB</span></div>
<div class="card" data-reveal><div style="display:flex;justify-content:space-between;align-items:start"><span class="os">{svg(I["chip"])}</span><span class="tag">Older Macs</span></div><h3>Mac with Intel chip</h3><p class="muted small">Intel Macs, macOS 12 or later.</p><a class="btn" href="/downloads/Loopwright-mac-x64.tar.xz" download>Download for Intel</a><span class="muted small">__X64_MB__ MB</span></div>
<div class="card" data-reveal><div style="display:flex;justify-content:space-between;align-items:start"><span class="os">{svg(I["win"])}</span><span class="tag soon">Coming later</span></div><h3>Windows</h3><p class="muted small">The Windows version comes after the Mac one.</p><button class="btn" disabled>Not yet</button></div>
</div>
<p class="muted small" style="margin-top:16px">Not sure which Mac you have? Apple menu &gt; About This Mac. "Chip: Apple M…" means Apple chip.</p>

<div class="panel" style="margin-top:32px" data-reveal><h3>First time opening it</h3>
<p class="muted" style="margin-top:6px">This early version isn't signed by Apple yet, so macOS asks you to confirm the first time.</p>
<ol class="howto">
<li><span>Double-click the download in your Downloads folder to unpack it, then drag <b class="hi">Loopwright</b> into Applications.</span></li>
<li><span>In Applications, right-click (or Control-click) Loopwright and choose <b class="hi">Open</b>, then <b class="hi">Open</b> again.</span></li>
<li><span>If macOS only offers Move to Trash, open System Settings &gt; Privacy &amp; Security, scroll down and click <b class="hi">Open Anyway</b>.</span></li>
<li><span>If it says the app "is damaged", open Terminal, paste this and press Return, then open the app again:</span></li>
</ol>
<pre>xattr -cr /Applications/Loopwright.app</pre>
<p class="muted small" style="margin-top:10px">If double-clicking doesn't unpack it, run this in Terminal instead: <code>cd ~/Downloads &amp;&amp; tar -xf Loopwright-mac-*.tar.xz</code></p>
</div>
</div></section>
"""

import os as _os
_dl=_os.path.join(OUT,"downloads")
_mb=lambda f: str(round(_os.path.getsize(_os.path.join(_dl,f))/1048576)) if _os.path.exists(_os.path.join(_dl,f)) else "?"
DOWNLOAD=DOWNLOAD.replace("__ARM_MB__",_mb("Loopwright-mac-arm64.tar.xz")).replace("__X64_MB__",_mb("Loopwright-mac-x64.tar.xz"))
page("download", "Download · Loopwright", "Download the Loopwright desktop app for Mac.", DOWNLOAD, "download")
