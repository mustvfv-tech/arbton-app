// ARBTON Worker — تنبيهات الأسعار + أوامر الجروبات + إرسال الصور للخاص
// بيشتغل على Cloudflare Workers (مجاني). المتغيرات المطلوبة في الإعدادات:
//   BOT_TOKEN (Secret) · WEBHOOK_SECRET (Secret) · DATA_BASE · ALLOWED_ORIGIN · MINIAPP_URL
//   وربط KV اسمه ALERTS
const MK = { portals: "Portals", tonnel: "Tonnel", mrkt: "MRKT", getgems: "GetGems", tg: "Telegram" };
const norm = x => String(x).toLowerCase().replace(/[^a-z0-9]/g, "");
const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const fmt = n => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
const MAX_ALERTS = 20;

const L = {
  en: {
    start: "👋 Welcome to <b>ARBTON</b>.\n\nSet a price alert:\n<code>/alert plush pepe 3000</code> → notify when the floor drops to 3000 TON or below\n<code>/alert plush pepe &gt;5000</code> → notify when it rises to 5000 or above\n\nMoves: <code>/alert plush pepe -10%</code> (drop 10%/24h) · <code>deal 15</code> (15% below 7d avg) · <code>sales 20</code> (20 sales/24h)\nCrypto too: <code>/alert btc 100000</code> · <code>/price eth</code>\n\n/alerts — your alerts · /del N — delete · /floor NAME — current floor\nSend a gift link (t.me/nft/…) to get its sales history.",
    open: "Open ARBTON", nofound: "Gift not found. Try the exact name, e.g. Plush Pepe.", noalerts: "You have no alerts.",
    set: "✅ Alert set: <b>{c}</b> {op} <b>{p}</b> TON\n(current floor {f} TON)", limit: "Max {n} alerts. Delete one with /del N.",
    usage: "Usage: <code>/alert plush pepe 3000</code> or <code>/alert plush pepe &gt;5000</code>", del: "🗑 Deleted.", cleared: "🗑 All alerts deleted.",
    hit: "🔔 <b>{c}</b> floor is now <b>{f}</b> TON ({op} {p}) on {m}", floor: "<b>{c}</b>\nFloor: <b>{f}</b> TON ({m}){ch}", sales: "Last sales", nosales: "No sales data yet.",
    thisgift: "This gift", list: "Your alerts", sent: "✅ Sent.",
    setc: "✅ Alert set: <b>{c}</b> {op} <b>${p}</b>\n(current price ${f})", hitc: "🔔 <b>{c}</b> is now <b>${f}</b> ({op} ${p})", pricec: "<b>{c}</b>\nPrice: <b>${f}</b>{ch}"
  },
  ru: {
    start: "👋 Добро пожаловать в <b>ARBTON</b>.\n\nУстановить оповещение:\n<code>/alert plush pepe 3000</code> → уведомить, когда флор упадёт до 3000 TON и ниже\n<code>/alert plush pepe &gt;5000</code> → когда поднимется до 5000 и выше\n\nДвижение: <code>/alert plush pepe -10%</code> · <code>deal 15</code> · <code>sales 20</code>\nКрипта тоже: <code>/alert btc 100000</code> · <code>/price eth</code>\n\n/alerts — список · /del N — удалить · /floor НАЗВАНИЕ — флор\nОтправьте ссылку на подарок (t.me/nft/…) — покажу историю продаж.",
    open: "Открыть ARBTON", nofound: "Подарок не найден. Попробуйте точное название, напр. Plush Pepe.", noalerts: "Оповещений нет.",
    set: "✅ Оповещение: <b>{c}</b> {op} <b>{p}</b> TON\n(сейчас флор {f} TON)", limit: "Максимум {n}. Удалите: /del N.",
    usage: "Пример: <code>/alert plush pepe 3000</code> или <code>/alert plush pepe &gt;5000</code>", del: "🗑 Удалено.", cleared: "🗑 Все удалены.",
    hit: "🔔 Флор <b>{c}</b> сейчас <b>{f}</b> TON ({op} {p}) — {m}", floor: "<b>{c}</b>\nФлор: <b>{f}</b> TON ({m}){ch}", sales: "Последние продажи", nosales: "Данных о продажах пока нет.",
    thisgift: "Этот подарок", list: "Ваши оповещения", sent: "✅ Отправлено.",
    setc: "✅ Оповещение: <b>{c}</b> {op} <b>${p}</b>\n(сейчас ${f})", hitc: "🔔 <b>{c}</b> сейчас <b>${f}</b> ({op} ${p})", pricec: "<b>{c}</b>\nЦена: <b>${f}</b>{ch}"
  },
  ar: {
    start: "👋 أهلاً بك في <b>ARBTON</b>.\n\nلضبط تنبيه سعر:\n<code>/alert plush pepe 3000</code> ← ينبهك لما الفلور ينزل إلى 3000 TON أو أقل\n<code>/alert plush pepe &gt;5000</code> ← ينبهك لما يرتفع إلى 5000 أو أكثر\n\nتنبيهات متقدمة: <code>/alert plush pepe -10%</code> (نزول 10% في 24 ساعة) · <code>deal 15</code> (أقل من متوسط 7 أيام بـ 15%) · <code>sales 20</code> (20 عملية بيع في 24 ساعة)\nوالكريبتو كمان: <code>/alert btc 100000</code> · <code>/price eth</code>\n\n/alerts — تنبيهاتك · /del N — حذف · /floor الاسم — الفلور الحالي\nابعت رابط هدية (t.me/nft/…) وهرد عليك بسجل مبيعاتها.",
    open: "افتح ARBTON", nofound: "الهدية غير موجودة. جرّب الاسم بالظبط، مثلاً Plush Pepe.", noalerts: "مفيش تنبيهات.",
    set: "✅ تم ضبط التنبيه: <b>{c}</b> {op} <b>{p}</b> TON\n(الفلور الحالي {f} TON)", limit: "الحد الأقصى {n} تنبيه. احذف واحد بـ /del N.",
    usage: "مثال: <code>/alert plush pepe 3000</code> أو <code>/alert plush pepe &gt;5000</code>", del: "🗑 تم الحذف.", cleared: "🗑 تم حذف كل التنبيهات.",
    hit: "🔔 فلور <b>{c}</b> وصل <b>{f}</b> TON ({op} {p}) على {m}", floor: "<b>{c}</b>\nالفلور: <b>{f}</b> TON ({m}){ch}", sales: "آخر المبيعات", nosales: "مفيش بيانات مبيعات لسه.",
    thisgift: "الهدية دي", list: "تنبيهاتك", sent: "✅ تم الإرسال.",
    setc: "✅ تم ضبط التنبيه: <b>{c}</b> {op} <b>${p}</b>\n(السعر الحالي ${f})", hitc: "🔔 <b>{c}</b> وصل <b>${f}</b> ({op} ${p})", pricec: "<b>{c}</b>\nالسعر: <b>${f}</b>{ch}"
  }
};
const lang = u => { const c = String((u && u.language_code) || "en").slice(0, 2); return L[c] ? c : "en"; };
const tr = (lg, k, v = {}) => (L[lg][k] || L.en[k] || k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? "");

