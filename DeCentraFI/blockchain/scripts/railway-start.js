/**
 * HTTP server for Railway: listens on PORT, serves /health for Railway healthchecks.
 */
const http = require("http");

const port = Number(process.env.PORT) || 3000;

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const path = req.url?.split("?")[0] || "/";

  if (path === "/health") {
    sendJson(res, 200, { ok: true, service: "decentrafi-blockchain" });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(
    "DecentraFI blockchain (Hardhat). Build: npm run build. Deploy: npm run deploy:sepolia or deploy:mainnet. Health: GET /health\n"
  );
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${port} (GET /health for Railway)`);
});
