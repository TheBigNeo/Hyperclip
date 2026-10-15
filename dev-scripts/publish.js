// Copies the files referenced by manifest.json into ./publish (clean build).
// New site scripts or styles only need an entry in the manifest, not in this file.
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT_DIR, "publish");

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "manifest.json"), "utf8"));

function collectFiles(manifest) {
  const files = new Set(["manifest.json"]);
  const add = (...list) => list.flat().forEach((file) => file && files.add(file));
  const icons = (value) => (typeof value === "string" ? [value] : Object.values(value || {}));

  add(icons(manifest.icons));
  if (manifest.action) add(icons(manifest.action.default_icon), manifest.action.default_popup);
  if (manifest.background) add(manifest.background.service_worker);
  add(manifest.options_page, manifest.options_ui && manifest.options_ui.page);
  for (const script of manifest.content_scripts || []) add(script.js || [], script.css || []);

  return [...files];
}

const files = collectFiles(manifest);

// Check first, so a broken manifest does not wipe the previous build
const missing = files.filter((file) => !fs.existsSync(path.join(ROOT_DIR, file)));
if (missing.length) {
  console.error(`manifest.json references missing files:\n${missing.map((file) => `  ${file}`).join("\n")}`);
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const file of files) {
  fs.mkdirSync(path.dirname(path.join(OUT_DIR, file)), { recursive: true });
  fs.copyFileSync(path.join(ROOT_DIR, file), path.join(OUT_DIR, file));
  console.log(`copied ${file}`);
}

console.log(`Done: ${OUT_DIR}`);
