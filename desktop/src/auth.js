/* Desktop sign-in: same Supabase project and publishable key as the website.
   The app has no guest mode: every page but signin.html needs a signed-in Loopwright account. */
window.LWA = (function () {
  var sb = window.supabase.createClient(
    "https://vvllgdrpnieorcpweurz.supabase.co",
    "sb_publishable_6iCD4SBhUOXgOoyyIT3qZA__dTbzZZF",
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "loopwright-desktop-auth" } }
  );
  async function user() { var r = await sb.auth.getSession(); return r.data.session && r.data.session.user; }
  // Ask the server too, so a deleted or signed-out account can't keep using the app.
  // A network failure (offline) keeps the saved session; only a definite "no" signs out.
  async function verify() {
    try { var r = await sb.auth.getUser(); if (r.error && r.error.status && r.error.status >= 400 && r.error.status < 500) return false; } catch (e) {}
    return true;
  }
  async function signOut() { try { await sb.auth.signOut(); } catch (e) {} location.replace("signin.html"); }
  return {
    sb: sb, user: user, verify: verify, signOut: signOut,
    requireUser: async function () {
      var u = await user();
      if (!u) { location.replace("signin.html"); return null; }
      verify().then(function (ok) { if (!ok) signOut(); });
      return u;
    }
  };
})();
