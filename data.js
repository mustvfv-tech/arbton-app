// ====== طبقة البيانات: العملات (CoinGecko + Binance) + الهدايا (TG Gifts حي، مع احتياطي تجريبي) ======
(function () {
  const cache = new Map();
  async function getJSON(url, ttl) {
    const c = cache.get(url);
    if (c && Date.now() - c.t < (ttl || 30000)) return c.d;
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    cache.set(url, { t: Date.now(), d: d });
    return d;
  }
  function clean(arr) {
    arr.sort(function (a, b) { return a.time - b.time; });
    return arr.filter(function (x, i) { return i === 0 || x.time !== arr[i - 1].time; });
  }

  // ---------- Crypto ----------
  const TF = { '5m': ['5m', 300], '15m': ['15m', 300], '1h': ['1h', 300], '4h': ['4h', 300],
               '1d': ['1d', 200], '1w': ['1w', 150], '1M': ['1M', 60], '1Y': ['1d', 365] };
  const GECKO_DAYS = { '5m': 1, '15m': 1, '1h': 7, '4h': 30, '1d': 90, '1w': 365, '1M': 365, '1Y': 365 };
  const Crypto = {
    markets: function () {
      return getJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h', 60000);
    },
    search: function (q) {
      return getJSON('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(q), 120000).then(function (j) { return (j && j.coins) || []; });
    },
    byId: function (id) {
      return getJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + encodeURIComponent(id) + '&price_change_percentage=24h', 60000).then(function (a) { return a && a[0]; });
    },
    global: function () {
      return getJSON('https://api.coingecko.com/api/v3/global', 60000).then(function (j) { return j.data; });
    },
    candles: async function (symbol, id, tf) {
      const cfg = TF[tf], iv = cfg[0], limit = cfg[1];
      const pair = symbol.toUpperCase() + 'USDT';
      const hosts = ['https://data-api.binance.vision', 'https://api.binance.com'];
      for (let i = 0; i < hosts.length; i++) {
        try {
          const r = await fetch(hosts[i] + '/api/v3/klines?symbol=' + pair + '&interval=' + iv + '&limit=' + limit);
          if (!r.ok) continue;
          const k = await r.json();
          if (Array.isArray(k) && k.length) {
            return clean(k.map(function (x) {
              return { time: Math.floor(x[0] / 1000), open: +x[1], high: +x[2], low: +x[3], close: +x[4] };
            }));
          }
        } catch (e) { /* جرّب المصدر التالي */ }
      }
      const o = await getJSON('https://api.coingecko.com/api/v3/coins/' + id + '/ohlc?vs_currency=usd&days=' + GECKO_DAYS[tf], 60000);
      return clean(o.map(function (x) {
        return { time: Math.floor(x[0] / 1000), open: x[1], high: x[2], low: x[3], close: x[4] };
      }));
    }
  };

  // =====================================================================
  //  Gifts — المصدر الحي: TG Gifts (tggifts.com) — ترخيص CC BY 4.0
  //  سعر الصرف: Baltic Assets (balticassets.eu) — ترخيص CC BY 4.0
  //  ملاحظة: شكل الـ JSON الفعلي لم يُفحص مباشرة، فالمحوّل أدناه مرن
  //  ويقبل أكثر من شكل. لو فشل بيرجع للتجريبي ويعرض السبب.
  // =====================================================================
  const FLOOR_URLS = [
    'https://tggifts.com/data/floors-daily.json',
    'https://raw.githubusercontent.com/w3radar/telegram-gift-floors/main/data/floors-daily.json'
  ];
  const MODEL_URLS = ['https://tggifts.com/data/models-daily.json'];
  const RATE_URL = 'https://atlannn.github.io/telegram-gifts-floor-price/api/v1/latest.json';
  // الصور والأسماء الرسمية: Gift Changes (cdn.changes.tg / api.changes.tg) — مجاني بشرط ذكر @GiftChanges
  // أسعار الأسواق (Gift Satellite) بتتحدّث كل ~30 دقيقة بواسطة GitHub Actions وتتخزن في الريبو نفسه
  // الداتا بتتنشر في فرع data (raw.githubusercontent.com). بنستنتج المسار من رابط GitHub Pages، أو من CONFIG.DATA_BASE
  function dataBase() {
    const c = window.CONFIG && window.CONFIG.DATA_BASE;
    if (c) return String(c).replace(/\/?$/, '/');
    try {
      const h = location.hostname;
      if (/\.github\.io$/.test(h)) {
        const repo = location.pathname.split('/')[1];
        if (repo) return 'https://raw.githubusercontent.com/' + h.split('.')[0] + '/' + repo + '/data/';
      }
    } catch (e) {}
    return 'data/';
  }
  const FLOORS_URL = dataBase() + 'floors.json';
  const dataCache = {};
  function dataGet(path) {
    const k = path + '|' + Math.floor(Date.now() / 300000);
    if (!dataCache[k]) dataCache[k] = fetch(dataBase() + path + '?t=' + Math.floor(Date.now() / 300000))
      .then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return null; });
    return dataCache[k];
  }
  // صور مصغّرة عبر wsrv.nl (أخف بكتير من PNG الأصلي 300KB+، وبيدعم CORS للتصدير)
  function thumb(u, w, fmt) { return 'https://wsrv.nl/?url=' + encodeURIComponent(u) + '&w=' + (w || 160) + '&output=' + (fmt || 'webp') + '&q=85'; }
  const MARKET_LABEL = { portals: 'Portals', tonnel: 'Tonnel', mrkt: 'MRKT', getgems: 'GetGems', tg: 'Telegram' };
  const NAME_URLS = ['https://api.changes.tg/names', 'https://cdn.changes.tg/gifts/id-to-name.json'];
  // الأسماء الرسمية (أسماء مجلدات cdn.changes.tg/gifts/models/) — نسخة ثابتة عشان مفيش اعتماد على طلب شبكة
  const OFFICIAL = ("Algorithm Cup|Artisan Brick|Astral Shard|B-Day Candle|Berry Box|Big Year|Bling Binky|Bonded Ring|Bow Tie|Bunny Muffin|Candy Cane|Chill Flame|Clover Pin|Cookie Heart|Crystal Ball|Cupid Charm|Desk Calendar|Diamond Ring|Durov's Cap|Durov's Glasses|Easter Egg|Electric Skull|Eternal Candle|Eternal Rose|Evil Eye|Faith Amulet|Fine Pen|Flying Broom|Fresh Socks|Gem Signet|Genie Lamp|Ginger Cookie|Hanging Star|Happy Brownie|Heart Locket|Heroic Helmet|Hex Pot|Holiday Drink|Homemade Cake|Hypno Lollipop|Ice Cream|Input Key|Instant Ramen|Intelligence Cup|Ion Gem|Ionic Dryer|Jack-in-the-Box|Jelly Bunny|Jester Hat|Jingle Bells|Jolly Chimp|Joyful Bundle|Khabib's Papakha|Kissed Frog|Liberty Figure|Light Sword|Lol Pop|Loot Bag|Love Candle|Love Potion|Low Rider|Lucky Locket|Lunar Snake|Lush Bouquet|Mad Pumpkin|Magic Potion|Mighty Arm|Mini Oscar|Mirage Lamp|Money Pot|Mood Pack|Moon Pendant|Mousse Cake|Myth Mask|Nail Bracelet|Neko Helmet|Party Sparkler|Perfume Bottle|Pet Snake|Plush Pepe|Pool Float|Precious Peach|Pretty Posy|Rare Bird|Record Player|Resistance Dog|Restless Jar|Sakura Flower|Santa Hat|Scared Cat|Sharp Tongue|Signet Ring|Skull Flower|Sky Stilettos|Sleigh Bell|Snake Box|Snoop Cigar|Snoop Dogg|Snow Globe|Snow Mittens|Spiced Wine|Spring Basket|Spy Agaric|Star Notepad|Stellar Rocket|Surge Board|Swag Bag|Swiss Watch|Tama Gadget|Timeless Book|Top Hat|Toy Bear|Trapped Heart|UFC Strike|Valentine Box|Vice Cream|Victory Medal|Vintage Cigar|Voodoo Doll|Westside Sign|Whip Cupcake|Winter Wreath|Witch Hat|Xmas Stocking").split('|');
  const API = 'https://api.changes.tg';
  const CDN_MODELS = 'https://cdn.changes.tg/gifts/models/';
  const norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  function nameMap(json) {
    const out = {};
    const vals = Array.isArray(json) ? json : (isObj(json) ? Object.keys(json).map(function (k) { return json[k]; }) : []);
    vals.forEach(function (v) { if (typeof v === 'string' && v) out[norm(v)] = v; });
    return out;
  }

  const num = function (v) { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && isFinite(n) ? n : null; };
  const isObj = function (v) { return v && typeof v === 'object' && !Array.isArray(v); };
  const hostOf = function (u) { try { return new URL(u).host; } catch (e) { return u; } };
  const prettify = function (s) { return String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
  function toSec(d) {
    if (d == null) return null;
    if (typeof d === 'number') return d > 1e12 ? Math.floor(d / 1000) : d;
    const ms = Date.parse(d);
    return isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  function pointOf(p) {
    if (Array.isArray(p)) {
      const t = toSec(p[0]), f = num(p[1]);
      return t != null && f != null ? { time: t, floor: f, sales: null } : null;
    }
    if (!isObj(p)) return null;
    const t = toSec(p.date != null ? p.date : p.day != null ? p.day : p.time != null ? p.time : p.t != null ? p.t : p.timestamp);
    const f = num(p.floor_gram != null ? p.floor_gram : p.floor != null ? p.floor : p.price != null ? p.price : p.f);
    if (t == null || f == null) return null;
    return { time: t, floor: f, sales: num(p.recent_sales != null ? p.recent_sales : p.sales) };
  }
  function pointsOf(arr) { return arr.map(pointOf).filter(Boolean).sort(function (a, b) { return a.time - b.time; }); }
  function findSeries(c) {
    const keys = ['history', 'points', 'series', 'data', 'floors', 'daily', 'prices'];
    for (let i = 0; i < keys.length; i++) {
      if (Array.isArray(c[keys[i]])) { const p = pointsOf(c[keys[i]]); if (p.length) return p; }
    }
    for (const k in c) {
      if (Array.isArray(c[k]) && c[k].length && pointOf(c[k][0])) { const p = pointsOf(c[k]); if (p.length) return p; }
    }
    const f = num(c.floor_gram != null ? c.floor_gram : c.floor);
    if (f != null) {
      const t = toSec(c.date != null ? c.date : c.updated != null ? c.updated : c.updated_at);
      return [{ time: t != null ? t : Math.floor(Date.now() / 1000), floor: f, sales: num(c.recent_sales) }];
    }
    return [];
  }
  function unwrap(json) {
    let r = json;
    const wrap = ['collections', 'data', 'items', 'floors', 'models', 'result'];
    for (let i = 0; i < 2; i++) {
      if (isObj(r)) {
        for (let j = 0; j < wrap.length; j++) {
          if (r[wrap[j]] && typeof r[wrap[j]] === 'object') { r = r[wrap[j]]; break; }
        }
      }
    }
    return r;
  }
  function extractCollections(json) {
    const root = unwrap(json), map = new Map();
    function add(slug, name, pts) {
      if (!slug || !pts.length) return;
      slug = String(slug);
      const e = map.get(slug) || { slug: slug, name: name || prettify(slug), points: [] };
      e.points = e.points.concat(pts);
      if (name) e.name = name;
      map.set(slug, e);
    }
    if (Array.isArray(root)) {
      root.forEach(function (c) {
        if (!isObj(c)) return;
        const slug = c.collection_slug != null ? c.collection_slug : c.slug != null ? c.slug : c.id != null ? c.id : c.collection;
        const name = c.collection_name != null ? c.collection_name : c.name != null ? c.name : c.title;
        const hasArr = ['history', 'points', 'series', 'data'].some(function (k) { return Array.isArray(c[k]); });
        const single = pointOf(c);
        add(slug, name, hasArr ? findSeries(c) : (single ? [single] : findSeries(c)));
      });
    } else if (isObj(root)) {
      for (const k in root) {
        const c = root[k];
        if (Array.isArray(c)) add(k, null, pointsOf(c));
        else if (isObj(c)) add(c.slug != null ? c.slug : c.collection_slug != null ? c.collection_slug : k,
                               c.name != null ? c.name : c.collection_name != null ? c.collection_name : c.title, findSeries(c));
      }
    }
    const out = [];
    map.forEach(function (e) {
      e.points.sort(function (a, b) { return a.time - b.time; });
      e.points = e.points.filter(function (p, i, a) { return i === 0 || p.time !== a[i - 1].time; });
      out.push(e);
    });
    return out;
  }
  function modelOf(m) {
    if (!isObj(m)) return null;
    const name = m.model != null ? m.model : m.model_name != null ? m.model_name : m.name;
    const floor = num(m.floor_gram != null ? m.floor_gram : m.floor);
    if (!name || floor == null) return null;
    return { name: String(name), rarity: num(m.rarity_permille != null ? m.rarity_permille : m.rarity != null ? m.rarity : m.permille),
             floor: floor, listings: num(m.buy_now_listings != null ? m.buy_now_listings : m.listings),
             time: toSec(m.date != null ? m.date : m.day) };
  }
  function extractModels(json) {
    const root = unwrap(json), out = {};
    function put(slug, m) {
      if (!slug || !m) return;
      const a = out[slug] || (out[slug] = {});
      const old = a[m.name];
      if (!old || (m.time || 0) >= (old.time || 0)) a[m.name] = m;
    }
    if (Array.isArray(root)) {
      root.forEach(function (r) {
        if (!isObj(r)) return;
        const slug = r.collection_slug != null ? r.collection_slug : r.slug != null ? r.slug : r.collection;
        const arr = r.models || r.items;
        if (Array.isArray(arr)) arr.forEach(function (m) { put(slug, modelOf(m)); });
        else put(slug, modelOf(r));
      });
    } else if (isObj(root)) {
      for (const k in root) {
        const c = root[k];
        const arr = Array.isArray(c) ? c : (isObj(c) ? (c.models || c.items) : null);
        const slug = (isObj(c) && (c.slug || c.collection_slug)) || k;
        if (Array.isArray(arr)) arr.forEach(function (m) { put(slug, modelOf(m)); });
      }
    }
    const res = {};
    for (const s in out) res[s] = Object.keys(out[s]).map(function (n) { return out[s][n]; });
    return res;
  }
  function buildGifts(cols) {
    return cols.map(function (c) {
      const p = c.points, last = p[p.length - 1], prev = p.length > 1 ? p[p.length - 2] : null;
      const ch = prev && prev.floor > 0 ? Math.round((last.floor - prev.floor) / prev.floor * 10000) / 100 : 0;
      return { id: c.slug, name: c.name, floor: last.floor, change: ch, sales: last.sales, points: p };
    }).filter(function (g) { return g.floor > 0; });
  }
  // تحويل نقاط يومية إلى شموع: 1d = كل يوم، 1w = أسبوع، 1M = شهر
  function toCandles(points, tf) {
    const keyOf = tf === '1w' ? function (t) { return Math.floor(t / 604800); }
      : tf === '1M' ? function (t) { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
      : function (t) { return t; };
    const groups = []; let lastKey = null;
    points.forEach(function (p) {
      const k = keyOf(p.time);
      if (k !== lastKey) { groups.push({ time: p.time, vals: [p.floor] }); lastKey = k; }
      else groups[groups.length - 1].vals.push(p.floor);
    });
    let prevClose = null;
    return groups.map(function (g) {
      const open = prevClose != null ? prevClose : g.vals[0];
      const close = g.vals[g.vals.length - 1];
      const hi = Math.max.apply(null, g.vals.concat([open])), lo = Math.min.apply(null, g.vals.concat([open]));
      prevClose = close;
      return { time: g.time, open: open, high: hi, low: lo, close: close };
    });
  }
  // ---- مساعدات الشارت ----
  const STEP = { '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800 };
  function bucketKey(t, tf) {
    if (tf === '1M') { const d = new Date(t * 1000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000; }
    const s = STEP[tf] || 86400; return Math.floor(t / s) * s;
  }
  // نقاط [{t,v}] مرتبة تصاعدياً → شموع. carry=true: افتتاح الشمعة = إغلاق اللي قبلها (للفلور المستمر)
  function toOHLC(pts, tf, carry) {
    const out = []; let cur = null, prevClose = null;
    pts.forEach(function (p) {
      const k = bucketKey(p.t, tf);
      if (!cur || cur.time !== k) {
        if (cur) { prevClose = cur.close; out.push(cur); }
        const o = carry && prevClose != null ? prevClose : p.v;
        cur = { time: k, open: o, high: Math.max(o, p.v), low: Math.min(o, p.v), close: p.v };
      } else { cur.high = Math.max(cur.high, p.v); cur.low = Math.min(cur.low, p.v); cur.close = p.v; }
    });
    if (cur) out.push(cur);
    return out;
  }
  function mkey(m) { m = String(m || '').toLowerCase(); return m === 'telegram' ? 'tg' : m; }
  function floorPoints(h, market, model) {
    const arr = model ? (h.md && h.md[model]) : (market === 'all' ? h.l : h[market]);
    const out = [];
    if (!arr || !h.t) return out;
    for (let i = 0; i < h.t.length; i++) if (arr[i] > 0) out.push({ t: h.t[i], v: arr[i] });
    return out;
  }
  function salesPoints(sj, market, model) {
    return sj.s.filter(function (x) { return x[1] > 0 && (market === 'all' || mkey(x[2]) === market) && (!model || x[4] === model); })
      .map(function (x) { return { t: x[0], v: x[1] }; }).sort(function (a, b) { return a.t - b.t; });
  }
  function volumeStats(rows) {
    const now = Math.floor(Date.now() / 1000), W = { d1: 86400, d7: 604800, d30: 2592000 }, out = {};
    Object.keys(W).concat(['all']).forEach(function (k) {
      const r = k === 'all' ? rows : rows.filter(function (x) { return x[0] >= now - W[k]; });
      const vol = r.reduce(function (a, x) { return a + x[1]; }, 0);
      out[k] = { n: r.length, vol: vol, avg: r.length ? vol / r.length : 0,
                 hi: r.length ? Math.max.apply(null, r.map(function (x) { return x[1]; })) : 0,
                 lo: r.length ? Math.min.apply(null, r.map(function (x) { return x[1]; })) : 0 };
    });
    const by = {};
    rows.forEach(function (x) { const m = mkey(x[2]) || '?'; (by[m] || (by[m] = { n: 0, vol: 0 })); by[m].n++; by[m].vol += x[1]; });
    out.by = by;
    return out;
  }
  function findRate(j) {
    const cand = [j, j && j.rates, j && j.rate, j && j.fx, j && j.gram, j && j.meta, j && j.data && j.data.rates];
    const keys = ['usd', 'USD', 'gram_usd', 'gram_usd_rate', 'rate_usd', 'usd_rate'];
    for (let i = 0; i < cand.length; i++) {
      if (!isObj(cand[i])) continue;
      for (let k = 0; k < keys.length; k++) {
        const n = num(cand[i][keys[k]]);
        if (n != null && n > 0.01 && n < 1000) return n;
      }
    }
    return null;
  }
  async function firstJSON(urls) {
    const errs = [];
    for (let i = 0; i < urls.length; i++) {
      try {
        const r = await fetch(urls[i]);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return { json: await r.json(), url: urls[i] };
      } catch (e) { errs.push((e && e.message ? e.message : 'fetch failed') + ' (' + hostOf(urls[i]) + ')'); }
    }
    throw new Error(errs.join(' · ') || 'no source');
  }
  // دمج أسعار الأسواق: السعر المعروض = أقل فلور بين الأسواق، وكل سوق بسعره
  function applyMarkets(gifts, fl) {
    if (!isObj(fl) || !isObj(fl.collections)) return null;
    const idx = {};
    Object.keys(fl.collections).forEach(function (k) { idx[norm(k)] = fl.collections[k]; });
    let hit = 0;
    gifts.forEach(function (g) {
      const e = idx[norm(g.official)] || idx[norm(g.name)] || idx[norm(g.id)];
      if (!e || !(e.floor > 0)) return;
      hit++;
      g.fragFloor = g.floor;           // فلور Fragment من TG Gifts (للمقارنة)
      g.floor = e.floor; g.best = e.market; g.markets = e.markets; g.mfl = e.models || {};
      // تغيّر 24 ساعة من لقطاتنا نحن (نفس مصدر السعر) لو متاح، وإلا بنسيب تغيّر TG Gifts اليومي
      if (e.p24 > 0) { g.change = Math.round((g.floor - e.p24) / e.p24 * 10000) / 100; g.chg24 = true; }
    });
    return { updated: fl.updated, hit: hit, total: Object.keys(fl.collections).length };
  }
  async function loadLive() {
    const f = await firstJSON(FLOOR_URLS);
    const gifts = buildGifts(extractCollections(f.json));
    if (!gifts.length) throw new Error('Unexpected data format (' + hostOf(f.url) + ')');
    const res = await Promise.all([
      firstJSON(MODEL_URLS).then(function (x) { return extractModels(x.json); }).catch(function () { return {}; }),
      fetch(RATE_URL).then(function (x) { return x.json(); }).then(findRate).catch(function () { return null; }),
      firstJSON(NAME_URLS).then(function (x) { return nameMap(x.json); }).catch(function () { return {}; }),
      fetch(FLOORS_URL + '?t=' + Math.floor(Date.now() / 300000)).then(function (x) { if (!x.ok) throw 0; return x.json(); }).catch(function () { return null; })
    ]);
    // الاسم الرسمي (زي "Plush Pepe") هو اللي بيتبني عليه مسار الصور في cdn.changes.tg
    const names = {};
    OFFICIAL.forEach(function (n) { names[norm(n)] = n; });
    Object.keys(res[2]).forEach(function (k) { names[k] = res[2][k]; });
    gifts.forEach(function (g) {
      const hit = names[norm(g.name)] || names[norm(g.id)];
      g.official = hit || g.name;
      if (hit) g.name = hit; // يعرض الاسم الرسمي (Plush Pepe) بدل الجمع (Plush Pepes)
    });
    const mk = applyMarkets(gifts, res[3]);
    return { gifts: gifts, models: res[0], rate: res[1], source: hostOf(f.url), mk: mk };
  }

  // ---------- Demo (احتياطي فقط) ----------
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  const SEED = [
    ['Plush Pepe', 6936, 4300], ['Heart Locket', 1539, 6400], ['Durov\'s Cap', 1220, 5200], ['Precious Peach', 980, 7100],
    ['Heroic Helmet', 860, 6800], ['Astral Shard', 790, 9000], ['Mini Oscar', 640, 8800], ['Perfume Bottle', 560, 9300],
    ['Vintage Cigar', 470, 10500], ['Swiss Watch', 455, 11200], ['Signet Ring', 420, 11800], ['Eternal Rose', 330, 15000],
    ['Neko Helmet', 310, 14200], ['Loot Bag', 295, 16000], ['Top Hat', 240, 18500], ['Diamond Ring', 215, 20000]
  ];
  const MODEL_NAMES = ['Aurora', 'Stripes', 'Midas', 'Frost', 'Ember', 'Jade', 'Onyx', 'Coral', 'Nova', 'Velvet', 'Mocha', 'Cobalt'];
  const RARITY = [0.5, 1, 1.5, 2, 3, 5, 8, 12];
  const day = Math.floor(Date.now() / 864e5);
  function dChange(key) {
    const r = rng(hash(key + day));
    if (r() < 0.2) return 0;
    return Math.round((r() - 0.45) * 1000) / 100;
  }
  const DEMO_LIST = SEED.map(function (s) {
    return { id: 'g' + hash(s[0]).toString(36), name: s[0], floor: s[1], supply: s[2], maxSupply: Math.round(s[2] * 1.12), change: dChange(s[0]) };
  });
  function demoModels(gid) {
    const g = DEMO_LIST.find(function (x) { return x.id === gid; });
    if (!g) return Promise.resolve([]);
    const r = rng(hash(g.id));
    return Promise.resolve(RARITY.map(function (ra, i) {
      const name = MODEL_NAMES[(i + Math.floor(r() * 4)) % MODEL_NAMES.length] + (i > 3 ? ' ' + (i - 2) : '');
      return { name: name, rarity: ra, floor: Math.round(g.floor * (0.8 + 0.6 / Math.max(ra, 0.5)) * 100) / 100, change: dChange(g.id + name) };
    }));
  }
  const GTF = { '1d': 86400, '1w': 604800, '1M': 2592000 };
  function demoChart(gid, model, tf, floor) {
    const step = GTF[tf] || 86400, n = 120;
    const r = rng(hash(gid + (model || '') + tf));
    let p = floor * (0.85 + r() * 0.3);
    const end = Math.floor(Date.now() / 1000 / step) * step, out = [];
    for (let i = n - 1; i >= 0; i--) {
      const o = p, c = o * (1 + (r() - 0.5) * 0.04);
      out.push({ time: end - i * step, open: o, high: Math.max(o, c) * (1 + r() * 0.01), low: Math.min(o, c) * (1 - r() * 0.01), close: c });
      p = c;
    }
    const k = floor / out[out.length - 1].close;
    out.forEach(function (x) { x.open *= k; x.high *= k; x.low *= k; x.close *= k; });
    return Promise.resolve(out);
  }

  // صور مؤقتة: مربع متدرج بحرف الاسم (الصور الحقيقية في خطوة لاحقة)
  function placeholder(name) {
    const h = hash(name) % 360;
    const m = name.match(/[A-Za-z؀-ۿЀ-ӿ]/);
    const ch = (m ? m[0] : '?').toUpperCase();
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='hsl(" + h + ",70%,60%)'/><stop offset='1' stop-color='hsl(" + ((h + 50) % 360) + ",70%,35%)'/></linearGradient></defs>" +
      "<rect width='100' height='100' rx='24' fill='url(#g)'/><text x='50' y='65' font-size='46' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='700'>" + ch + "</text></svg>";
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const G = {
    mode: 'demo', demo: true, err: null, source: '', hasSupply: true,
    tonUsd: 3, rateSrc: '', img: placeholder, _list: null, _live: null, mk: null, marketLabel: MARKET_LABEL,
    list: async function () {
      if (G._list) return G._list;
      try {
        const L = await loadLive();
        G._live = L; G.mode = 'live'; G.demo = false; G.err = null; G.source = L.source; G.hasSupply = false;
        if (L.rate) { G.tonUsd = L.rate; G.rateSrc = 'Baltic Assets'; }
        G.mk = L.mk;
        G._list = L.gifts;
        try { // see.tg: المعروض/الإجمالي + تغير 7/30 يوم لكل مجموعة (ملف صغير بيتحدث كل 3 ساعات)
          const sj = await dataGet('see.json');
          if (sj && sj.cols) L.gifts.forEach(function (g) {
            const c = sj.cols[norm(g.official || g.name)]; if (!c) return;
            g.issued = c.i; g.total = c.t; g.c7 = c.c7; g.c30 = c.c30; g.seeF = c.f; g.seeMk = c.mk;
            if (g.floor == null && c.f > 0) g.floor = c.f;
          });
        } catch (e) {}
      } catch (e) {
        G.mode = 'demo'; G.demo = true; G.hasSupply = true; G.source = '';
        G.err = String(e && e.message ? e.message : e);
        G._list = DEMO_LIST;
      }
      return G._list;
    },
    reset: function () { G._list = null; },
    // روابط الصور المحتملة بالترتيب (لو الأولى فشلت يجرب اللي بعدها، وبعدين المربع الملوّن)
    imgs: function (g, model) {
      const base = CDN_MODELS + encodeURIComponent(g.official || g.name) + '/png/';
      let urls;
      if (model) urls = [base + encodeURIComponent(model) + '.png'];
      else {
        urls = [base + 'Original.png'];
        const ms = G._live && G._live.models ? G._live.models[g.id] : null;
        if (ms && ms.length) urls.push(base + encodeURIComponent(ms[0].name) + '.png');
      }
      // المصغّرة أولاً، وبعدها الأصلية (لو الخدمة وقعت)
      return urls.map(function (u) { return thumb(u, 160); }).concat(urls);
    },
    // أسماء النماذج من Gift Changes (بدون أسعار): API أولاً ثم ملف models.json في الـ CDN
    modelNames: function (gid) {
      G._mn = G._mn || {};
      if (G._mn[gid]) return G._mn[gid];
      const g = (G._list || []).find(function (x) { return x.id === gid; });
      if (!g) return Promise.resolve([]);
      const nm = g.official || g.name;
      G._mn[gid] = firstJSON([API + '/models/' + encodeURIComponent(nm), CDN_MODELS + encodeURIComponent(nm) + '/models.json'])
        .then(function (x) {
          return (Array.isArray(x.json) ? x.json : []).map(function (m) {
            return { name: m.name || m.telegramName, rarity: num(m.rarityPermille != null ? m.rarityPermille : m.rarity) };
          }).filter(function (m) { return m.name; });
        }).catch(function () { return []; });
      return G._mn[gid];
    },
    firstModelImg: function (gid) {
      const g = (G._list || []).find(function (x) { return x.id === gid; });
      if (!g) return Promise.resolve(null);
      return G.modelNames(gid).then(function (ms) { return ms.length ? G.imgs(g, ms[0].name)[0] : null; });
    },
    models: async function (gid) {
      if (G.mode === 'demo') return demoModels(gid);
      const g = (G._list || []).find(function (x) { return x.id === gid; });
      let arr = ((G._live.models || {})[gid] || []).map(function (m) {
        return { name: m.name, rarity: m.rarity, floor: m.floor, change: null, listings: m.listings };
      });
      if (!arr.length) arr = (await G.modelNames(gid)).map(function (m) { return { name: m.name, rarity: m.rarity, floor: null, change: null, listings: null }; });
      // أسعار النماذج من عروض الأسواق (Gift Satellite): أقل عرض ظاهر لكل نموذج + سعره في كل سوق
      const mfl = (g && g.mfl) || {};
      const seen = {};
      arr.forEach(function (m) {
        seen[m.name] = 1;
        const f = mfl[m.name];
        if (f && f.p > 0) { m.floor = f.p; m.best = f.m; m.mk = f.mk; m.live = true; }
      });
      Object.keys(mfl).forEach(function (n) { if (!seen[n] && mfl[n].p > 0) arr.push({ name: n, rarity: null, floor: mfl[n].p, best: mfl[n].m, mk: mfl[n].mk, live: true, change: null, listings: null }); });
      // تغيّر 24 ساعة لكل نموذج من لقطاتنا
      const h = g ? await G.hist(g) : null;
      if (h && h.md && h.t) {
        const now = Math.floor(Date.now() / 1000);
        arr.forEach(function (m) {
          const a2 = h.md[m.name]; if (!a2 || !(m.floor > 0)) return;
          for (let i = h.t.length - 1; i >= 0; i--) {
            if (h.t[i] <= now - 23 * 3600 && a2[i] > 0) { if (h.t[i] >= now - 40 * 3600) m.change = Math.round((m.floor - a2[i]) / a2[i] * 10000) / 100; break; }
          }
        });
      }
      // see.tg: أسعار النماذج الكاملة (أرخص عرض لكل نموذج من كل الأسواق) + الندرة + تغير 24س/7أيام
      const sm = g ? await dataGet('see/m/' + norm(g.official || g.name) + '.json') : null;
      if (sm && sm.m) {
        const idx = {}; arr.forEach(function (m) { idx[m.name] = m; });
        Object.keys(sm.m).forEach(function (n) {
          const x = sm.m[n]; let m = idx[n];
          if (!m) { m = { name: n, rarity: null, floor: null, change: null, listings: null }; arr.push(m); idx[n] = m; }
          if (m.rarity == null && x.r != null) m.rarity = x.r;
          m.c7 = x.c7; m.c30 = x.c30; m.actual = x.a;
          if (!(m.floor > 0) && x.p > 0) { m.floor = x.p; m.best = x.m; m.mk = x.mk; m.live = true; m.src = 'see'; }
          if (m.change == null && x.c1 != null) m.change = x.c1;
        });
      }
      arr.sort(function (a, b) { return (a.rarity == null ? 1e9 : a.rarity) - (b.rarity == null ? 1e9 : b.rarity); });
      return arr;
    },
    // فحص كل مصدر على حدة، ويعرض النتيجة في الإعدادات
    diagnose: async function () {
      const tests = [
        ['TG Gifts — floors', 'https://tggifts.com/data/floors-daily.json'],
        ['TG Gifts — models', MODEL_URLS[0]],
        ['Gift Satellite — floors.json (repo)', FLOORS_URL + '?d=' + Date.now()],
        ['Baltic Assets — rate', RATE_URL],
        ['Gift Changes — names', NAME_URLS[0]],
        ['Gift Changes — models/Plush Pepe', API + '/models/' + encodeURIComponent('Plush Pepe')],
        ['CDN — models.json', CDN_MODELS + encodeURIComponent('Algorithm Cup') + '/models.json']
      ];
      const out = await Promise.all(tests.map(async function (t) {
        try {
          const r = await fetch(t[1]);
          if (!r.ok) return [t[0], false, 'HTTP ' + r.status];
          const j = await r.json();
          return [t[0], true, Array.isArray(j) ? j.length + ' items' : Object.keys(j || {}).length + ' keys'];
        } catch (e) { return [t[0], false, String(e && e.message ? e.message : e)]; }
      }));
      const imgTests = [['Image — Original.png (Plush Pepe)', CDN_MODELS + 'Plush%20Pepe/png/Original.png'],
                        ['Image — Original.png (Algorithm Cup)', CDN_MODELS + 'Algorithm%20Cup/png/Original.png'],
                        ['Image — Red Menace.png (Plush Pepe)', CDN_MODELS + 'Plush%20Pepe/png/Red%20Menace.png']];
      const imgs = await Promise.all(imgTests.map(function (t) {
        return new Promise(function (res) {
          const im = new Image();
          im.onload = function () { res([t[0], true, im.naturalWidth + 'px']); };
          im.onerror = function () { res([t[0], false, 'failed to load']); };
          im.src = t[1] + '?d=' + Date.now();
        });
      }));
      const first = (G._list && G._list[0]) ? G._list[0] : null;
      return out.concat(imgs).concat([['Active source', G.mode === 'live', G.mode + (G.source ? ' · ' + G.source : '') + (first ? ' · e.g. ' + first.id + ' → ' + (first.official || first.name) : '')]]);
    },
    thumb: thumb,
    // صور التصدير: أصلية عالية الجودة عبر wsrv (CORS آمن)
    exportImgs: function (g, model) {
      const base = CDN_MODELS + encodeURIComponent(g.official || g.name) + '/png/';
      let urls;
      if (model) urls = [base + encodeURIComponent(model) + '.png'];
      else {
        urls = [base + 'Original.png'];
        const ms = G._live && G._live.models ? G._live.models[g.id] : null;
        if (ms && ms.length) urls.push(base + encodeURIComponent(ms[0].name) + '.png');
      }
      return urls.map(function (u) { return thumb(u, 320, 'png'); });
    },
    // ---- شارت الهدايا الحقيقي: مبيعات فعلية + فلور الأسواق (لقطات كل 30 دقيقة) ----
    json: function (p) { return dataGet(p); },
    hist: function (g) { return dataGet('h/' + norm(g.official || g.name) + '.json'); },
    sales: function (g) { return dataGet('sales/' + norm(g.official || g.name) + '.json'); },
    series: async function (g, o) {
      if (o.mode === 'frag') return toCandles(g.points || [], o.tf === '1M' ? '1M' : o.tf === '1w' ? '1w' : '1d');
      if (o.mode === 'floor') {
        const h = await G.hist(g);
        return h ? toOHLC(floorPoints(h, o.market, o.model), o.tf, true) : [];
      }
      const s = await G.sales(g);
      return s ? toOHLC(salesPoints(s, o.market, o.model), o.tf, false) : [];
    },
    salesRows: async function (g, market, model) {
      const s = await G.sales(g);
      if (!s || !Array.isArray(s.s)) return { rows: [], all: 0, since: null };
      const rows = s.s.filter(function (x) { return (market === 'all' || mkey(x[2]) === market) && (!model || x[4] === model); });
      return { rows: rows, all: rows.length, since: rows.length ? rows[rows.length - 1][0] : null };
    },
    volume: function (rows) { return volumeStats(rows); },
    chart: function (gid, model, tf, floor) {
      if (G.mode === 'demo') return demoChart(gid, model, tf, floor);
      if (model) return Promise.resolve([]); // مفيش تاريخ للموديلات في المصدر
      const g = (G._list || []).find(function (x) { return x.id === gid; });
      return Promise.resolve(g ? toCandles(g.points, tf) : []);
    },
    _t: { toOHLC: toOHLC, floorPoints: floorPoints, salesPoints: salesPoints, volumeStats: volumeStats, bucketKey: bucketKey, dataBase: dataBase, nameMap: nameMap, norm: norm, extractCollections: extractCollections, extractModels: extractModels, buildGifts: buildGifts, toCandles: toCandles, findRate: findRate }
  };
  window.Gifts = G;
  window.Crypto = Crypto;
})();
