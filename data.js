// ====== طبقة البيانات: العملات (حقيقية) + الهدايا (تجريبية حالياً) ======
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

  // ---------- Crypto (CoinGecko للقائمة + Binance للشارت) ----------
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

  // ---------- Gifts (DEMO provider) ----------
  // مهم: ده مزوّد تجريبي. الأسعار مش حقيقية. هنستبدله بمصدر حقيقي في المرحلة الجاية
  // من غير ما نغيّر أي حاجة في الواجهة (نفس الدوال: list / models / chart).
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
    ['Neko Helmet', 310, 14200], ['Loot Bag', 295, 16000], ['Top Hat', 240, 18500], ['Diamond Ring', 215, 20000],
    ['Genie Lamp', 190, 21000], ['Magic Potion', 170, 22000], ['Love Potion', 150, 24000], ['Bonded Ring', 132, 26000],
    ['Scared Cat', 118, 28000], ['Snoop Dogg', 96, 32000], ['Kissed Frog', 88, 34000], ['Electric Skull', 74, 36000],
    ['Skull Flower', 61, 40000], ['Toy Bear', 52, 45000], ['Lol Pop', 38, 52000], ['Sakura Flower', 30, 60000]
  ];
  const MODEL_NAMES = ['Aurora', 'Stripes', 'Midas', 'Frost', 'Ember', 'Jade', 'Onyx', 'Coral', 'Nova', 'Velvet', 'Mocha', 'Cobalt'];
  const RARITY = [0.5, 1, 1.5, 2, 3, 5, 8, 12];
  const day = Math.floor(Date.now() / 864e5);

  function change(key) {
    const r = rng(hash(key + day));
    if (r() < 0.2) return 0;
    return Math.round((r() - 0.45) * 1000) / 100;
  }
  const LIST = SEED.map(function (s) {
    return { id: 'g' + hash(s[0]).toString(36), name: s[0], floor: s[1], supply: s[2],
             maxSupply: Math.round(s[2] * 1.12), change: change(s[0]) };
  });

  function placeholder(name) {
    const h = hash(name) % 360;
    const m = name.match(/[A-Za-z؀-ۿЀ-ӿ]/);
    const ch = (m ? m[0] : '?').toUpperCase();
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='hsl(" + h + ",70%,60%)'/><stop offset='1' stop-color='hsl(" + ((h + 50) % 360) + ",70%,35%)'/></linearGradient></defs>" +
      "<rect width='100' height='100' rx='24' fill='url(#g)'/><text x='50' y='65' font-size='46' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='700'>" + ch + "</text></svg>";
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const GTF = { '2h': 7200, '4h': 14400, '1d': 86400, '1w': 604800, '1M': 2592000 };

  window.Gifts = {
    demo: true,
    tonUsd: 3,
    img: placeholder,
    list: function () { return Promise.resolve(LIST); },
    models: function (gid) {
      const g = LIST.find(function (x) { return x.id === gid; });
      if (!g) return Promise.resolve([]);
      const r = rng(hash(g.id));
      const out = RARITY.map(function (ra, i) {
        const name = MODEL_NAMES[(i + Math.floor(r() * 4)) % MODEL_NAMES.length] + (i > 3 ? ' ' + (i - 2) : '');
        const factor = 0.8 + 0.6 / Math.max(ra, 0.5);
        return { name: name, rarity: ra, floor: Math.round(g.floor * factor * 100) / 100, change: change(g.id + name) };
      });
      return Promise.resolve(out);
    },
    // شموع تجريبية ثابتة (نفس الإدخال = نفس الشارت)، آخر إغلاق = السعر الحالي
    chart: function (gid, model, tf, floor) {
      const step = GTF[tf] || 86400, n = 120;
      const r = rng(hash(gid + (model || '') + tf));
      let p = floor * (0.85 + r() * 0.3);
      const end = Math.floor(Date.now() / 1000 / step) * step;
      const out = [];
      for (let i = n - 1; i >= 0; i--) {
        const o = p, c = o * (1 + (r() - 0.5) * 0.04);
        out.push({ time: end - i * step, open: o, high: Math.max(o, c) * (1 + r() * 0.01),
                   low: Math.min(o, c) * (1 - r() * 0.01), close: c });
        p = c;
      }
      const k = floor / out[out.length - 1].close;
      out.forEach(function (x) { x.open *= k; x.high *= k; x.low *= k; x.close *= k; });
      return Promise.resolve(out);
    }
  };
  window.Crypto = Crypto;
})();