// ---------- Telegram ----------
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  return r.json().catch(() => ({}));
}
const say = (env, chat, text, extra = {}) => tg(env, "sendMessage", { chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });
const openBtn = (env, lg) => env.MINIAPP_URL ? { reply_markup: { inline_keyboard: [[{ text: tr(lg, "open"), web_app: { url: env.MINIAPP_URL } }]] } } : {};

// ---------- data ----------
const base = env => String(env.DATA_BASE || "").replace(/\/?$/, "/");
async function getJSON(env, path) {
  const r = await fetch(base(env) + path + "?t=" + Math.floor(Date.now() / 120000), { cf: { cacheTtl: 120 } });
  if (!r.ok) throw new Error("data " + r.status);
  return r.json();
}
const floors = env => getJSON(env, "floors.json");
function findCollection(fl, q) {
  const n = norm(q); if (!n) return null;
  const names = Object.keys(fl.collections || {});
  return names.find(x => norm(x) === n) || names.find(x => norm(x).startsWith(n)) || names.find(x => norm(x).includes(n)) || null;
}

// ---------- كريبتو (CoinGecko) ----------
const CG = "https://api.coingecko.com/api/v3";
const cgGet = async p => { const r = await fetch(CG + p, { headers: { accept: "application/json", "user-agent": "arbton-bot" }, cf: { cacheTtl: 60 } }); if (!r.ok) throw new Error("cg " + r.status); return r.json(); };
async function resolveCoin(q) {
  const j = await cgGet("/search?query=" + encodeURIComponent(q.trim())), cs = (j.coins || []);
  const ql = q.trim().toLowerCase(), rk = c => c.market_cap_rank || 1e9;
  const ex = cs.filter(c => c.symbol.toLowerCase() === ql || c.name.toLowerCase() === ql).sort((a, b) => rk(a) - rk(b))[0];
  const c = ex || cs.sort((a, b) => rk(a) - rk(b))[0];
  return c ? { id: c.id, name: c.name, sym: c.symbol.toUpperCase() } : null;
}
async function coinPrices(ids) { // { id: {usd, chg} }
  if (!ids.length) return {};
  return cgGet("/simple/price?vs_currencies=usd&include_24hr_change=true&ids=" + encodeURIComponent(ids.join(",")));
}
const usd = n => n >= 1 ? fmt(n) : Number(n).toPrecision(4).replace(/0+$/, "");
const coinLabel = a => `${a.n} (${a.s})`;

// ---------- أوامر ----------
const TKW = { deal: "deal", صفقه: "deal", فرصه: "deal", sales: "vol", vol: "vol", مبيعات: "vol" };
function parseAlertArgs(s) { // "plush pepe 3000" | ">5000" | "-10%" | "+10%" | "deal 15" | "sales 20"
  const x = s.trim(), pm = x.match(/^(.+?)\s*([+-])\s*(\d+(?:[.,]\d+)?)\s*%$/);
  if (pm) return { q: pm[1].trim(), t: pm[2] === "-" ? "drop" : "rise", p: parseFloat(pm[3].replace(",", ".")) };
  const km = x.match(/^(.+?)\s+(\S+)\s+(\d+(?:[.,]\d+)?)\s*%?$/);
  if (km && TKW[arn(km[2])]) return { q: km[1].trim(), t: TKW[arn(km[2])], p: parseFloat(km[3].replace(",", ".")) };
  const m = x.match(/^(.+?)\s*(<=|>=|<|>)?\s*(\d+(?:[.,]\d+)?)\s*$/);
  if (!m) return null;
  return { q: m[1].trim(), op: (m[2] || "<").startsWith(">") ? ">=" : "<=", p: parseFloat(m[3].replace(",", ".")) };
}
const arn = s => String(s).toLowerCase().replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
const alertText = (a, lg) => a.k === "coin" ? `${esc(a.n + " (" + a.s + ")")} ${a.op === "<=" ? "≤" : "≥"} $${usd(a.p)}`
  : a.t === "drop" ? `${esc(a.c)} ⬇ ${a.p}% / 24h` : a.t === "rise" ? `${esc(a.c)} ⬆ ${a.p}% / 24h`
  : a.t === "deal" ? `${esc(a.c)} 🏷 ${a.p}% ${X(lg, "أقل من متوسط 7 أيام", "below 7d avg")}` : a.t === "vol" ? `${esc(a.c)} 📈 ≥ ${a.p} ${X(lg, "عملية بيع / 24 ساعة", "sales / 24h")}`
  : `${esc(a.c + (a.m ? " · " + a.m : ""))} ${a.op === "<=" ? "≤" : "≥"} ${fmt(a.p)} TON`;
const getAlerts = async (env, chat) => JSON.parse((await env.ALERTS.get("a:" + chat)) || "[]");
const putAlerts = async (env, chat, arr) => arr.length ? env.ALERTS.put("a:" + chat, JSON.stringify(arr)) : env.ALERTS.delete("a:" + chat);

