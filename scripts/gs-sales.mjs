// يسحب سجل المبيعات الحقيقية لكل كوليكشن من Gift Satellite (POST /history/:collection)
// ويحفظه في data/sales/<name>.json (بيتراكم مع الوقت لحد 800 عملية لكل كوليكشن).
import fs from "node:fs";

const BASE = (process.env.GS_BASE || "https://gift-satellite.dev/api").replace(/\/$/, "");
const TOKEN = process.env.GS_TOKEN;
const OUT = process.env.OUT_DIR || "data";
const FAST = !!process.env.GS_FAST;
const MAX_PAGES = 10;      // 10 صفحات × 20 = آخر 200 عملية في كل تشغيل
const KEEP = 800;          // أقصى عدد عمليات محفوظة لكل كوليكشن
if (!TOKEN) { console.error("GS_TOKEN غير موجود"); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, FAST ? 2 : ms));
const norm = x => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const toSec = v => {
  if (v == null) return null;
  if (typeof v === "number") return Math.floor(v > 1e12 ? v / 1000 : v);
  const n = Number(v); if (Number.isFinite(n) && n > 1e8) return Math.floor(n > 1e12 ? n / 1000 : n);
  const d = Date.parse(v); return Number.isFinite(d) ? Math.floor(d / 1000) : null;
};

async function call(path, opt = {}, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + path, { ...opt, headers: { Authorization: "Token " + TOKEN, accept: "application/json", "content-type": "application/json" } });
      if (r.status === 401 || r.status === 403) { const e = new Error("AUTH " + r.status); e.fatal = true; throw e; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) { if (e.fatal) throw e; last = e; await sleep(2500 * (i + 1)); }
  }
  throw last;
}

let cols;
try { cols = await call("/gift/collections"); }
catch (e) { console.error(e.fatal ? "المفتاح GS_TOKEN مرفوض — راجع الـ Secret" : "فشل جلب الكوليكشنز: " + e.message); process.exit(1); }
const names = (Array.isArray(cols) ? cols : []).map(c => c && c.name).filter(Boolean);
// مجموعات إضافية يدوية (extra-collections.json) لو لسه مش في قائمة Gift Satellite — بتتضاف لو مش موجودة
try { const extra = JSON.parse(fs.readFileSync("extra-collections.json", "utf8")), have = new Set(names.map(x => String(x).toLowerCase().replace(/[^a-z0-9]/g, ""))); for (const x of extra) { const k = String(x).toLowerCase().replace(/[^a-z0-9]/g, ""); if (x && !have.has(k)) { names.push(String(x)); have.add(k); console.log("extra collection:", x); } } } catch {}
if (names.length < 20) { console.error("قائمة غير متوقعة:", names.length); process.exit(1); }
fs.mkdirSync(OUT + "/sales", { recursive: true });
const now = Math.floor(Date.now() / 1000);
let ok = 0, fail = 0, newSales = 0, shapeLogged = false;

for (const name of names) {
  try {
    const got = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const j = await call("/history/" + encodeURIComponent(name), { method: "POST", body: JSON.stringify({ sortBy: "date", page, pageSize: 20 }) });
      const arr = Array.isArray(j) ? j : (j && (j.content || j.items || j.data)) || [];
      if (!shapeLogged) { shapeLogged = true; console.log("sample:", JSON.stringify(arr[0] || j).slice(0, 300)); }
      got.push(...arr);
      const totalPages = j && j.page && j.page.totalPages;
      await sleep(600);
      if (!arr.length || (totalPages != null && page + 1 >= totalPages)) break;
    }
    const f = OUT + "/sales/" + norm(name) + ".json";
    const old = readJSON(f, { s: [] });
    const seen = new Set(old.s.map(x => x[7] + "|" + x[0]));
    const fresh = [];
    for (const x of got) {
      const ts = toSec(x.soldAt), price = Number(x.normalizedPrice);
      if (!ts || !(price > 0)) continue;
      const key = (x.slug || "") + "|" + ts;
      if (seen.has(key)) continue; seen.add(key);
      fresh.push([ts, Math.round(price * 1000) / 1000, x.market || "", x.number == null ? null : x.number, x.modelName || "", x.backdropName || "", x.symbolName || "", x.slug || ""]);
    }
    const all = fresh.concat(old.s).sort((a, b) => b[0] - a[0]).slice(0, KEEP);
    fs.writeFileSync(f, JSON.stringify({ n: name, u: now, s: all }));
    newSales += fresh.length; ok++;
  } catch (e) {
    if (e.fatal) { console.error("توقف:", e.message); process.exit(1); }
    fail++; console.log("skip", name, e.message);
  }
}
console.log(`done: ok=${ok} fail=${fail} new=${newSales}`);
if (fail > names.length * 0.3) process.exit(1);

