// فحص بنية ردود Gift Satellite — بيطبع الشكل فقط، مش المفتاح.
const TOKEN = process.env.GS_TOKEN;
if (!TOKEN) { console.log("GS_TOKEN غير موجود في Secrets"); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CANDS = (process.env.GS_BASE ? [process.env.GS_BASE] :
  ["https://gift-satellite.dev/api", "https://gift-satellite.dev", "https://api.gift-satellite.dev"])
  .map(s => s.replace(/\/$/, ""));

async function call(base, path) {
  try {
    const r = await fetch(base + path, { headers: { Authorization: "Token " + TOKEN, accept: "application/json" } });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    return { status: r.status, j, head: j ? "" : t.slice(0, 80).replace(/\s+/g, " ") };
  } catch (e) { return { status: "ERR", j: null, head: String(e.message || e).slice(0, 80) }; }
}
function shape(v, d = 0) {
  if (v === null) return "null";
  if (Array.isArray(v)) return d > 3 ? "[...]" : `[${v.length} items] first=` + (v.length ? shape(v[0], d + 1) : "-");
  if (typeof v === "object") {
    if (d > 3) return "{...}";
    return "{" + Object.entries(v).slice(0, 30).map(([k, x]) => k + ":" + shape(x, d + 1)).join(", ") + "}";
  }
  if (typeof v === "string") return JSON.stringify(v.length > 40 ? v.slice(0, 40) + "…" : v);
  return String(v);
}

let base = null;
for (const b of CANDS) {
  const r = await call(b, "/gift/collections");
  console.log("BASE", b, "→", r.status, r.head);
  if (r.j) { base = b; console.log("collections shape:", shape(r.j)); var cols = r.j; break; }
  await sleep(1500);
}
if (!base) { console.log("مفيش Base URL اشتغل. حط GS_BASE في Variables."); process.exit(0); }

// نختار أول كوليكشن بأكتر من اسم محتمل
const arr = Array.isArray(cols) ? cols : (cols.items || cols.data || cols.collections || []);
const first = arr[0] || {};
const cands = [...new Set([first.slug, first.id, first.name, "plushpepe", "Plush Pepe"].filter(Boolean).map(String))];
console.log("collection candidates:", cands.join(" | "));

for (const m of ["portals", "tonnel", "mrkt", "getgems", "tg"]) {
  for (const c of cands.slice(0, 2)) {
    await sleep(1700);
    const path = `/search/${m}/${encodeURIComponent(c)}`;
    const r = await call(base, path);
    console.log(`\n[${m}] ${path} → ${r.status} ${r.head}`);
    if (r.j) { console.log(shape(r.j)); break; }
  }
}
await sleep(1700);
const h = await call(base, "/history/collection-offers");
console.log("\n[collection-offers]", h.status, h.j ? shape(h.j) : h.head);
