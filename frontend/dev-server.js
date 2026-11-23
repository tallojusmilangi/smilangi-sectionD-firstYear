const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/config.js") {
    const apiBaseUrl = (process.env.API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
    response.writeHead(200, { "Content-Type": contentTypes[".js"] });
    response.end(`window.CAMPUS_CONFIG = ${JSON.stringify({ apiBaseUrl })};\n`);
    return;
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  });
}).listen(Number(process.env.PORT || 3000), "0.0.0.0", () => {
  console.log(`Campus Connect frontend running on http://localhost:${process.env.PORT || 3000}`);
});
