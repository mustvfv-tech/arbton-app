// يبني ملفات الملخص من بيانات المبيعات والفلور الموجودة (من غير أي طلب شبكة):
//   top.json  = الأكثر مبيعًا + إحصائيات السوق (24 ساعة)
//   opps.json = الفرص (فلور أقل من متوسط المبيعات) + أرقام كل كوليكشن (للتنبيهات)
import fs from "node:fs";
const OUT = process.env.OUT_DIR || "data";
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const r2 = n => Math.round(n * 100) / 100;
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const now = Math.floor(Date.now() / 1000), D1 = now - 86400, D2 = now - 2 * 86400, D7 = now - 7 * 86400;
const fl = rd(OUT + "/floors.json", { collections: {} }).collections || {};
let files = []; try { files = fs.readdirSync(OUT + "/sales"); } catch {}
const gifts = [], models = {}, cols = {}, items = [], byM = {};
let n1 = 0, v1 = 0, n0 = 0, v0 = 0;
const med = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

for (const f of files) {
  const d = rd(OUT + "/sales/" + f, null); if (!d || !d.s || !d.n) continue;
  const name = d.n, c = fl[name] || fl[Object.keys(fl).find(k => norm(k) === norm(name))] || null;
  let c1 = 0, vv1 = 0; const w7 = [], perModel = {};
  for (const r of d.s) {
    const ts = r[0], p = r[1];
    if (ts >= D1) { c1++; vv1 += p; n1++; v1 += p; const m = byM[r[2]] ||= { n: 0, v: 0 }; m.n++; m.v += p; }
    else if (ts >= D2) { n0++; v0 += p; }
    if (ts >= D7) { w7.push(p); if (r[4]) (perModel[r[4]] ||= []).push(p); }
    if (ts >= D1 && r[4]) { const k = name + "|" + r[4], m = models[k] ||= { n: name, m: r[4], c: 0, v: 0 }; m.c++; m.v += p; }
  }
  if (c1) gifts.push({ n: name, c: c1, v: r2(vv1) });
  const avg7 = w7.length ? w7.reduce((a, b) => a + b, 0) / w7.length : null;
  const floor = c && c.floor > 0 ? c.floor : null;
  const disc = avg7 && floor ? r2((avg7 - floor) / avg7 * 100) : null;
  cols[name] = { c1, v1: r2(vv1), c7: w7.length, avg7: avg7 ? r2(avg7) : null, disc };
  const last = d.s[0] ? d.s[0][1] : null;
  if (floor && w7.length >= 3 && disc != null) items.push({ n: name, m: null, f: floor, mk: c.market, avg: r2(avg7), med: r2(med(w7)), last, c7: w7.length, d: disc });
  if (c && c.models) for (const [mn, mv] of Object.entries(c.models)) {
    const a = perModel[mn]; if (!a || a.length < 2 || !(mv.p > 0)) continue;
    const av = a.reduce((x, y) => x + y, 0) / a.length, row = d.s.find(r => r[4] === mn);
    items.push({ n: name, m: mn, f: mv.p, mk: mv.m, avg: r2(av), med: r2(med(a)), last: row ? row[1] : null, c7: a.length, d: r2((av - mv.p) / av * 100) });
  }
}
const by = (a, b) => b.c - a.c || b.v - a.v;
fs.writeFileSync(OUT + "/top.json", JSON.stringify({
  u: now, gifts: gifts.sort(by).slice(0, 20),
  models: Object.values(models).sort(by).slice(0, 20).map(m => ({ ...m, v: r2(m.v) })),
  stats: { d1: { n: n1, v: r2(v1) }, prev: { n: n0, v: r2(v0) }, byMarket: Object.fromEntries(Object.entries(byM).map(([k, v]) => [k, { n: v.n, v: r2(v.v) }])) }
}));
items.sort((a, b) => b.d - a.d);
fs.writeFileSync(OUT + "/opps.json", JSON.stringify({ u: now, items: items.slice(0, 150), cols }));
console.log(`summary: gifts=${gifts.length} models=${Object.keys(models).length} opps=${items.length} cols=${Object.keys(cols).length}`);
