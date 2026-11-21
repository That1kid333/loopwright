import os, sys
OUT = sys.argv[1]
HEAD = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}">
<meta name="theme-color" content="#0b0d10">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/assets/style.css">
<script src="/assets/supabase.js"></script><script src="/assets/app.js"></script>
</head><body>
<header class="site"><div class="wrap">
<a class="brand" href="/"><span class="logo"><i class="on"></i><i></i><i class="t"></i><i></i><i class="on"></i><i></i><i class="t"></i><i></i><i class="on"></i></span>Loopwright</a>
<nav class="main">
<a href="/#how" class="hide-sm">How it works</a><a href="/pricing/" {a_pricing}>Pricing</a><a href="/download/" {a_download}>Download</a><a href="/studio/" class="hide-sm" {a_studio}>Try it</a>
<span id="navAuth"></span>
</nav></div></header>
<main>
"""
FOOT = """</main>
<footer class="site"><div class="wrap">
<span class="muted small">Loopwright · make songs from your own sounds</span>
<span class="small"><a href="/pricing/">Pricing</a> · <a href="/download/">Download</a> · <a href="/signin/">Sign in</a></span>
</div></footer>
{script}
</body></html>
"""
def page(path, title, desc, body, active="", script=""):
    a = {k: "" for k in ("a_pricing","a_download","a_studio")}
    if active: a["a_"+active] = 'class="active"'
    html = HEAD.format(title=title, desc=desc, **a) + body + FOOT.format(script=script)
    d = os.path.join(OUT, path); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w").write(html)

def steps(pattern, cls="on"):
    return '<div class="steps16">' + "".join(f'<i class="{cls}"></i>' if c=="x" else "<i></i>" for c in pattern) + "</div>"

HOME = f"""
<section class="hero"><div class="wrap hero-grid">
<div>
<span class="tag on">Desktop app · Mac first</span>
<h1 style="margin-top:16px">Make songs from your own sounds.</h1>
<p class="lead">Upload your samples, loops and vocals, then describe the song in plain words. Loopwright arranges <b style="color:var(--fg)">your</b> sounds into a track. No stock loops, no AI-made audio, and your recordings stay yours.</p>
<div class="ctas"><a class="btn primary" href="/download/">Download for Mac</a><a class="btn" href="/studio/">Try it in your browser</a></div>
<p class="muted small" style="margin-top:14px">Free to start with 200 credits. No card needed.</p>
</div>
<div class="rack" aria-label="Example arrangement">
<div class="label" style="margin-bottom:8px">Arrange view · 92 BPM</div>
<div class="row"><span class="name">kick</span>{steps("x...x...x...x...")}</div>
<div class="row"><span class="name">hats</span>{steps("..x...x...x...xx")}</div>
<div class="row"><span class="name">bass</span>{steps("x..x....x.x.....")}</div>
<div class="row"><span class="name yours">my_vocal.wav</span>{steps(".x...x...x...x..","y")}</div>
<div class="row"><span class="name yours">guitar_loop</span>{steps("x.......x.......","y")}</div>
<div class="prompt-bar"><b>›</b> slow lo-fi beat, my vocal chopped on the offbeat</div>
</div>
</div></section>

<section class="block" id="how"><div class="wrap">
<h2>How it works</h2>
<p class="muted">A plain-words prompt does the arranging. You keep full control of every step afterwards.</p>
<div class="cards">
<div class="card"><span class="num">01</span><h3>Bring your sounds</h3><p class="muted">Drop in WAVs, loops, one-shots and vocals. Built-in basic drums, bass and keys are made in code, so there are no stock samples to license.</p></div>
<div class="card"><span class="num">02</span><h3>Describe the song</h3><p class="muted">"Dark trap at 140, my sample pitched down and reversed." Loopwright picks steps, effects and levels using only what's in your library.</p></div>
<div class="card"><span class="num">03</span><h3>Shape it and export</h3><p class="muted">Edit the steps, play parts live on the on-screen keyboard, tweak effects, then export a WAV.</p></div>
</div>
</div></section>

