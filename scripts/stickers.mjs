// استيكرات: Ethereum عبر OpenSea API، و TON عبر TonAPI → _out/stickers.json و _out/stickers/<id>.json
// مفاتيح اختيارية: OPENSEA_KEY (لو مش موجود بيطلب مفتاح مجاني فوري)، TONAPI_KEY
import fs from "node:fs";
const OUT = process.env.OUT_DIR || "_out", cfg = JSON.parse(fs.readFileSync(process.env.CFG || "stickers.config.json", "utf8"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const now = Math.floor(Date.now() / 1000);
fs.mkdirSync(OUT + "/stickers", { recursive: true });
const sfile = id => OUT + "/stickers/" + id.replace(/[^A-Za-z0-9_-]/g, "") + ".json";
const num = x => (x == null || x === "" || isNaN(+x)) ? null : +x;
let OSKEY = process.env.OPENSEA_KEY || "";
async function osKey() {
  if (OSKEY) return OSKEY;
  try { const r = await fetch("https://api.opensea.io/api/v2/auth/keys", { method: "POST" }); const j = await r.json(); OSKEY = j.api_key || j.key || ""; } catch {}
  console.log("opensea key:", OSKEY ? "ok" : "missing"); return OSKEY;
}
async function get(url, headers) {
  for (let i = 0; i < 2; i++) {
    const r = await fetch(url, { headers: { accept: "application/json", ...headers } });
    if (r.status === 429) { await sleep(5000); continue; }
    if (!r.ok) { console.log("HTTP", r.status, url.split("?")[0].slice(0, 90)); return null; }
    return r.json();
  }
  return null;
}
async function eth(c) {
  const H = { "x-api-key": await osKey() }, B = "https://api.opensea.io/api/v2";
  const info = await get(`${B}/collections/${c.slug}`, H); await sleep(600);
  const st = await get(`${B}/collections/${c.slug}/stats`, H); await sleep(600);
  const ev = await get(`${B}/events/collection/${c.slug}?event_type=sale&limit=50`, H); await sleep(600);
  if (!st && !info) return null;
  const tot = (st && st.total) || {}, iv = {}; ((st && st.intervals) || []).forEach(x => { iv[x.interval] = x; });
  const sales = (ev && ev.asset_events || ev && ev.events || []).map(e => {
    const p = e.payment || {}, q = num(p.quantity), d = num(p.decimals);
    return q != null && d != null && /^(eth|weth)$/i.test(p.symbol || "") ? [e.event_timestamp || e.closing_date, q / Math.pow(10, d), String((e.nft && e.nft.identifier) || ""), (e.nft && e.nft.name) || "", e.transaction || ""] : null;
  }).filter(Boolean);
  return { name: (info && info.name) || c.slug, img: (info && info.image_url) || "", cur: "ETH", floor: num(tot.floor_price), supply: num(info && info.total_supply), owners: num(tot.num_owners),
    volAll: num(tot.volume), salesAll: num(tot.sales), vol1: num(iv.one_day && iv.one_day.volume), sales1: num(iv.one_day && iv.one_day.sales), vol7: num(iv.seven_day && iv.seven_day.volume), sales7: num(iv.seven_day && iv.seven_day.sales),
    vol30: num(iv.thirty_day && iv.thirty_day.volume), sales30: num(iv.thirty_day && iv.thirty_day.sales), url: "https://opensea.io/collection/" + c.slug, _sales: sales };
}
async function ton(c, prev) {
  const H = process.env.TONAPI_KEY ? { authorization: "Bearer " + process.env.TONAPI_KEY } : {}, B = "https://tonapi.io/v2";
  const info = await get(`${B}/nfts/collections/${c.address}`, H); await sleep(1200);
  if (!info) return null;
  const listed = {}, owners = new Set(); let n = 0;
  for (let off = 0; off < 5000; off += 1000) {
    const j = await get(`${B}/nfts/collections/${c.address}/items?limit=1000&offset=${off}`, H); await sleep(1200);
    const items = (j && j.nft_items) || []; if (!items.length) break;
    for (const it of items) {
      n++; if (it.owner && it.owner.address) owners.add(it.owner.address);
      const pr = it.sale && it.sale.price; if (pr && /^ton$/i.test(pr.token_name || "TON") && num(pr.value)) listed[it.address] = [num(pr.value) / 1e9, it.owner && it.owner.address || "", (it.metadata && it.metadata.name) || ("#" + it.index), it.index];
    }
    if (items.length < 1000) break;
  }
  // مبيعات مستنتجة: عنصر كان معروض في التشغيل اللي فات وبقى مش معروض ومالكه اتغير = اتباع بآخر سعر عرض
  // (بنفحص حتى 15 عنصر في كل تشغيل؛ الباقي بيتأجل للتشغيل اللي بعده)
  const sales = [], lastListed = prev.ls || {};
  let chk = 0;
  for (const addr of Object.keys(lastListed)) {
    if (listed[addr]) continue;
    if (chk++ >= 15) { listed[addr] = lastListed[addr]; listed[addr]._pending = 1; continue; }
    const it = await get(`${B}/nfts/${addr}`, H); await sleep(1200);
    if (!it) { listed[addr] = lastListed[addr]; continue; }
    const o = it.owner && it.owner.address;
    if (it.sale) { const pr = it.sale.price; listed[addr] = [num(pr && pr.value) / 1e9 || lastListed[addr][0], o || "", lastListed[addr][2], lastListed[addr][3]]; continue; }
    if (o && lastListed[addr][1] && o !== lastListed[addr][1]) sales.push([now, lastListed[addr][0], String(lastListed[addr][3]), lastListed[addr][2], "inferred"]);
  }
  const floor = Object.values(listed).filter(v => !v._pending).reduce((m, v) => Math.min(m, v[0]), Infinity);
  const md = info.metadata || {};
  return { name: md.name || c.id, img: md.image || "", cur: "TON", floor: isFinite(floor) ? floor : null, supply: num(info.next_item_index), owners: owners.size || null, listings: Object.values(listed).filter(v => !v._pending).length,
    url: "https://getgems.io/collection/" + c.address, _sales: sales, _ls: listed };
}
const items = [];
// ممكن تكتب رابط بس: { "url": "https://getgems.io/collection/EQ..." } أو { "url": "https://opensea.io/collection/slug" }
// اكتشاف تلقائي لمجموعات OpenSea اللي اسمها فيه "sticker" (بيفحص أكبر المجموعات على Ethereum حسب القيمة السوقية)
if (cfg.discover && cfg.discover.opensea) {
  const H = { "x-api-key": await osKey() }, have = new Set(cfg.collections.map(c => c.slug).filter(Boolean)), re = new RegExp(cfg.discover.match || "sticker", "i");
  let next = "", found = 0;
  for (let pg = 0; pg < (cfg.discover.pages || 20); pg++) {
    const j = await get(`https://api.opensea.io/api/v2/collections?chain=ethereum&order_by=market_cap&limit=100${next ? "&next=" + encodeURIComponent(next) : ""}`, H); await sleep(700);
    const list = (j && j.collections) || []; if (!list.length) break;
    for (const x of list) { const slug = x.collection || x.slug; if (slug && !have.has(slug) && (re.test(slug) || re.test(x.name || ""))) { have.add(slug); cfg.collections.push({ id: slug, chain: "eth", slug }); found++; } }
    next = j.next; if (!next) break;
  }
  console.log("opensea discovery: found", found);
}
for (const c of cfg.collections) {
  if (c.url) { let m = c.url.match(/getgems\.io\/collection\/(E[QU][\w-]{40,})/); if (m) { c.chain = "ton"; c.address = m[1]; } else if ((m = c.url.match(/opensea\.io\/collection\/([\w-]+)/))) { c.chain = "eth"; c.slug = m[1]; } c.id = c.id || (c.address ? c.address.slice(0, 10) : c.slug); }
}
for (const c of cfg.collections) {
  const file = sfile(c.id), prev = rd(file, { sales: [], snaps: [] });
  let r = null;
  try { r = c.chain === "ton" ? await ton(c, prev) : await eth(c); } catch (e) { console.log("ERR", c.id, e.message); }
  if (!r) continue;
  // دمج المبيعات (بدون تكرار) ولقطة سعر الحد الأدنى للشارت
  const seen = new Set(prev.sales.map(x => x[2] + "|" + (x[4] || x[0]))), sales = prev.sales.slice();
  for (const s of r._sales || []) { const ts = typeof s[0] === "number" ? s[0] : Math.floor(Date.parse(s[0]) / 1000) || now; const row = [ts, s[1], s[2], s[3], s[4]]; const k = s[2] + "|" + (s[4] || ts); if (!seen.has(k)) { seen.add(k); sales.push(row); } }
  sales.sort((a, b) => b[0] - a[0]);
  const snaps = prev.snaps.slice(); if (r.floor != null && (!snaps.length || snaps[snaps.length - 1][1] !== r.floor || now - snaps[snaps.length - 1][0] > 3600)) snaps.push([now, r.floor]);
  const st = { u: now, sales: sales.slice(0, 1500), snaps: snaps.slice(-2000) }; if (r._ls) st.ls = r._ls;
  fs.writeFileSync(file, JSON.stringify(st));
  // لو مفيش أرقام حجم من API (TON) بنحسبها من المبيعات المسجلة
  const dayVol = (s, from) => sales.filter(x => x[0] >= from).reduce((a, x) => a + x[1], 0), cnt = from => sales.filter(x => x[0] >= from).length;
  if (r.vol1 == null) { r.vol1 = dayVol(0, now - 86400); r.sales1 = cnt(now - 86400); r.vol7 = dayVol(0, now - 7 * 86400); r.sales7 = cnt(now - 7 * 86400); r.vol30 = dayVol(0, now - 30 * 86400); r.sales30 = cnt(now - 30 * 86400); r.volAll = dayVol(0, 0); r.salesAll = sales.length; r.inferred = true; }
  const old = snaps.find(x => x[0] >= now - 86400), c1 = r.floor != null && old && old[1] > 0 ? (r.floor - old[1]) / old[1] * 100 : null;
  delete r._sales; delete r._ls;
  items.push({ id: c.id, chain: c.chain, ...r, c1 });
}
if (items.length) fs.writeFileSync(OUT + "/stickers.json", JSON.stringify({ u: now, items }));
console.log("stickers:", items.length, "of", cfg.collections.length);
