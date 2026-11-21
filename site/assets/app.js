/* Loopwright site: Supabase Auth with the project's publishable key only. */
window.LW = (function () {
  const URL = "https://vvllgdrpnieorcpweurz.supabase.co";
  const KEY = "sb_publishable_6iCD4SBhUOXgOoyyIT3qZA__dTbzZZF";
  const sb = window.supabase.createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
  });
  const $ = (id) => document.getElementById(id);
  function show(el, text, kind) { if (!el) return; el.hidden = !text; el.textContent = text || ""; el.className = "msg " + (kind || ""); }
  async function user() { const { data } = await sb.auth.getUser(); return data && data.user; }
  async function paintNav() {
    const slot = $("navAuth"); if (!slot) return;
    const u = await user();
    slot.innerHTML = u
      ? '<a class="btn sm" href="/account/">Account</a>'
      : '<a href="/signin/" class="hide-sm">Sign in</a> <a class="btn sm primary" href="/signin/?mode=signup">Get started</a>';
  }
  // Never call Supabase from inside this callback: supabase-js awaits it while holding
  // its auth lock, so an await on getUser() here deadlocks sign-in and every page after it.
  sb.auth.onAuthStateChange(() => { setTimeout(paintNav, 0); });
  document.addEventListener("DOMContentLoaded", paintNav);
  return { sb, $, show, user, site: location.origin };
})();
