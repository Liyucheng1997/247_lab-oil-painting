/**
 * 欧洲油画工坊 · AI 重演伴侣服务
 *
 * 零依赖 Node 服务：网页把油画图片发过来，本服务调用本地 Claude Code CLI
 * （走你自己的订阅额度），让模型"看"这幅画，按古典七步作画法输出
 * 一笔一笔的 NDJSON 笔触脚本，并以 SSE 流式转发回网页实时重演。
 *
 * 启动：node server.mjs        然后浏览器打开 http://127.0.0.1:4370
 */
import http from "node:http";
import { spawn, execFile } from "node:child_process";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 4370;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const KILL_AFTER_MS = 12 * 60 * 1000; // 单次生成最长 12 分钟

const DETAIL = {
  fast:     { strokes: 130, label: "快速" },
  standard: { strokes: 280, label: "标准" },
  fine:     { strokes: 500, label: "精细" },
};

const ALLOWED_MODELS = new Set([
  "claude-fable-5",
  "claude-opus-5",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
]);

function buildPrompt(imgPath, W, H, nStrokes) {
  return `You are a classical European oil painting master demonstrating, stroke by stroke, how the painting in the image file below would be painted from a blank canvas, following the traditional atelier "seven step" method.

First, use the Read tool to look carefully at this image file:
${imgPath}

Then output ONLY a stroke script in NDJSON format (one JSON object per line, no markdown fences, no commentary, no blank lines). The canvas coordinate system is ${W} wide and ${H} tall (x: 0..${W}, y: 0..${H}), matching the image exactly.

Line types:
1. First line (metadata):
{"t":"meta","bg":"#RRGGBB","title":"畫作標題(中文)"}
   bg = the toned-ground color (a muted earth tone that suits this painting, e.g. warm umber/ochre).
2. Stage announcement (before each group of strokes), in this exact order with these names:
{"t":"stage","name":"① 铺有色底","note":"一句话说明这阶段在做什么(中文)"}
   Stages: ① 铺有色底 → ② 起形 → ③ 单色底层画 → ④ 铺大色块 → ⑤ 塑造 → ⑥ 细节与高光 → ⑦ 罩染统一
3. Stroke:
{"t":"s","b":"flat","c":"#RRGGBB","s":40,"o":0.55,"p":[[x,y],[x,y],...]}
   b = brush type (a full Renaissance atelier kit):
     "wash"    huge thin soft-edged washes — toned ground, sky, background only
     "round"   soft round sable — contour lines, small forms, final details
     "flat"    flat bristle brush — blocking in planes of color
     "fan"     fan brush — foliage, hair strands, scattered texture
     "knife"   palette knife impasto — thick FINAL highlights only, sparingly
     "glaze"   transparent glaze — deepening shadows, unifying color regions
     "sfumato" Leonardo's smoky blending — flesh transitions, soft edges between light and shadow; use generously on figures and faces
     "scumble" dry-brush broken texture — rocks, fabric, clouds, mist
     "blend"   blender — softening an already-painted edge
   c = paint color hex, s = brush size in canvas px (80-160 wash only; 25-60 blocking; 10-25 modeling; 3-10 details), o = opacity 0.05-1, p = path polyline of 2-12 points, gently curved and natural.
4. Last line: {"t":"end"}

Painting rules — follow them like a real Renaissance master:
- Total strokes: about ${nStrokes} (within ±15%). Budget roughly: stage① 4-8 wash strokes covering all, ② ~10% thin round lines, ③ ~15% flat/round monochrome + a few sfumato, ④ ~25% flat blocks, ⑤ ~25% modeling with flat/round/sfumato/scumble, ⑥ ~20% small round + a few knife highlights, ⑦ 3-6 large glaze strokes.
- STROKES FOLLOW THE FORM: curve each path along anatomy, drapery folds, and contours of what you are painting. Short overlapping strokes (each path spanning less than 1/3 of the canvas) build form; NEVER drag one long wide band across a whole figure.
- Build flesh in soft layers: warm halftones at o≈0.45-0.65, then sfumato strokes across every light-shadow boundary, tiny bright highlights last.
- Prefer opacity 0.4-0.7 during block-in and modeling so layers blend optically; reserve o>0.85 for stage ⑥ highlights only.
- Work large → small, dark → light, thin → thick (fat over lean). Background before foreground.
- Each stroke's color must match the LOCAL color of the original painting at that stroke's location; stage ② uses thin dark burnt umber (#3a2a1a-ish) lines; stage ③ is monochrome browns establishing values.
- COVER THE WHOLE CANVAS: by the end of stage ④ every region (background included) must be painted over — no bare ground showing anywhere. Then refine on top.
- Coordinates are integers. Keep every JSON object on a single line. Output nothing except NDJSON lines.`;
}

/* ---------- 静态文件 ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8" };
async function serveStatic(req, res) {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, path.normalize(p).replace(/^([.][.][\\/])+/, ""));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
  }
}

/* ---------- SSE 帮助 ---------- */
function sseHead(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });
}
function sseSend(res, obj) { res.write(`data: ${JSON.stringify(obj)}\n\n`); }

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
  } else {
    try { child.kill("SIGTERM"); } catch {}
  }
}