async function addAlert(env, chat, lg, text, forceCoin = false) {
  const a = parseAlertArgs(text); if (!a) return tr(lg, "usage");
  const arr = await getAlerts(env, chat);
  if (arr.length >= MAX_ALERTS) return tr(lg, "limit", { n: MAX_ALERTS });
  const sym = a.op === "<=" ? "≤" : "≥";
  if (a.t) { // تنبيهات متقدمة: للهدايا فقط
    const fl = await floors(env), name = findCollection(fl, a.q); if (!name) return tr(lg, "nofound");
    arr.push({ c: name, t: a.t, p: a.p, l: lg, t0: Date.now() }); await putAlerts(env, chat, arr);
    return "✅ " + alertText({ c: name, t: a.t, p: a.p }, lg);
  }
  if (!forceCoin) {
    const fl = await floors(env), name = findCollection(fl, a.q);
    if (name) {
      arr.push({ c: name, op: a.op, p: a.p, l: lg, t: Date.now() }); await putAlerts(env, chat, arr);
      return tr(lg, "set", { c: esc(name), op: sym, p: fmt(a.p), f: fmt(fl.collections[name].floor) });
    }
  }
  let coin; try { coin = await resolveCoin(a.q); } catch { coin = null; }
  if (!coin) return tr(lg, "nofound");
  const pr = await coinPrices([coin.id]).catch(() => ({}));
  arr.push({ k: "coin", id: coin.id, n: coin.name, s: coin.sym, op: a.op, p: a.p, l: lg, t: Date.now() }); await putAlerts(env, chat, arr);
  return tr(lg, "setc", { c: esc(coinLabel({ n: coin.name, s: coin.sym })), op: sym, p: usd(a.p), f: pr[coin.id] ? usd(pr[coin.id].usd) : "—" });
}
async function listAlerts(env, chat, lg) {
  const arr = await getAlerts(env, chat); if (!arr.length) return tr(lg, "noalerts");
  return "<b>" + tr(lg, "list") + "</b>\n" + arr.map((a, i) => `${i + 1}. ` + alertText(a, lg)).join("\n");
}
async function floorText(env, lg, q) {
  const fl = await floors(env), name = findCollection(fl, q);
  if (name) {
    const c = fl.collections[name];
    const ch = c.p24 > 0 ? `\n24h: ${((c.floor - c.p24) / c.p24 * 100).toFixed(2)}%` : "";
    return tr(lg, "floor", { c: esc(name), f: fmt(c.floor), m: MK[c.market] || c.market, ch });
  }
  return coinText(lg, q);
}
async function coinText(lg, q) {
  let coin; try { coin = await resolveCoin(q); } catch { coin = null; }
  if (!coin) return tr(lg, "nofound");
  const pr = (await coinPrices([coin.id]).catch(() => ({})))[coin.id];
  if (!pr) return tr(lg, "nofound");
  const ch = typeof pr.usd_24h_change === "number" ? `\n24h: ${pr.usd_24h_change.toFixed(2)}%` : "";
  return tr(lg, "pricec", { c: esc(coinLabel({ n: coin.name, s: coin.sym })), f: usd(pr.usd), ch });
}
async function salesText(env, lg, slug) { // slug مثل PlushPepe-1234
  const m = String(slug).match(/^([A-Za-z0-9_]+?)-(\d+)$/); if (!m) return null;
  let sd; try { sd = await getJSON(env, "sales/" + norm(m[1]) + ".json"); } catch { return null; }
  const fl = await floors(env).catch(() => null);
  const name = (fl && findCollection(fl, m[1])) || sd.n || m[1];
  const rows = sd.s || [], num = +m[2];
  const line = r => `• ${fmt(r[1])} TON · ${MK[r[2]] || r[2]} · ${gLink(name, r[3])} · ${new Date(r[0] * 1000).toISOString().slice(0, 16).replace("T", " ")}`;
  let out = `🎁 <b>${esc(name)}</b> ${gLink(name, num)}`;
  if (fl && fl.collections[name]) out += `\nFloor: <b>${fmt(fl.collections[name].floor)}</b> TON`;
  const mine = rows.filter(r => +r[3] === num).slice(0, 5);
  if (mine.length) out += `\n\n<b>${tr(lg, "thisgift")}</b>\n` + mine.map(line).join("\n");
  const last = rows.slice(0, 8);
  out += `\n\n<b>${tr(lg, "sales")}</b>\n` + (last.length ? last.map(line).join("\n") : tr(lg, "nosales"));
  return out;
}

