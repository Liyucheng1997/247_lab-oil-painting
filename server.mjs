/**
 * 欧洲油画工坊 · 本地静态服务（可选）
 *
 * 零依赖 Node 服务，只负责把项目目录当静态网站提供出来。
 * 网页本身可以直接双击 index.html 打开；AI 重演由网页直接调用 Anthropic API，
 * 不再需要本服务。
 *
 * 启动：node server.mjs        然后浏览器打开 http://127.0.0.1:4370
 */
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 4370;
const ROOT = path.dirname(fileURLToPath(import.meta.url));

const MIME = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8" };
async function serveStatic(req, res) {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, path.normalize(decodeURIComponent(p)).replace(/^([.][.][\/])+/, ""));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
  }
}

http.createServer(serveStatic).listen(PORT, "127.0.0.1", () => {
  console.log(`🎨 欧洲油画工坊已启动： http://127.0.0.1:${PORT}`);
});
