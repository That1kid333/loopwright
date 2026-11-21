const { app, BrowserWindow, shell, Menu, session, systemPreferences, protocol, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

// The app's pages are served from app://loopwright/ (a secure, standard origin) instead of file://,
// so fetch, Cache Storage (the free sound library) and saved sign-in behave as they do on the website.
const ORIGIN = "app://loopwright";
const SRC = path.join(__dirname, "src");
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const isApp = (u) => typeof u === "string" && (u === ORIGIN || u.startsWith(ORIGIN + "/"));

const SITE = "https://loopwright-studio.netlify.app";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 900, minHeight: 600,
    backgroundColor: "#0b0d10", title: "Loopwright",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadURL(ORIGIN + "/signin.html");

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