async function onMessage(env, msg) {
  const chat = msg.chat.id, lg = lang(msg.from || { language_code: "en" }), text = (msg.text || msg.caption || "").trim();
  const isGroup = msg.chat.type !== "private";
  if (!text) return;
  const cmdm = text.match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/);
  if (cmdm) {
    const cmd = cmdm[1].toLowerCase(), arg = (cmdm[2] || "").trim();
    if (cmd === "start" || cmd === "help") {
      if (cmd === "start" && env.INTRO_URL) await tg(env, "sendVideo", { chat_id: chat, video: env.INTRO_URL, supports_streaming: true }).catch(() => {});
      return say(env, chat, tr(lg, "start"), openBtn(env, lg));
    }
    if (cmd === "get" || cmd === "getn") {
      const lm = arg.match(LINK); if (!lm) return say(env, chat, "<code>/" + (cmd === "getn" ? "getN" : "get") + " t.me/nft/PlushPepe-1234</code>");
      const g = await resolveGift(env, lm[1]); if (!g) return say(env, chat, tr(lg, "nofound"));
      return say(env, chat, cmd === "getn" ? rGetN(g, lg) : rGet(g, lg, false), isGroup ? { reply_to_message_id: msg.message_id } : {});
    }
    if (cmd === "watch" || cmd === "unwatch") {
      if (!isGroup) return say(env, chat, X(lg, "أضفني في الجروب/القناة ثم أرسل /watch هناك (اختياري: /watch 10 = حد الارتفاع %).", "Add me to a group/channel, then send /watch there (optional: /watch 10 = pump threshold %)."));
      if (msg.from) { const mem = await tg(env, "getChatMember", { chat_id: chat, user_id: msg.from.id }); const st = mem && mem.result && mem.result.status; if (st !== "administrator" && st !== "creator") return say(env, chat, X(lg, "للمشرفين فقط.", "Admins only.")); }
      if (cmd === "unwatch") { await env.ALERTS.delete("w:" + chat); return say(env, chat, "✅ OFF"); }
      const th = Math.min(100, Math.max(3, Number(arg) || 10));
      await env.ALERTS.put("w:" + chat, JSON.stringify({ th, l: lg }));
      return say(env, chat, X(lg, `✅ تم. هتوصلكم إشعارات لما فلور أي هدية يرتفع ${th}% أو أكتر.`, `✅ Done. You'll get a chart post when any gift floor rises ${th}%+.`));
    }
    if (cmd === "floor") return say(env, chat, arg ? await floorText(env, lg, arg) : tr(lg, "usage"));
    if (cmd === "price") return say(env, chat, arg ? await coinText(lg, arg) : tr(lg, "usage"));
    if (cmd === "sales") {
      const lm = arg.match(/t\.me\/nft\/([A-Za-z0-9_]+-\d+)/i), out = lm && await salesText(env, lg, lm[1]);
      return say(env, chat, out || tr(lg, "nofound"));
    }
    // التنبيهات في الخاص فقط (عشان التنبيه يوصل لصاحبه)
    if (["alert", "calert", "alerts", "del", "clear"].includes(cmd)) {
      const uid = msg.from.id;
      if (isGroup) return say(env, chat, "↪ @" + (env.BOT_USERNAME || "bot") + " (private)");
      if (cmd === "alert" || cmd === "calert") return say(env, uid, await addAlert(env, uid, lg, arg, cmd === "calert"));
      if (cmd === "alerts") return say(env, uid, await listAlerts(env, uid, lg));
      if (cmd === "clear") { await putAlerts(env, uid, []); return say(env, uid, tr(lg, "cleared")); }
      const arr = await getAlerts(env, uid), i = parseInt(arg, 10) - 1;
      if (arr[i]) { arr.splice(i, 1); await putAlerts(env, uid, arr); return say(env, uid, tr(lg, "del")); }
      return say(env, uid, tr(lg, "usage"));
    }
    return;
  }
  // كلمات عربية/إنجليزي قبل الرابط (فلور، مبيعات، توب، تنبيه ...)
  const kp = parseKw(text);
  if (kp) { try { return await handleReport(env, msg, kp, lg, isGroup); } catch (e) { console.log("report err", e && e.message); return; } }
  // رابط هدية في أي رسالة (جروب أو خاص)
  const lm = text.match(/t\.me\/nft\/([A-Za-z0-9_]+-\d+)/i);
  if (lm) { const out = await salesText(env, lg, lm[1]); if (out) return say(env, chat, out, isGroup ? { reply_to_message_id: msg.message_id } : {}); }
}


// ======================= أوامر التقارير (/get /getN + كلمات عربية) =======================
const X = (lg, ar, en) => (lg === "ar" ? ar : en);
const KW = { فلور: "floor", floor: "floor", كويك: "order", اوردر: "order", order: "order", quick: "order", سبلاي: "supply", supply: "supply",
  مبيعات: "sales", sales: "sales", هولدرز: "holders", holders: "holders", تنبيه: "alert", alert: "alert", توب: "top", top: "top" };
const BGW = new Set(["خلفيه", "backdrop", "bg"]);
const LINK = /t\.me\/nft\/([A-Za-z0-9_]+-\d+)/i;
const ago = ts => { const d = Math.max(0, Date.now() / 1000 - ts); return d < 3600 ? Math.round(d / 60) + "m" : d < 86400 ? Math.round(d / 3600) + "h" : Math.round(d / 86400) + "d"; };
const cleanAttr = v => String(v || "").replace(/\s*\d+(?:\.\d+)?\s*%\s*$/, "").trim();

