// يسحب أقل سعر لكل كوليكشن في كل سوق من Gift Satellite ويحفظه في data/floors.json
// + يخزّن لقطات تاريخية (data/floors-history.json) عشان نعمل تغيّر 24 ساعة وشارت حقيقي.
import fs from "node:fs";

const BASE = (process.env.GS_BASE || "https://gift-satellite.dev/api").replace(/\/$/, "");
const TOKEN = process.env.GS_TOKEN;
const OUT = process.env.OUT_DIR || "data";
const FAST = !!process.env.GS_FAST; // للاختبار المحلي فقط
const MAX_POINTS = 400;             // ~8 أيام كل 30 دقيقة
if (!TOKEN) { console.error("GS_TOKEN غير موجود"); process.exit(1); }

// الفاصل بين الطلبات (ms) حسب حد كل سوق في التوثيق (tg: طلب كل 1.5 ث، الباقي 2/ث)
const GAP = { portals: 600, tonnel: 600, mrkt: 600, getgems: 600, tg: 1700 };
const sleep = ms => new Promise(r => setTimeout(r, FAST ? 2 : ms));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function get(path, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + path, { headers: { Authorization: "Token " + TOKEN, accept: "application/json" } });
      if (r.status === 401 || r.status === 403) { const e = new Error("AUTH " + r.status); e.fatal = true; throw e; }
      if (r.status === 429 || r.status >= 500) throw new Error("HTTP " + r.status);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.json();
    } catch (e) {
      if (e.fatal) throw e;
      last = e; await sleep(2000 * (i + 1));
    }
  }
  throw last;
}
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };

const prev = readJSON(OUT + "/floors.json", { collections: {} });
let cols;
try { cols = await get("/gift/collections"); }
catch (e) { console.error(e.fatal ? "المفتاح GS_TOKEN مرفوض (401/403) — راجع الـ Secret" : "فشل جلب الكوليكشنز: " + e.message); process.exit(1); }
const names = (Array.isArray(cols) ? cols : []).map(c => c && c.name).filter(Boolean);
if (names.length < 20) { console.error("قائمة الكوليكشنز غير متوقعة:", names.length); process.exit(1); }
console.log("collections:", names.length);

const found = {};   // found[name][market] = {p,n,s} | null
let calls = 0, errors = 0;
async function runMarket(m) {
  for (const name of names) {
    const t0 = Date.now(); calls++;
    try {
      const a = await get(`/search/${m}/${encodeURIComponent(name)}`);
      const arr = (Array.isArray(a) ? a : []).filter(x => x && num(x.normalizedPrice) > 0);
      let best = null;
      for (const x of arr) if (!best || x.normalizedPrice < best.normalizedPrice) best = x;
      (found[name] ||= {})[m] = best
        ? { p: Math.round(best.normalizedPrice * 1000) / 1000, n: arr.length, s: best.slug || null }
        : null;
    } catch (e) {
      if (e.fatal) throw e;
      errors++;
      const old = prev.collections[name] && prev.collections[name].markets && prev.collections[name].markets[m];
      (found[name] ||= {})[m] = old === undefined ? null : old; // نحتفظ بآخر قيمة لو فشل الطلب
    }
    await sleep(Math.max(0, GAP[m] - (Date.now() - t0)));
  }
}
try { await Promise.all(Object.keys(GAP).map(runMarket)); }
catch (e) { console.error("توقف:", e.message); process.exit(1); }

console.log(`calls=${calls} errors=${errors}`);
if (errors > calls * 0.3) { console.error("أخطاء كتير، مش هستبدل الملف القديم"); process.exit(1); }

const collections = {};
for (const name of names) {
  const mk = {}; let floor = null, market = null;
  for (const m of Object.keys(GAP)) {
    const v = found[name] && found[name][m];
    if (v) { mk[m] = v; if (floor == null || v.p < floor) { floor = v.p; market = m; } }
  }
  collections[name] = { floor, market, markets: mk };
}
const now = Math.floor(Date.now() / 1000);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT + "/floors.json", JSON.stringify({ updated: now, source: "Gift Satellite", count: names.length, collections }));

// لقطات تاريخية (أعمدة: t + مصفوفة أسعار لكل اسم)
const h = readJSON(OUT + "/floors-history.json", { t: [], c: {} });
h.t.push(now);
for (const name of new Set([...names, ...Object.keys(h.c)])) {
  const arr = h.c[name] || (h.c[name] = new Array(h.t.length - 1).fill(null));
  arr.push(collections[name] ? collections[name].floor : null);
}
if (h.t.length > MAX_POINTS) { const k = h.t.length - MAX_POINTS; h.t = h.t.slice(k); for (const n in h.c) h.c[n] = h.c[n].slice(k); }
for (const n in h.c) if (h.c[n].every(v => v == null)) delete h.c[n];
fs.writeFileSync(OUT + "/floors-history.json", JSON.stringify(h));
const withFloor = Object.values(collections).filter(c => c.floor != null).length;
console.log(`done: ${withFloor}/${names.length} collections have a floor`);
