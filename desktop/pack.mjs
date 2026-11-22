import { packager } from "@electron/packager";
import { readFileSync } from "node:fs";
const [,, appDir, outDir, zipDir, icon] = process.argv;
const { version } = JSON.parse(readFileSync(appDir + "/package.json", "utf8"));
for (const arch of ["arm64", "x64"]) {
  const paths = await packager({
    dir: appDir, out: outDir, platform: "darwin", arch, electronVersion: "43.8.12",
    electronZipDir: zipDir, icon, name: "Loopwright", appBundleId: "app.loopwright.desktop",
    appCategoryType: "public.app-category.music", appVersion: version, buildVersion: "11",
    asar: true, overwrite: true, prune: false, ignore: [/^\/node_modules($|\/)/, /^\/package-lock\.json$/, /^\/\.pack\.mjs$/],
    extendInfo: { NSMicrophoneUsageDescription: "Loopwright uses the microphone only when you record a sound." }
  });
  console.log(arch, paths);
}
