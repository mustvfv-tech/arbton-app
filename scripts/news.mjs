// أخبار الكريبتو: بنجمع RSS من مصادر موثوقة وبنحفظها في _out/news.json (بيتنشر على فرع data)
import fs from "node:fs";
const OUT = process.env.OUT_DIR || "_out";
const FEEDS = [
  ["CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"],
  ["Cointelegraph", "https://cointelegraph.com/rss"],
  ["Decrypt", "https://decrypt.co/feed"],
  ["The Block", "https://www.theblock.co/rss.xml"],
  ["Bitcoin Magazine", "https://bitcoinmagazine.com/.rss/full/"],
  ["CryptoSlate", "https://cryptoslate.com/feed/"],
  ["Blockworks", "https://blockworks.co/feed"],
  ["TON Blog", "https://blog.ton.org/rss"]
];
const dec = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const strip = s => dec(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (x, n) => { const m = x.match(new RegExp("<" + n + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + n + ">", "i")); return m ? m[1] : ""; };
export function parseFeed(xml, source) {
  const out = [], blocks = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = strip(tag(b, "title")); if (!title) continue;
    let link = strip(tag(b, "link")); if (!link) { const m = b.match(/<link[^>]+href="([^"]+)"/i); link = m ? m[1] : ""; }
    if (!/^https?:\/\//.test(link)) continue;
    const d = Date.parse(strip(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date")));
    const img = (b.match(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/i) || b.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image/i) || [])[1] || "";
    const sum = strip(tag(b, "description") || tag(b, "summary")).slice(0, 220);
    out.push({ t: title, u: link, s: source, d: isFinite(d) ? d : Date.now(), i: img, x: sum });
  }
  return out;
}
async function main() {
  const all = [];
  await Promise.all(FEEDS.map(async ([name, url]) => {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; ARBTON news bot)", accept: "application/rss+xml, application/xml, text/xml, */*" }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) { console.log(name, "HTTP", r.status); return; }
      const items = parseFeed(await r.text(), name).slice(0, 25); console.log(name, items.length); all.push(...items);
    } catch (e) { console.log(name, "fail", e.message); }
  }));
  const seen = new Set(), now = Date.now();
  const list = all.filter(x => x.d <= now + 3600e3 && now - x.d < 5 * 86400e3).sort((a, b) => b.d - a.d).filter(x => { const k = x.t.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 100);
  fs.mkdirSync(OUT, { recursive: true });
  if (list.length) fs.writeFileSync(OUT + "/news.json", JSON.stringify({ updated: Math.floor(now / 1000), items: list }));
  else console.log("no items — keeping previous news.json");
}
if (process.argv[1] && process.argv[1].endsWith("news.mjs")) main();
