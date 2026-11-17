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
  const NAME_URLS = ['https://api.changes.tg/names', 'https://cdn.changes.tg/gifts/id-to-name.json'];
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
  async function loadLive() {
    const f = await firstJSON(FLOOR_URLS);
    const gifts = buildGifts(extractCollections(f.json));
    if (!gifts.length) throw new Error('Unexpected data format (' + hostOf(f.url) + ')');
    const res = await Promise.all([
      firstJSON(MODEL_URLS).then(function (x) { return extractModels(x.json); }).catch(function () { return {}; }),
      fetch(RATE_URL).then(function (x) { return x.json(); }).then(findRate).catch(function () { return null; }),
      firstJSON(NAME_URLS).then(function (x) { return nameMap(x.json); }).catch(function () { return {}; })
    ]);
    // الاسم الرسمي (زي "Plush Pepe") هو اللي بيتبني عليه مسار الصور في cdn.changes.tg
    gifts.forEach(function (g) { g.official = res[2][norm(g.name)] || res[2][norm(g.id)] || g.name; });
    return { gifts: gifts, models: res[0], rate: res[1], source: hostOf(f.url) };
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
    tonUsd: 3, rateSrc: '', img: placeholder, _list: null, _live: null,
    list: async function () {
      if (G._list) return G._list;
      try {
        const L = await loadLive();
        G._live = L; G.mode = 'live'; G.demo = false; G.err = null; G.source = L.source; G.hasSupply = false;
        if (L.rate) { G.tonUsd = L.rate; G.rateSrc = 'Baltic Assets'; }
        G._list = L.gifts;
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
      if (model) return [base + encodeURIComponent(model) + '.png'];
      const urls = [base + 'Original.png'];
      const ms = G._live && G._live.models ? G._live.models[g.id] : null;
      if (ms && ms.length) urls.push(base + encodeURIComponent(ms[0].name) + '.png');
      return urls;
    },
    models: function (gid) {
      if (G.mode === 'demo') return demoModels(gid);
      const arr = ((G._live.models || {})[gid] || []).map(function (m) {
        return { name: m.name, rarity: m.rarity, floor: m.floor, change: null, listings: m.listings };
      });
      arr.sort(function (a, b) { return (a.rarity == null ? 1e9 : a.rarity) - (b.rarity == null ? 1e9 : b.rarity); });
      return Promise.resolve(arr);
    },
    chart: function (gid, model, tf, floor) {
      if (G.mode === 'demo') return demoChart(gid, model, tf, floor);
      if (model) return Promise.resolve([]); // مفيش تاريخ للموديلات في المصدر
      const g = (G._list || []).find(function (x) { return x.id === gid; });
      return Promise.resolve(g ? toCandles(g.points, tf) : []);
    },
    _t: { nameMap: nameMap, norm: norm, extractCollections: extractCollections, extractModels: extractModels, buildGifts: buildGifts, toCandles: toCandles, findRate: findRate }
  };
  window.Gifts = G;
  window.Crypto = Crypto;
})();
