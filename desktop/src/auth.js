/* Desktop sign-in: same Supabase project and publishable key as the website. */
window.LWA = (function () {
  var sb = window.supabase.createClient(
    "https://vvllgdrpnieorcpweurz.supabase.co",
    "sb_publishable_6iCD4SBhUOXgOoyyIT3qZA__dTbzZZF",
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "loopwright-desktop-auth" } }
  );
  async function user() { var r = await sb.auth.getSession(); return r.data.session && r.data.session.user; }
  return {
    sb: sb, user: user,
    requireUser: async function () { var u = await user(); if (!u) location.replace("signin.html"); return u; },
    signOut: async function () { await sb.auth.signOut(); location.replace("signin.html"); }
  };
})();