function parseKw(text) {
  const lm = text.match(LINK), slug = lm ? lm[1] : null;
  let w = arn(text.replace(LINK, " ").replace(/https?:\/\/\S*/g, " ")).split(/[\s،,]+/).filter(Boolean), bg = false;
  if (w.length && BGW.has(w[0])) { bg = true; w.shift(); }
  const kind = w.length ? KW[w[0]] : null; if (!kind) return null;
  return { kind, bg, slug, rest: w.slice(1) };
}
async function giftAttrs(env, slug, rows) { // model/backdrop/symbol: من المبيعات لو الهدية اتباعت، وإلا من صفحة t.me العامة
  const hit = (rows || []).find(r => r[7] === slug);
  if (hit && hit[4]) return { model: hit[4], backdrop: hit[5], symbol: hit[6] };
  try {
    const r = await fetch("https://t.me/nft/" + slug, { headers: { "user-agent": "Mozilla/5.0" }, cf: { cacheTtl: 3600 } });
    const html = await r.text(), out = {};
    const og = (html.match(/property="og:description"\s+content="([^"]*)"/i) || html.match(/content="([^"]*)"\s+property="og:description"/i) || [])[1] || "";
    const dec = og.replace(/&#10;|&#13;/g, "\n").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    const pick = k => { const m = dec.match(new RegExp(k + ":\\s*([^\\n]+)", "i")) || html.match(new RegExp("<th[^>]*>\\s*" + k + "\\s*</th>\\s*<td[^>]*>([^<]+)", "i")); return m ? cleanAttr(m[1]) : ""; };
    out.model = pick("Model"); out.backdrop = pick("Backdrop"); out.symbol = pick("Symbol");
    return out.model ? out : null;
  } catch { return null; }
}
async function resolveGift(env, slug) {
  const m = slug.match(/^([A-Za-z0-9_]+?)-(\d+)$/); if (!m) return null;
  const fl = await floors(env), col = findCollection(fl, m[1]); if (!col) return null;
  let rows = []; try { rows = (await getJSON(env, "sales/" + norm(col) + ".json")).s || []; } catch {}
  const at = await giftAttrs(env, slug, rows);
  let model = null;
  if (at && at.model) { const mm = fl.collections[col].models || {}; model = Object.keys(mm).find(k => norm(k) === norm(at.model)) || at.model; }
  return { fl, col, c: fl.collections[col], num: +m[2], slug, rows, model, backdrop: at && at.backdrop, symbol: at && at.symbol };
}
const mkLines = (obj, lg) => Object.entries(obj).sort((a, b) => (a[1].p ?? a[1]) - (b[1].p ?? b[1])).map(([k, v]) => `• ${MK[k] || k}: <b>${fmt(v.p ?? v)}</b> TON`).join("\n");
const gLink = (col, n) => `<a href="https://t.me/nft/${String(col).replace(/[^A-Za-z0-9]/g, "")}-${n}">#${n}</a>`;
const sLineC = col => r => `• <b>${fmt(r[1])}</b> TON · ${MK[r[2]] || r[2]} · ${gLink(col, r[3])}${r[4] ? " · " + esc(r[4]) : ""}${r[5] ? " · " + esc(r[5]) : ""} · ${ago(r[0])}`;
const head = (g, lg) => `🎁 <b>${esc(g.col)}</b> ${gLink(g.col, g.num)}` + (g.model ? `\n${X(lg, "النموذج", "Model")}: <b>${esc(g.model)}</b>` + (g.backdrop ? ` · ${X(lg, "الخلفية", "Backdrop")}: <b>${esc(g.backdrop)}</b>` : "") + (g.symbol ? ` · ${esc(g.symbol)}` : "") : "");
const filt = (g, bg) => g.rows.filter(r => !g.model || norm(r[4]) === norm(g.model)).filter(r => !bg || !g.backdrop || norm(r[5]) === norm(g.backdrop));
const NA = (lg, what) => `ℹ️ ${what}: ` + X(lg, "غير متاح حاليًا (مفيش مصدر بيانات رسمي له).", "not available yet (no official data source).");

function rFloor(g, lg, bg) {
  let o = head(g, lg) + `\n\n<b>${X(lg, "فلور الكوليكشن في الأسواق", "Collection floor by market")}</b>\n` + mkLines(g.c.markets || {}, lg);
  const mm = g.model && (g.c.models || {})[g.model];
  if (mm) o += `\n\n<b>${X(lg, "فلور النموذج", "Model floor")}</b> ${esc(g.model)}\n` + mkLines(mm.mk || {}, lg);
  else if (g.model) o += `\n\n${X(lg, "فلور النموذج", "Model floor")}: ${X(lg, "مش ظاهر في أرخص العروض حاليًا", "not among the cheapest listings now")}`;
  if (bg) o += "\n\n" + NA(lg, X(lg, "فلور الخلفية", "Backdrop floor"));
  return o;
}
function rSales(g, lg, bg, n = 10) {
  const rows = filt(g, bg), day = rows.filter(r => r[0] > Date.now() / 1000 - 86400), vol = day.reduce((s, r) => s + r[1], 0);
  let o = head(g, lg) + `\n\n<b>${X(lg, "آخر المبيعات", "Recent sales")}</b>\n` + (rows.length ? rows.slice(0, n).map(sLineC(g.col)).join("\n") : X(lg, "مفيش مبيعات مسجلة.", "No recorded sales."));
  o += `\n\n24h: <b>${day.length}</b> ${X(lg, "قطعة", "sold")} · <b>${fmt(vol)}</b> TON`;
  return o;
}
function rGet(g, lg, bg) {
  const rows = filt(g, bg), mm = g.model && (g.c.models || {})[g.model];
  let o = head(g, lg) + `\n\n<b>${X(lg, "الفلور في الأسواق", "Floor by market")}</b>\n` + mkLines(g.c.markets || {}, lg);
  if (mm) o += `\n\n<b>${X(lg, "فلور النموذج", "Model floor")}</b>\n` + mkLines(mm.mk || {}, lg);
  o += `\n\n<b>${X(lg, "آخر المبيعات", "Recent sales")}</b>\n` + (rows.length ? rows.slice(0, 5).map(sLineC(g.col)).join("\n") : X(lg, "مفيش مبيعات مسجلة.", "No recorded sales."));
  o += `\n\n` + NA(lg, X(lg, "أعلى الأوردرات وأكبر الحاملين", "Top orders and top holders"));
  return o;
}
function rGetN(g, lg) {
  const rows = g.rows.filter(r => +r[3] === g.num);
  let o = `#️⃣ <b>${esc(g.col)}</b> ${gLink(g.col, g.num)}\n\n<b>${X(lg, "مبيعات الرقم ده", "Sales of this number")}</b>\n` + (rows.length ? rows.slice(0, 8).map(sLineC(g.col)).join("\n") : X(lg, "الرقم ده ما اتباعش في السجل.", "This number has no recorded sales."));
  o += `\n\n${X(lg, "فلور الكوليكشن", "Collection floor")}: <b>${fmt(g.c.floor)}</b> TON (${MK[g.c.market] || g.c.market})`;
  o += `\n\n` + NA(lg, X(lg, "البحث عن نفس الرقم في كل الهدايا وحامليه", "Searching this number across all gifts, and its holders"));
  return o;
}
function rSupply(g, lg) {
  const listed = Object.values(g.c.markets || {}).reduce((s, v) => s + (v.n || 0), 0);
  return head(g, lg) + `\n\n${X(lg, "معروض حاليًا (ضمن أرخص العروض الظاهرة)", "Listed now (among visible cheapest offers)")}: <b>${listed}</b>\n` + NA(lg, X(lg, "إجمالي عدد القطع", "Total supply"));
}
async function rTop(env, lg) {
  let tp; try { tp = await getJSON(env, "top.json"); } catch { return X(lg, "بيانات التوب لسه مش جاهزة (تتحدّث مع تشغيل Update sales).", "Top data isn't ready yet (it updates with the Update sales job)."); }
  const fl = await floors(env).catch(() => null), g = tp.gifts && tp.gifts[0], m = tp.models && tp.models[0];
  const flo = (c, mod) => { const cc = fl && fl.collections[findCollection(fl, c)]; const v = mod ? cc && cc.models && cc.models[mod] && cc.models[mod].p : cc && cc.floor; return v != null ? fmt(v) + " TON" : "—"; };
  let o = `🔥 <b>${X(lg, "الأكثر مبيعًا آخر 24 ساعة", "Top sellers, last 24h")}</b>\n`;
  if (g) o += `\n🎁 ${X(lg, "هدية", "Gift")}: <b>${esc(g.n)}</b> — ${g.c} ${X(lg, "عملية", "sales")} · ${fmt(g.v)} TON\n${X(lg, "الفلور", "Floor")}: <b>${flo(g.n)}</b>`;
  if (m) o += `\n\n🧩 ${X(lg, "نموذج", "Model")}: <b>${esc(m.n)} · ${esc(m.m)}</b> — ${m.c} ${X(lg, "عملية", "sales")} · ${fmt(m.v)} TON\n${X(lg, "الفلور", "Floor")}: <b>${flo(m.n, m.m)}</b>`;
  return g || m ? o : X(lg, "مفيش مبيعات كفاية.", "Not enough sales yet.");
}
async function rCheapest(env, lg) {
  const fl = await floors(env), arr = Object.entries(fl.collections).filter(([, c]) => c.floor > 0).sort((a, b) => a[1].floor - b[1].floor).slice(0, 5);
  return `💸 <b>${X(lg, "أرخص هدايا معروضة الآن (الأسواق الخمسة)", "Cheapest listings now (all 5 markets)")}</b>\n` + arr.map(([n, c]) => `• ${esc(n)}: <b>${fmt(c.floor)}</b> TON · ${MK[c.market] || c.market}`).join("\n");
}

async function handleReport(env, msg, p, lg, isGroup) { // p: {kind,bg,slug,rest}
  const chat = msg.chat.id, reply = isGroup ? { reply_to_message_id: msg.message_id } : {};
  const send = t => say(env, chat, t, reply);
  if (p.kind === "top") return send(await rTop(env, lg));
  if (!p.slug) {
    if (p.kind === "floor") return send(p.rest.length && !["عام", "general"].includes(p.rest[0]) ? NA(lg, X(lg, "فلور الخلفيات", "Backdrop floors")) : await rCheapest(env, lg));
    return send(X(lg, "ابعت الكلمة ومعاها رابط الهدية، مثلاً: ", "Send the word with a gift link, e.g. ") + "<code>floor t.me/nft/PlushPepe-1234</code>");
  }
  const g = await resolveGift(env, p.slug); if (!g) return send(tr(lg, "nofound"));
  if (p.kind === "floor") return send(rFloor(g, lg, p.bg));
  if (p.kind === "sales") return send(rSales(g, lg, p.bg));
  if (p.kind === "supply") return send(rSupply(g, lg));
  if (p.kind === "order") return send(head(g, lg) + "\n\n" + NA(lg, X(lg, "أعلى أوردر في MRKT وPortals", "Top orders on MRKT / Portals")));
  if (p.kind === "holders") return send(head(g, lg) + "\n\n" + NA(lg, X(lg, "الحاملين", "Holders")));
  if (p.kind === "alert") return askAlert(env, msg, g, p, lg, isGroup);
}

// تنبيه على الهدية/النموذج بالسعر (في الخاص فقط)
async function askAlert(env, msg, g, p, lg, isGroup) {
  if (isGroup) return say(env, msg.chat.id, X(lg, "التنبيهات في الخاص فقط، كلم البوت برسالة خاصة.", "Alerts work in private chat only."));
  const price = parseFloat((p.rest.join(" ").match(/\d+(?:[.,]\d+)?/) || [""])[0].replace(",", "."));
  if (!(price > 0)) return say(env, msg.chat.id, X(lg, "اكتب السعر بالتون بعد الرابط، مثلاً: ", "Add a TON price after the link, e.g. ") + "<code>تنبيه t.me/nft/PlushPepe-1234 3000</code>");
  const id = Math.random().toString(36).slice(2, 10);
  await env.ALERTS.put("p:" + id, JSON.stringify({ u: msg.from.id, c: g.col, m: g.model || null, p: price, l: lg }), { expirationTtl: 3600 });
  const row = [{ text: X(lg, "🎁 الهدية (الكوليكشن)", "🎁 Collection"), callback_data: "al:" + id + ":c" }];
  if (g.model) row.push({ text: X(lg, "🧩 النموذج", "🧩 Model") + " " + g.model, callback_data: "al:" + id + ":m" });
  return say(env, msg.chat.id, X(lg, `تنبيه لما الفلور ينزل لـ <b>${fmt(price)}</b> TON أو أقل. على إيه؟`, `Alert when the floor drops to <b>${fmt(price)}</b> TON or below. On what?`), { reply_markup: { inline_keyboard: [row] } });
}
async function onCallback(env, cq) {
  const d = String(cq.data || "").match(/^al:(\w+):([cm])$/); if (!d) return tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
  const raw = await env.ALERTS.get("p:" + d[1]); if (!raw) return tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "⏳ expired" });
  const o = JSON.parse(raw); if (o.u !== cq.from.id) return tg(env, "answerCallbackQuery", { callback_query_id: cq.id });
  const arr = await getAlerts(env, o.u); if (arr.length >= MAX_ALERTS) return tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "limit" });
  const al = { c: o.c, op: "<=", p: o.p, l: o.l, t: Date.now() }; if (d[2] === "m" && o.m) al.m = o.m;
  arr.push(al); await putAlerts(env, o.u, arr); await env.ALERTS.delete("p:" + d[1]);
  await tg(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "✅" });
  await say(env, o.u, "✅ " + esc(o.c) + (al.m ? " · " + esc(al.m) : "") + " ≤ <b>" + fmt(o.p) + "</b> TON");
}