<section class="block"><div class="wrap">
<h2>Built for your own material</h2>
<div class="cards">
<div class="card"><h3>Your sounds stay yours</h3><p class="muted">Only sound names and lengths are sent to the arranger, never the audio. Processing runs on your computer.</p></div>
<div class="card"><h3>Free effects included</h3><p class="muted">Pitch, reverse, chop, stretch, filter, drive, delay and reverb come with the app at no extra cost.</p></div>
<div class="card"><h3>Credits you can see</h3><p class="muted">1 credit is 1 cent. Before a big run you see the most it can cost, and failed runs are free.</p></div>
<div class="card"><h3>Dark studio look</h3><p class="muted">Near-black panels, amber step lights and high contrast that stays easy on the eyes in long sessions.</p></div>
</div>
<div class="ctas" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:28px"><a class="btn primary" href="/signin/?mode=signup">Create a free account</a><a class="btn" href="/pricing/">See pricing</a></div>
</div></section>
"""
page("", "Loopwright", "Make songs from your own sounds. Describe the song in plain words and Loopwright arranges your samples, loops and vocals.", HOME)

PRICING = """
<section class="hero" style="padding-bottom:20px"><div class="wrap">
<h1>Simple credits, no surprise bills.</h1>
<p class="lead">1 credit = 1 cent. Credits pay for the AI that arranges your songs. Playing, editing, effects and export run on your computer and are always free.</p>
</div></section>
<section style="padding-bottom:40px"><div class="wrap">
<div class="plans">
<div class="plan"><span class="label">Free</span><div class="price">$0</div><ul><li>200 credits once</li><li>All built-in sounds and effects</li><li>WAV export</li></ul><a class="btn" href="/signin/?mode=signup">Create account</a></div>
<div class="plan"><span class="label">Starter</span><div class="price">$8<small>/month</small></div><ul><li>1,000 credits a month</li><li>Everything in Free</li></ul><button class="btn" disabled>Coming soon</button></div>
<div class="plan best"><span class="label" style="color:var(--accent)">Pro</span><div class="price">$20<small>/month</small></div><ul><li>3,000 credits a month</li><li>Everything in Free</li></ul><button class="btn primary" disabled>Coming soon</button></div>
<div class="plan"><span class="label">Studio</span><div class="price">$50<small>/month</small></div><ul><li>8,000 credits a month</li><li>For heavy daily use</li></ul><button class="btn" disabled>Coming soon</button></div>
</div>
<p class="muted small" style="margin-top:14px">Paid plans and top-ups open soon. Every new account gets 200 free credits.</p>

