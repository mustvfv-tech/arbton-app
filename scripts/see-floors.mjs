// see.tg /v1/floors → _out/see.json (المجموعات) و _out/see/m/<اسم>.json (النماذج)
// MODE=cols (طلب واحد) | MODE=models (حتى 14 صفحة). بيوقف لما الطلبات المجانية تخلص (مفيش صرف فلوس).
import fs from "node:fs";
const T = process.env.SEE_TOKEN, OUT = process.env.OUT_DIR || "_out", MODE = process.env.MODE || "cols";
if (!T) { console.log("SEE_TOKEN missing"); process.exit(0); }
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r1 = n => n == null ? null : Math.round(n * 100) / 100;
let free = 99;
async function get(q) {
  if (free <= 0) { console.log("free quota used up — stop"); return null; }
  const r = await fetch("https://kartoshka.free/v1/floors?" + q, { headers: { Authorization: "Bearer " + T } });
  const f = r.headers.get("x-free-remaining"); if (f != null) free = +f;
  console.log("GET", q, r.status, "free-left", f, "cost", r.headers.get("x-request-cost"));
  if (!r.ok) return null;
  const j = await r.json(); await sleep(1200);
  return j && j.ok ? j.result : null;
}
const mkOf = (x, price) => Object.fromEntries((x.markets || []).map(m => [m.market, price ? m.floorTon : [m.floorTon, m.listings]]));
fs.mkdirSync(OUT + "/see/m", { recursive: true });
if (MODE === "cols") {
  const res = await get("by=collection&limit=500");
  if (!res) process.exit(0);
  const cols = {};
  for (const x of res.items || []) cols[norm(x.title)] = { n: x.title, i: x.issued, t: x.total, f: r1(x.floorTon), m: x.floorMarket, c1: r1(x.change24h), c7: r1(x.change7d), c30: r1(x.change30d), mk: mkOf(x) };
  fs.writeFileSync(OUT + "/see.json", JSON.stringify({ u: Math.floor(Date.now() / 1000), cols }));
  console.log("collections:", Object.keys(cols).length);
} else {
  const by = {}; let off = 0, total = 1, pages = 0, got = 0;
  while (off < total && pages < 14) {
    const res = await get("by=model&limit=500&offset=" + off); if (!res) break;
    total = res.totalCount || 0; pages++;
    const items = res.items || []; if (!items.length) break;
    for (const x of items) {
      (by[norm(x.title)] ||= {})[x.key] = { p: r1(x.floorTon), m: x.floorMarket, r: x.rarityPermille ?? null, a: r1(x.actualPermille), c1: r1(x.change24h), c7: r1(x.change7d), c30: r1(x.change30d), mk: mkOf(x, true) };
      got++;
    }
    off += items.length;
  }
  const u = Math.floor(Date.now() / 1000);
  for (const [k, m] of Object.entries(by)) {
    const file = OUT + "/see/m/" + k + ".json";
    let old = {}; try { old = JSON.parse(fs.readFileSync(file, "utf8")).m || {}; } catch {}
    fs.writeFileSync(file, JSON.stringify({ u, m: { ...old, ...m } }));
  }
  console.log("models:", got, "of", total, "collections:", Object.keys(by).length);
}