// ---------- فحص التنبيهات (Cron) ----------
async function checkAlerts(env) {
  const fl = await floors(env).catch(() => ({ collections: {} })), cols = fl.collections || {};
  await checkPumps(env, cols).catch(e => console.log("pump err", e && e.message));
  const users = []; let cursor;
  do {
    const page = await env.ALERTS.list({ prefix: "a:", cursor });
    for (const k of page.keys) { try { users.push([k.name.slice(2), JSON.parse(await env.ALERTS.get(k.name)) || []]); } catch {} }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  const ids = [...new Set(users.flatMap(([, arr]) => arr.filter(a => a.k === "coin").map(a => a.id)))];
  let cp = {}; for (let i = 0; i < ids.length; i += 100) cp = { ...cp, ...(await coinPrices(ids.slice(i, i + 100)).catch(() => ({}))) };
  let opps = null; if (users.some(([, arr]) => arr.some(a => a.t === "deal" || a.t === "vol"))) opps = await getJSON(env, "opps.json").catch(() => null);
  for (const [chat, arr] of users) {
    const keep = []; let changed = false;
    for (const a of arr) {
      if (a.t) { // نسبة تغير / فرصة / مبيعات
        const c = cols[a.c], oc = opps && opps.cols && opps.cols[a.c]; let hitT = false, val = null;
        if (a.t === "drop" || a.t === "rise") { if (c && c.p24 > 0 && c.floor > 0) { val = (c.floor - c.p24) / c.p24 * 100; hitT = a.t === "drop" ? val <= -a.p : val >= a.p; } }
        else if (a.t === "deal") { if (oc && oc.disc != null) { val = oc.disc; hitT = val >= a.p; } }
        else if (a.t === "vol") { if (oc) { val = oc.c1; hitT = val >= a.p; } }
        if (!hitT) { keep.push(a); continue; }
        const lg2 = a.l || "en", extra = a.t === "vol" ? `${val} ${X(lg2, "عملية", "sales")}` : `${val > 0 && a.t !== "deal" ? "+" : ""}${val.toFixed(1)}%`;
        const r = await say(env, chat, `🔔 <b>${esc(a.c)}</b> — ${alertText(a, lg2).replace(/^.*?(?= [⬇⬆🏷📈])/, "")}\n${X(lg2, "الآن", "Now")}: <b>${extra}</b>` + (c ? ` · ${X(lg2, "الفلور", "floor")} ${fmt(c.floor)} TON` : ""));
        if (r && r.error_code === 429) { keep.push(a); continue; }
        changed = true; continue;
      }
      const coin = a.k === "coin", f = coin ? (cp[a.id] && cp[a.id].usd) : a.m ? (cols[a.c] && cols[a.c].models && cols[a.c].models[a.m] && cols[a.c].models[a.m].p) : (cols[a.c] && cols[a.c].floor);
      const hit = f > 0 && (a.op === "<=" ? f <= a.p : f >= a.p);
      if (!hit) { keep.push(a); continue; }
      const sym = a.op === "<=" ? "≤" : "≥", lg = a.l || "en";
      const r = coin
        ? await say(env, chat, tr(lg, "hitc", { c: esc(coinLabel(a)), f: usd(f), op: sym, p: usd(a.p) }))
        : await say(env, chat, tr(lg, "hit", { c: esc(a.c + (a.m ? " · " + a.m : "")), f: fmt(f), op: sym, p: fmt(a.p), m: MK[cols[a.c].market] || cols[a.c].market }));
      if (r && r.error_code === 429) { keep.push(a); continue; } // نعيد المحاولة في الدورة الجاية
      changed = true; // أُرسل، أو المستخدم حاجب البوت: نحذف التنبيه في الحالتين
    }
    if (changed) await putAlerts(env, chat, keep);
  }
}

// ---------- إشعارات الارتفاع للجروبات/القنوات (صورة شارت) ----------
async function checkPumps(env, cols) {
  const names = Object.keys(cols).filter(n => cols[n].floor > 0);
  const cur = {}; for (const n of names) cur[n] = cols[n].floor;
  const prev = await env.ALERTS.get("snap", "json").catch(() => null), now = Date.now();
  if (prev && JSON.stringify(prev.f) === JSON.stringify(cur)) return;
  await env.ALERTS.put("snap", JSON.stringify({ ts: now, f: cur }));
  if (!prev) return;
  const watchers = []; let cursor;
  do { const pg = await env.ALERTS.list({ prefix: "w:", cursor }); for (const k of pg.keys) { try { watchers.push([k.name.slice(2), JSON.parse(await env.ALERTS.get(k.name))]); } catch {} } cursor = pg.list_complete ? null : pg.cursor; } while (cursor);
  if (!watchers.length) return;
  const minTh = Math.min(...watchers.map(([, w]) => w.th));
  const mins = Math.max(1, Math.round((now - prev.ts) / 60000));
  const pumps = names.filter(n => prev.f[n] > 0 && (cur[n] - prev.f[n]) / prev.f[n] * 100 >= minTh)
    .map(n => ({ n, o: prev.f[n], c: cur[n], pct: (cur[n] - prev.f[n]) / prev.f[n] * 100 })).sort((a, b) => b.pct - a.pct).slice(0, 2);
  for (const p of pumps) {
    let pts = []; try { const h = await getJSON(env, "h/" + norm(p.n) + ".json"); if (h && h.t && h.l) for (let i = Math.max(0, h.t.length - 60); i < h.t.length; i++) if (h.l[i] > 0) pts.push(h.l[i]); } catch {}
    if (pts.length < 2) pts = [p.o, p.c]; else pts[pts.length - 1] = p.c;
    const cfg = { type: "line", data: { labels: pts.map(() => ""), datasets: [{ data: pts, borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.15)", borderWidth: 6, pointRadius: 0, fill: true, lineTension: 0.25 }] },
      options: { legend: { display: false }, title: { display: true, text: `\u{1F48E} @ARBTON \u00B7 ${p.n} ${fmt(p.c)} +${p.pct.toFixed(2)}%`, fontSize: 30, fontColor: "#ffffff" },
        scales: { xAxes: [{ display: false }], yAxes: [{ gridLines: { color: "#2a2a30" }, ticks: { fontColor: "#d0d3d8", fontSize: 22 } }] } } };
    const photo = "https://quickchart.io/chart?v=2.9.4&bkg=%230b0b0d&w=800&h=450&c=" + encodeURIComponent(JSON.stringify(cfg));
    for (const [chat, w] of watchers.slice(0, 12)) {
      if (p.pct < w.th) continue;
      const lg = w.l || "en", kb = env.MINIAPP_URL ? { inline_keyboard: [[{ text: X(lg, "📈 فتح الشارت", "📈 Open chart"), url: `https://t.me/${env.BOT_USERNAME}?startapp=g_${encodeURIComponent(norm(p.n))}` }]] } : undefined;
      const cap = `\u{1F4C8} <b>${esc(p.n)}</b> +${p.pct.toFixed(2)}% ${X(lg, "خلال", "in")} ${mins} ${X(lg, "دقيقة", "min")}\n${fmt(p.o)} \u2192 <b>${fmt(p.c)}</b> TON \u{1F48E}\n@ARBTON`;
      const r = await tg(env, "sendPhoto", { chat_id: chat, photo, caption: cap, parse_mode: "HTML", ...(kb ? { reply_markup: kb } : {}) });
      if (r && r.ok === false && /kicked|not found|forbidden|chat_write/i.test(r.description || "")) await env.ALERTS.delete("w:" + chat);
    }
  }
}

// ---------- API للتطبيق (initData) ----------
const enc = new TextEncoder();
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, typeof data === "string" ? enc.encode(data) : data));
}
const hex = b => [...b].map(x => x.toString(16).padStart(2, "0")).join("");
async function verifyInit(env, initData) {
  const p = new URLSearchParams(initData || ""), h = p.get("hash"); if (!h) return null;
  p.delete("hash");
  const dcs = [...p.entries()].map(([k, v]) => k + "=" + v).sort().join("\n");
  const secret = await hmac(enc.encode("WebAppData"), env.BOT_TOKEN);
  if (hex(await hmac(secret, dcs)) !== h) return null;
  if (Date.now() / 1000 - Number(p.get("auth_date") || 0) > 86400) return null;
  try { return JSON.parse(p.get("user")); } catch { return null; }
}
const cors = env => ({ "access-control-allow-origin": env.ALLOWED_ORIGIN || "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" });
const json = (env, o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...cors(env) } });

