// أسهم: أسعار + قيمة سوقية من Finnhub (مفتاح مجاني)، وتاريخ يومي من Stooq (مجاني) — بيتحفظ في _out/stocks.json و _out/stocks/h/<SYM>.json
// MODE=quotes (افتراضي) | hist (بيجيب التاريخ كمان)
import fs from "node:fs";
const KEY = process.env.FINNHUB_KEY, OUT = process.env.OUT_DIR || "_out", MODE = process.env.MODE || "quotes";
if (!KEY) { console.log("FINNHUB_KEY missing"); process.exit(0); }
const SYMS = "AAPL MSFT NVDA GOOGL AMZN META AVGO TSLA BRK.B LLY JPM V WMT XOM UNH MA ORCL COST PG JNJ HD NFLX BAC ABBV CVX KO CRM AMD TMUS MRK WFC CSCO PEP ADBE LIN ACN MCD NOW IBM ABT TMO GE DIS PM QCOM CAT INTU TXN ISRG VZ AXP AMGN GS BKNG MS SPGI RTX NEE T PFE LOW HON UBER BLK UNP AMAT PGR C COP DHR SYK ETN PANW TJX LMT BA ADP MU DE ANET GILD SBUX MDT INTC CB MMC PLD KKR ADI FI BMY LRCX CMG SHOP PLTR COIN MSTR PYPL SNOW UBER SPOT".split(" ").filter((x, i, a) => a.indexOf(x) === i);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
fs.mkdirSync(OUT + "/stocks/h", { recursive: true });
const profFile = OUT + "/stocks-profile.json", prof = rd(profFile, {}), now = Math.floor(Date.now() / 1000);
async function fh(path) {
  const r = await fetch("https://finnhub.io/api/v1" + path + "&token=" + KEY);
  if (r.status === 429) { console.log("429 — wait"); await sleep(15000); return null; }
  if (!r.ok) { console.log("HTTP", r.status, path.split("?")[0]); return null; }
  return r.json();
}
const file = s => OUT + "/stocks/h/" + s.replace(/[^A-Z0-9]/g, "") + ".json";
async function stooq(sym) { // CSV: Date,Open,High,Low,Close,Volume
  try {
    const r = await fetch("https://stooq.com/q/d/l/?i=d&s=" + sym.toLowerCase().replace(".", "-") + ".us", { headers: { "user-agent": "Mozilla/5.0" } });
    const txt = await r.text(); if (!r.ok || !/^Date,Open/i.test(txt)) return null;
    return txt.trim().split("\n").slice(1).map(l => { const c = l.split(","); return [Math.floor(Date.parse(c[0] + "T21:00:00Z") / 1000), +c[1], +c[2], +c[3], +c[4], +c[5] || 0]; }).filter(x => x[4] > 0).slice(-400);
  } catch { return null; }
}
const items = [];
for (const s of SYMS) {
  const q = await fh("/quote?symbol=" + encodeURIComponent(s)); await sleep(1100);
  if (!q || !(q.c > 0)) continue;
  let p = prof[s];
  if (!p || now - p.t > 7 * 86400) {
    const j = await fh("/stock/profile2?symbol=" + encodeURIComponent(s)); await sleep(1100);
    if (j && j.name) prof[s] = p = { t: now, n: j.name, logo: j.logo || "", mc: j.marketCapitalization || 0, ind: j.finnhubIndustry || "", ex: j.exchange || "" };
  }
  let h = rd(file(s), []);
  if (MODE === "hist" || !h.length) { const sh = await stooq(s); if (sh && sh.length) h = sh; if (MODE === "hist") await sleep(500); }
  // نحدّث شمعة اليوم من السعر الحالي (بيشتغل حتى لو Stooq مش متاح)
  const day = Math.floor((q.t || now) / 86400) * 86400 + 75600;
  const last = h[h.length - 1];
  if (last && Math.floor(last[0] / 86400) === Math.floor(day / 86400)) { last[2] = Math.max(last[2], q.h || q.c); last[3] = Math.min(last[3], q.l || q.c); last[4] = q.c; }
  else h.push([day, q.o || q.c, q.h || q.c, q.l || q.c, q.c, 0]);
  fs.writeFileSync(file(s), JSON.stringify(h.slice(-400)));
  const lv = h.length ? h[h.length - 1] : null, yr = h.slice(-252);
  items.push({ s, n: p ? p.n : s, logo: p ? p.logo : "", ind: p ? p.ind : "", mc: p ? p.mc * 1e6 : 0, p: q.c, c1: q.dp, pc: q.pc, o: q.o, h: q.h, l: q.l,
    v: (x => x ? Math.round(x[5] * q.c) : 0)([...h].reverse().find(r => r[5] > 0)), hi52: yr.length ? Math.max(...yr.map(x => x[2])) : q.h, lo52: yr.length ? Math.min(...yr.map(x => x[3])) : q.l });
}
fs.writeFileSync(profFile, JSON.stringify(prof));
if (items.length) fs.writeFileSync(OUT + "/stocks.json", JSON.stringify({ u: now, items }));
console.log("stocks:", items.length, "of", SYMS.length);