<div class="grid2" style="margin-top:40px">
<div class="card"><h3>Top-ups</h3><table class="simple"><tr><th>Pack</th><th>Credits</th></tr>
<tr><td>$5</td><td>500</td></tr><tr><td>$20</td><td>2,100</td></tr><tr><td>$50</td><td>5,500</td></tr></table></div>
<div class="card"><h3>Arranging modes</h3><table class="simple"><tr><th>Mode</th><th>About per arrangement</th></tr>
<tr><td>Quick</td><td>1 to 3 credits</td></tr><tr><td>Standard (default)</td><td>about 12 credits</td></tr><tr><td>Pro</td><td>about 23 credits</td></tr><tr><td>Studio</td><td>about 65 credits</td></tr></table>
<p class="muted small" style="margin-top:10px">Estimates. You always see the cap before a run, and a run that fails costs nothing.</p></div>
</div>
</div></section>
"""
page("pricing", "Pricing · Loopwright", "Loopwright pricing: 1 credit is 1 cent, 200 free credits, plans from $8 a month.", PRICING, "pricing")

SIGNIN = """
<section style="padding:60px 0"><div class="wrap narrow">
<div class="panel">
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
<p class="muted small" style="text-align:center;margin-top:16px">Use the same account in the desktop app.</p>
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
<section style="padding:48px 0"><div class="wrap">
<div id="loading" class="muted">Loading your account…</div>
<div id="acct" hidden>
<div style="display:flex;gap:16px;align-items:end;justify-content:space-between;flex-wrap:wrap;margin-bottom:24px">
<div><span class="label">Account</span><h1 id="hello" style="font-size:2rem;margin-top:6px">Your account</h1><p class="who" id="who"></p></div>
<div style="display:flex;gap:10px"><a class="btn primary" href="/download/">Download the app</a><button class="btn" id="signout" type="button">Sign out</button></div>
</div>
<div id="resetBox" class="panel" hidden style="margin-bottom:16px"><h3 style="margin-bottom:10px">Set a new password</h3>
<form id="resetForm" class="stack"><input id="newpw" type="password" minlength="8" autocomplete="new-password" placeholder="New password (8+ characters)"><button class="btn primary" type="submit">Save password</button><div id="resetMsg" class="msg" hidden></div></form></div>
<div class="grid2">
<div class="card"><span class="label">Plan</span><div class="stat" id="plan" style="margin-top:6px">Free</div><p class="muted small" id="planNote">Paid plans open soon.</p><a class="btn sm" href="/pricing/" style="margin-top:12px">See plans</a></div>
<div class="card"><span class="label">Credits</span><div class="stat led" id="credits" style="margin-top:6px">0</div><p class="muted small" id="creditNote">1 credit = 1 cent. Buying credits opens soon.</p></div>
</div>
<div class="panel" style="margin-top:16px"><h3 style="margin-bottom:14px">Settings</h3>
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

DOWNLOAD = """
<section class="hero" style="padding-bottom:10px"><div class="wrap">
<span class="label">Version 0.1.0</span>
<h1 style="margin-top:8px">Download Loopwright</h1>
<p class="lead">Install the desktop app, then sign in with your Loopwright account.</p>
</div></section>
<section style="padding-bottom:30px"><div class="wrap">
<div class="dl">
<div class="card"><span class="tag on">Recommended</span><h3>Mac with Apple chip</h3><p class="muted small">M1, M2, M3, M4 or newer. macOS 12 or later.</p><a class="btn primary" href="https://github.com/That1kid333/loopwright/releases/latest/download/Loopwright-mac-arm64.zip">Download for Apple chip</a><span class="muted small">115 MB · zip</span></div>
<div class="card"><span class="tag">Older Macs</span><h3>Mac with Intel chip</h3><p class="muted small">Intel Macs, macOS 12 or later.</p><a class="btn" href="https://github.com/That1kid333/loopwright/releases/latest/download/Loopwright-mac-x64.zip">Download for Intel</a><span class="muted small">120 MB · zip</span></div>
<div class="card"><span class="tag">Coming later</span><h3>Windows</h3><p class="muted small">The Windows version comes after the Mac one.</p><button class="btn" disabled>Not yet</button></div>
</div>
<p class="muted small" style="margin-top:14px">Not sure which Mac you have? Apple menu &gt; About This Mac. "Chip: Apple M…" means Apple chip.</p>

<div class="panel" style="margin-top:28px"><h3>First time opening it</h3>
<p class="muted" style="margin-top:6px">This early version isn't signed by Apple yet, so macOS asks you to confirm the first time.</p>
<ol class="howto">
<li>Open the zip in Downloads and drag <b style="color:var(--fg)">Loopwright</b> into Applications.</li>
<li>In Applications, right-click (or Control-click) Loopwright and choose <b style="color:var(--fg)">Open</b>, then <b style="color:var(--fg)">Open</b> again.</li>
<li>If macOS only offers Move to Trash, open System Settings &gt; Privacy &amp; Security, scroll down and click <b style="color:var(--fg)">Open Anyway</b>.</li>
<li>If it says the app "is damaged", open Terminal, paste this and press Return, then open the app again:</li>
</ol>
<pre>xattr -cr /Applications/Loopwright.app</pre>
</div>
</div></section>
"""
page("download", "Download · Loopwright", "Download the Loopwright desktop app for Mac.", DOWNLOAD, "download")
