const { app, BrowserWindow, shell, Menu, session, systemPreferences, protocol, net, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

// The app's pages are served from app://loopwright/ (a secure, standard origin) instead of file://,
// so fetch, Cache Storage (the free sound library) and saved sign-in behave as they do on the website.
const ORIGIN = "app://loopwright";
const SRC = path.join(__dirname, "src");
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const isApp = (u) => typeof u === "string" && (u === ORIGIN || u.startsWith(ORIGIN + "/"));

const SITE = "https://loopwright-studio.netlify.app";

// A plain log file for diagnosis: Help > Open log file. Holds page errors, load failures and crashes,
// never sign-in details or anything the user types.
let LOG = null;
function logLine(...parts) {
  try {
    if (!LOG) { LOG = path.join(app.getPath("logs"), "loopwright.log"); fs.mkdirSync(path.dirname(LOG), { recursive: true });
      try { if (fs.statSync(LOG).size > 2e6) fs.renameSync(LOG, LOG + ".old"); } catch (e) {} }
    fs.appendFileSync(LOG, new Date().toISOString() + " " + parts.map(String).join(" ").slice(0, 2000) + "\n");
  } catch (e) {}
}
process.on("uncaughtException", (e) => logLine("main error", e && e.stack || e));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    backgroundColor: "#0b0d10", title: "Loopwright",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  logLine("start", app.getVersion(), process.platform, process.arch, "electron", process.versions.electron, "os", process.getSystemVersion());
  win.loadURL(ORIGIN + "/signin.html");
  const wc = win.webContents;
  wc.on("console-message", (e) => { if (e.level === "error" || e.level === "warning") logLine("page", e.level, (e.sourceId || "").replace(ORIGIN, "") + ":" + e.lineNumber, e.message); });
  wc.on("did-fail-load", (_e, code, desc, url, main) => { if (main) logLine("load failed", code, desc, url); });
  wc.on("did-finish-load", () => logLine("loaded", wc.getURL()));
  wc.on("preload-error", (_e, p, err) => logLine("preload error", p, err && err.stack));
  wc.on("render-process-gone", (_e, d) => {
    logLine("page crashed", d.reason, d.exitCode);
    dialog.showMessageBox(win, { type: "error", message: "Loopwright's window stopped working.", detail: "It will reload now. If this keeps happening, use Help > Open log file and send us what it shows.", buttons: ["Reload"] })
      .then(() => { if (!win.isDestroyed()) win.loadURL(ORIGIN + "/signin.html"); });
  });
  let asking = false;
  win.on("unresponsive", () => {
    logLine("window not responding", wc.getURL()); if (asking) return; asking = true;
    dialog.showMessageBox(win, { type: "warning", message: "Loopwright isn't responding.", detail: "You can wait a little longer, or reload the window. Your song is saved to your account every few seconds.", buttons: ["Reload", "Keep waiting"], defaultId: 0, cancelId: 1 })
      .then((r) => { asking = false; if (r.response === 0 && !win.isDestroyed()) wc.reloadIgnoringCache(); });
  });
  win.on("responsive", () => logLine("window responding again"));

  // Links to the website (sign up, account, forgot password) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!isApp(url)) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); }
  });
  // Exports: ask where to save (default Downloads).
  win.webContents.session.on("will-download", (_e, item) => {
    item.setSaveDialogOptions({ title: "Save your track", defaultPath: path.join(app.getPath("downloads"), item.getFilename()) });
  });
}

const template = [
  ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
  { role: "fileMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" },
  { role: "help", submenu: [
    { label: "Open log file", click: () => { logLine("log opened"); shell.openPath(LOG || path.join(app.getPath("logs"), "loopwright.log")); } },
    { label: "Show developer tools", click: (_m, w) => { if (w) w.webContents.toggleDevTools(); } },
    { type: "separator" },
    { label: "Loopwright website", click: () => shell.openExternal(SITE) },
    { label: "Your account", click: () => shell.openExternal(SITE + "/account/") }
  ] }
];

app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    const u = new URL(req.url);
    if (u.host !== "loopwright") return new Response("Not found", { status: 404 });
    const file = path.normalize(path.join(SRC, decodeURIComponent(u.pathname)));
    if (file !== SRC && !file.startsWith(SRC + path.sep)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // Recording: allow the studio (the app's own pages only) to use the mic / audio input and MIDI.
  const allowed = new Set(["media", "midi", "midiSysex", "audioCapture"]);
  // Only local app pages ever load (outside links open in the browser), so the set below is the whole rule.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    if (!allowed.has(permission) || !isApp(details.requestingUrl || wc.getURL())) return cb(false);
    if (permission === "media" && process.platform === "darwin" && (details.mediaTypes || []).includes("audio")) {
      systemPreferences.askForMediaAccess("microphone").then(cb, () => cb(false));
    } else cb(true);
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => allowed.has(permission) && isApp(origin));
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
