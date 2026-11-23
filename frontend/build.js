const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const output = path.join(root, "dist");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

const apiBaseUrl = (process.env.API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
fs.writeFileSync(
  path.join(output, "config.js"),
  `window.CAMPUS_CONFIG = ${JSON.stringify({ apiBaseUrl })};\n`,
);