async function api(env, req, path) {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(env) });
  if (req.method !== "POST") return json(env, { ok: false }, 405);
  const len = +req.headers.get("content-length") || 0;
  if (len > 8_000_000) return json(env, { ok: false, error: "too_large" }, 413);
  let b; try { b = await req.json(); } catch { return json(env, { ok: false }, 400); }
  const u = await verifyInit(env, b.initData); if (!u) return json(env, { ok: false, error: "auth" }, 401);
  const lg = lang(u);
  if (path === "/api/photo") {
    const m = String(b.image || "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/); if (!m) return json(env, { ok: false, error: "image" }, 400);
    const bin = Uint8Array.from(atob(m[1]), c => c.charCodeAt(0));
    const send = async method => {
      const f = new FormData(); f.append("chat_id", String(u.id)); f.append("caption", String(b.caption || "@ARBTON").slice(0, 200));
      f.append(method === "sendPhoto" ? "photo" : "document", new Blob([bin], { type: "image/png" }), "arbton.png");
      return (await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: "POST", body: f })).json();
    };
    let r = await send("sendPhoto"); if (!r.ok) r = await send("sendDocument");
    return json(env, { ok: !!r.ok });
  }
  if (path === "/api/alerts") {
    const act = b.action;
    if (act === "add") {
      const p = Number(b.price), op = b.op === ">=" ? ">=" : "<=", sym = op === "<=" ? "≤" : "≥";
      if (!(p > 0)) return json(env, { ok: false, error: "bad" }, 400);
      const arr = await getAlerts(env, u.id); if (arr.length >= MAX_ALERTS) return json(env, { ok: false, error: "limit" });
      if (b.kind === "coin") {
        const id = String(b.coinId || ""), pr = (await coinPrices([id]).catch(() => ({})))[id];
        if (!pr) return json(env, { ok: false, error: "bad" }, 400);
        const al = { k: "coin", id, n: String(b.name || id).slice(0, 40), s: String(b.symbol || "").toUpperCase().slice(0, 12), op, p, l: lg, t: Date.now() };
        arr.push(al); await putAlerts(env, u.id, arr);
        await say(env, u.id, tr(lg, "setc", { c: esc(coinLabel(al)), op: sym, p: usd(p), f: usd(pr.usd) }));
        return json(env, { ok: true, alerts: arr });
      }
      const fl = await floors(env), name = findCollection(fl, b.gift || ""); if (!name) return json(env, { ok: false, error: "bad" }, 400);
      if (["drop", "rise", "deal", "vol"].includes(b.type)) {
        arr.push({ c: name, t: b.type, p, l: lg, t0: Date.now() }); await putAlerts(env, u.id, arr);
        await say(env, u.id, "✅ " + alertText({ c: name, t: b.type, p }, lg));
        return json(env, { ok: true, alerts: arr });
      }
      arr.push({ c: name, op, p, l: lg, t: Date.now() }); await putAlerts(env, u.id, arr);
      await say(env, u.id, tr(lg, "set", { c: esc(name), op: sym, p: fmt(p), f: fmt(fl.collections[name].floor) }));
      return json(env, { ok: true, alerts: arr });
    }
    if (act === "del") { const arr = await getAlerts(env, u.id); arr.splice(+b.index, 1); await putAlerts(env, u.id, arr); return json(env, { ok: true, alerts: arr }); }
    return json(env, { ok: true, alerts: await getAlerts(env, u.id) });
  }
  return json(env, { ok: false }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    try {
      if (url.pathname === "/webhook/" + env.WEBHOOK_SECRET && req.method === "POST") {
        const up = await req.json();
        if (up.callback_query) ctx.waitUntil(onCallback(env, up.callback_query).catch(e => console.log("cb err", e && e.message)));
        if (up.message || up.channel_post) ctx.waitUntil(onMessage(env, up.message || up.channel_post).catch(e => console.log("err", e && e.message)));
        return new Response("ok");
      }
      if (url.pathname.startsWith("/api/")) return await api(env, req, url.pathname);
      if (url.pathname === "/setup" && url.searchParams.get("key") === env.WEBHOOK_SECRET) { // يضبط الـ webhook تلقائيًا
        const r = await tg(env, "setWebhook", { url: `${url.origin}/webhook/${env.WEBHOOK_SECRET}`, allowed_updates: ["message", "channel_post", "callback_query"] });
        await tg(env, "setMyCommands", { commands: [
          { command: "alert", description: "Price alert: /alert plush pepe 3000 or /alert btc 100000" }, { command: "alerts", description: "My alerts" },
          { command: "floor", description: "Gift floor or coin price" }, { command: "price", description: "Coin price: /price btc" }, { command: "sales", description: "Sales by gift link" }, { command: "get", description: "Full gift report: /get t.me/nft/..." }, { command: "getn", description: "Gift number report: /getN t.me/nft/..." }, { command: "watch", description: "Group/channel: pump alerts with chart" }, { command: "help", description: "Help" }] });
        return new Response(JSON.stringify(r), { headers: { "content-type": "application/json" } });
      }
      return new Response("ARBTON worker");
    } catch (e) { return json(env, { ok: false, error: "server" }, 500); }
  },
  async scheduled(_ev, env, ctx) { ctx.waitUntil(checkAlerts(env).catch(e => console.log("cron err", e && e.message))); }
};