/* ---------- /api/replay ---------- */
async function handleReplay(req, res) {
  let body = "";
  for await (const chunk of req) body += chunk;
  let payload;
  try { payload = JSON.parse(body); } catch { res.writeHead(400).end("bad json"); return; }

  const { image, model, detail, w, h } = payload;
  if (!image || !/^data:image\/(png|jpeg);base64,/.test(image)) { res.writeHead(400).end("bad image"); return; }
  if (!ALLOWED_MODELS.has(model)) { res.writeHead(400).end("bad model"); return; }
  const W = Math.max(64, Math.min(1400, Math.round(+w || 1000)));
  const H = Math.max(64, Math.min(1400, Math.round(+h || 750)));
  const nStrokes = (DETAIL[detail] || DETAIL.standard).strokes;

  const ext = image.startsWith("data:image/png") ? "png" : "jpg";
  const imgPath = path.join(tmpdir(), `atelier_replay_${Date.now()}.${ext}`);
  await writeFile(imgPath, Buffer.from(image.split(",")[1], "base64"));

  sseHead(res);
  sseSend(res, { t: "sys", phase: "starting", model });

  const args = [
    "-p",
    "--model", model,
    "--output-format", "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--allowedTools", "Read",
    "--disallowedTools", "Bash,Write,Edit,WebFetch,WebSearch,Glob,Grep,Task",
    "--max-turns", "20",
  ];
  const child = spawn("claude", args, { shell: process.platform === "win32", cwd: tmpdir() });
  child.stdin.write(buildPrompt(imgPath, W, H, nStrokes));
  child.stdin.end();

  let textBuf = "";      // 模型输出的笔触脚本累积缓冲
  let stdoutBuf = "";    // stream-json 行缓冲
  let seenDelta = false;
  let sentStrokes = 0;
  let closed = false;
  const t0 = Date.now();

  const heartbeat = setInterval(() => { try { res.write(": hb\n\n"); } catch {} }, 15000);
  const killer = setTimeout(() => { sseSend(res, { t: "error", msg: "生成超时（12 分钟），已停止" }); killTree(child); }, KILL_AFTER_MS);

  function feedText(txt) {
    textBuf += txt;
    let nl;
    while ((nl = textBuf.indexOf("\n")) >= 0) {
      const line = textBuf.slice(0, nl).trim();
      textBuf = textBuf.slice(nl + 1);
      emitLine(line);
    }
  }
  function emitLine(line) {
    if (!line || line.startsWith("```")) return;
    let obj;
    try { obj = JSON.parse(line); } catch { return; }
    if (!obj || typeof obj !== "object") return;
    if (obj.t === "s" || obj.t === "stage" || obj.t === "meta" || obj.t === "end") {
      if (obj.t === "s") sentStrokes++;
      sseSend(res, obj);
    }
  }

  child.stdout.on("data", (d) => {
    stdoutBuf += d.toString();
    let nl;
    while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === "stream_event" && ev.event?.type === "content_block_delta" && ev.event.delta?.type === "text_delta") {
        seenDelta = true;
        feedText(ev.event.delta.text);
      } else if (ev.type === "assistant" && !seenDelta) {
        // 兜底：没有增量事件时用整条消息
        for (const blk of ev.message?.content || []) {
          if (blk.type === "text") feedText(blk.text + "\n");
        }
      } else if (ev.type === "stream_event" && ev.event?.type === "content_block_start" && ev.event.content_block?.type === "tool_use") {
        sseSend(res, { t: "sys", phase: "looking" });
      } else if (ev.type === "system" && ev.subtype === "init") {
        sseSend(res, { t: "sys", phase: "connected", model: ev.model });
      } else if (ev.type === "result") {
        if (ev.is_error) sseSend(res, { t: "error", msg: String(ev.result || ev.subtype || "生成失败").slice(0, 400) });
      }
    }
  });

  let errBuf = "";
  child.stderr.on("data", (d) => { errBuf = (errBuf + d.toString()).slice(-2000); });

  child.on("close", (code) => {
    clearInterval(heartbeat);
    clearTimeout(killer);
    if (textBuf.trim()) emitLine(textBuf.trim());
    if (!closed) {
      if (code !== 0 && sentStrokes === 0) {
        sseSend(res, { t: "error", msg: `Claude CLI 退出（code ${code}）：${errBuf.trim().slice(-300) || "未知错误"}` });
      }
      sseSend(res, { t: "done", strokes: sentStrokes, seconds: Math.round((Date.now() - t0) / 1000) });
      res.end();
    }
    unlink(imgPath).catch(() => {});
  });
  child.on("error", (err) => {
    clearInterval(heartbeat);
    clearTimeout(killer);
    if (!closed) {
      sseSend(res, { t: "error", msg: `无法启动 claude 命令：${err.message}。请确认已安装 Claude Code CLI 并已登录。` });
      res.end();
    }
  });

  req.on("close", () => { closed = true; killTree(child); });
}

/* ---------- 服务器 ---------- */
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }).end();
    return;
  }
  if (req.url.startsWith("/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/api/replay")) { handleReplay(req, res); return; }
  serveStatic(req, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`🎨 欧洲油画工坊伴侣服务已启动： http://127.0.0.1:${PORT}`);
  console.log(`   在浏览器打开上面的地址，进入「🤖 AI 重演」页签即可。`);
});
