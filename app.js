(function () {
'use strict';
var tg = window.Telegram && window.Telegram.WebApp;
var U = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || {};
var $ = function (s) { return document.querySelector(s); };
var esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};
var store = {
  get: function (k, d) { try { var v = localStorage.getItem('arbton_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem('arbton_' + k, JSON.stringify(v)); } catch (e) {} }
};

var GTFS = ['1d', '1w', '1M']; // المصدر يومي فقط، فمفيش 2h/4h
var CTFS = ['5m', '15m', '1h', '4h', '1d', '1w', '1M', '1Y'];
var langGuess = ['ar', 'ru'].indexOf(U.language_code) >= 0 ? U.language_code : 'en';

var S = {
  tab: 'crypto', view: null, hist: [], tok: 0, ctok: 0, chart: null, ro: null,
  lang: store.get('lang', langGuess),
  theme: store.get('theme', (tg && tg.colorScheme) || 'dark'),
  cur: store.get('cur', 'gem'),
  cs: store.get('cs', 'candles'),
  alerts: store.get('alerts', { portfolio: false, pumps: false }),
  favC: store.get('favC', []), favG: store.get('favG', []),
  prof: store.get('prof', { items: [], cols: [] }),
  c: { tab: 'all', q: '', key: 'cap', asc: false, grid: false },
  g: { tab: 'all', q: '', map: false, metric: 'cap' },
  p: { tab: 'assets', edit: false },
  csOpen: false, cp: null, cpState: null,
  cache: { coins: null, ct: 0, glob: null, gifts: null }
};

var t = function (k) { return (I18N[S.lang] && I18N[S.lang][k]) || I18N.en[k] || k; };

/* ---------- icons ---------- */
var I = function (p) { return '<svg viewBox="0 0 24 24">' + p + '</svg>'; };
var ICON = {
  gifts: I('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8C10 3.5 6 4.5 7 7.5 7.5 9 10 8 12 8zm0 0c2-4.5 6-3.5 5-.5-.5 1.5-3 .5-5 .5z"/>'),
  profile: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  settings: I('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  share: I('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>'),
  dl: I('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
  heart: I('<path d="M12 20s-7-4.6-9-9.2C1.6 7.4 4 4.5 7 4.5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3 0 5.4 2.9 4 6.3-2 4.600-9 9.200-9 9.200z"/>'),
  heartF: '<svg viewBox="0 0 24 24" style="fill:currentColor"><path d="M12 20s-7-4.6-9-9.2C1.6 7.4 4 4.5 7 4.5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3 0 5.4 2.9 4 6.3-2 4.6-9 9.2-9 9.2z"/></svg>',
  search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.500-3.500"/>'),
  sort: I('<path d="M4 6h10M4 12h7M4 18h4M17 5v14M14 16l3 3 3-3"/>'),
  list: I('<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"/>'),
  grid: I('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  more: I('<circle cx="5" cy="12" r="1.500"/><circle cx="12" cy="12" r="1.500"/><circle cx="19" cy="12" r="1.500"/>'),
  pulse: I('<path d="M3 12h4l3-7 4 14 3-7h4"/>'),
  moon: I('<path d="M20 14.500A8 8 0 019.500 4 8 8 0 1020 14.500z"/>'),
  sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.500 1.500M17.500 17.500L19 19M5 19l1.500-1.500M17.500 6.500L19 5"/>'),
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  dollar: I('<circle cx="12" cy="12" r="9"/><path d="M14.500 9c-.5-1-1.500-1.500-2.500-1.500-1.500 0-2.500.8-2.500 2s1 1.700 2.500 2 2.500.8 2.500 2-1 2-2.500 2c-1 0-2-.5-2.500-1.500M12 6v1.500M12 16.500V18"/>'),
  chartI: I('<path d="M3 17l6-6 4 4 8-9"/>'),
  brief: I('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2"/>'),
  bolt: I('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'),
  users: I('<circle cx="9" cy="8" r="3.500"/><path d="M2 20c.5-3.500 3-5.500 7-5.500s6.500 2 7 5.500M16 5a3 3 0 010 6M18 14.500c2 .5 3.500 2.500 4 5.500"/>'),
  mega: I('<path d="M3 11v3l12 5V6L3 11zM15 9c2.500 1 2.500 6 0 7"/>'),
  fire: I('<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>'),
  up: I('<path d="M12 20V5M6 11l6-6 6 6"/>'),
  down: I('<path d="M12 4v15M6 13l6 6 6-6"/>'),
  heartS: I('<path d="M12 20s-7-4.600-9-9.200C1.600 7.400 4 4.500 7 4.500c2 0 3.600 1 5 3 1.400-2 3-3 5-3 3 0 5.400 2.900 4 6.300-2 4.600-9 9.200-9 9.200z"/>')
};
var GEM = '<svg class="gem" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 7-8 13L4 9z"/></svg>';

/* ---------- gift images (CDN of changes.tg مع رجوع للمربع الملوّن) ---------- */
function gImg(g, model, cls) {
  var ph = Gifts.img(g.name + (model || ''));
  var urls = Gifts.mode === 'live' ? Gifts.imgs(g, model) : [];
  return '<img class="' + cls + '" src="' + esc(urls.length ? urls[0] : ph) + '" data-alts="' + esc(urls.slice(1).join('|')) +
    '" data-fb="' + esc(ph) + '"' + (Gifts.mode === 'live' && !model && g.id ? ' data-gid="' + esc(g.id) + '"' : '') +
    ' loading="lazy" decoding="async" alt="">';
}
document.addEventListener('error', function (e) {
  var im = e.target;
  if (!im || im.tagName !== 'IMG' || !im.dataset) return;
  var alts = (im.dataset.alts || '').split('|').filter(Boolean);
  if (alts.length) { im.dataset.alts = alts.slice(1).join('|'); im.src = alts[0]; return; }
  // مفيش Original.png للهدايا القديمة: نجيب أسماء النماذج ونستخدم صورة أول نموذج
  if (im.dataset.gid && !im.dataset.tried) {
    im.dataset.tried = '1';
    Gifts.firstModelImg(im.dataset.gid).then(function (u) { im.src = u || im.dataset.fb; }).catch(function () { im.src = im.dataset.fb; });
    return;
  }
  if (im.dataset.fb && im.src !== im.dataset.fb) { im.src = im.dataset.fb; }
}, true);

/* ---------- formatting ---------- */
function nf(n, d) { d = d == null ? 2 : d; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtPrice(n) {
  if (n == null) return '—'; n = +n;
  if (n >= 1) return nf(n, 2);
  if (n >= 0.01) return nf(n, 4);
  return n.toFixed(8).replace(/0+$/, '');
}
function fmtBig(n) {
  var a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(2);
}
function pill(n) {
  n = Math.round((+n || 0) * 100) / 100;
  return '<span class="pill ' + (n > 0 ? 'up' : n < 0 ? 'down' : 'flat') + '">' + (n > 0 ? '+' : '') + n.toFixed(2) + '%</span>';
}
function pillN(n) { return n == null ? '' : pill(n); }
function gv(n) { return S.cur === 'gem' ? GEM + nf(n, 2) : '$' + nf(n * Gifts.tonUsd, 2); }
function gvBig(n) { return S.cur === 'gem' ? GEM + fmtBig(n) : '$' + fmtBig(n * Gifts.tonUsd); }
var loadingBox = function () { return '<div class="loading">' + t('loading') + '</div>'; };
var errBox = function (act) { return '<div class="empty"><p>' + t('error') + '</p><button class="btn" data-act="' + (act || 'retry') + '">' + t('retry') + '</button></div>'; };
function toggle(arr, id, key) {
  var i = arr.indexOf(id);
  if (i >= 0) arr.splice(i, 1); else arr.push(id);
  store.set(key, arr);
}

/* ---------- theme / telegram ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  try {
    var col = S.theme === 'dark' ? '#000000' : '#f2f2f7';
    if (tg) { tg.setHeaderColor(col); tg.setBackgroundColor(col); }
  } catch (e) {}
}

/* ---------- navigation ---------- */
function go(v) { S.hist.push(S.view); S.view = v; render(); }
function back() { S.view = S.hist.length ? S.hist.pop() : null; render(); }
function setTab(v) { S.hist = []; S.view = null; S.tab = v; render(); }

function renderNav() {
  var initial = (U.first_name || 'U').charAt(0).toUpperCase();
  var av = U.photo_url ? '<img class="navav" src="' + esc(U.photo_url) + '">' : '<span class="navav">' + esc(initial) + '</span>';
  var items = [['crypto', '<span class="bt">₿</span>', t('crypto')], ['gifts', ICON.gifts, t('gifts')], ['profile', av, t('profile')], ['settings', ICON.settings, t('settings')]];
  $('#nav').innerHTML = items.map(function (x) {
    return '<button class="' + (S.tab === x[0] ? 'on' : '') + '" data-act="tab" data-v="' + x[0] + '">' + x[1] + '<span>' + x[2] + '</span></button>';
  }).join('');
}

function killChart() {
  if (S.ro) { S.ro.disconnect(); S.ro = null; }
  if (S.chart) { try { S.chart.remove(); } catch (e) {} S.chart = null; }
}

function render() {
  killChart();
  var tok = ++S.tok;
  renderNav();
  try { if (tg) { if (S.view) tg.BackButton.show(); else tg.BackButton.hide(); } } catch (e) {}
  var v = S.view;
  if (v) {
    window.scrollTo(0, 0);
    if (v.type === 'coin') return vCoin(tok);
    if (v.type === 'gift') return vGift(tok);
    if (v.type === 'models') return vModels(tok);
    if (v.type === 'portfolio') return vPortfolio(tok);
  }
  ({ crypto: vCrypto, gifts: vGifts, profile: vProfile, settings: vSettings })[S.tab](tok);
}

/* ---------- modal helpers ---------- */
function modal(html) { var m = $('#modal'); m.innerHTML = '<div class="sheet">' + html + '</div>'; m.classList.remove('hidden'); }
function closeModal() { var m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; }
var SHEET_FN = [];
function sheet(title, rows) {
  SHEET_FN = rows.map(function (r) { return r.f; });
  modal('<h3>' + esc(title) + '</h3>' + rows.map(function (r, i) {
    return '<button class="opt ' + (r.on ? 'on' : '') + ' ' + (r.red ? 'red' : '') + '" data-act="sheetpick" data-v="' + i + '"><span>' + esc(r.l) + '</span><span>' + (r.on ? '✓' : '') + '</span></button>';
  }).join(''));
}
var PICK = null;
function picker(opts) { // {title, items:[{id,name,sub,img}], isSel, multi, onPick}
  PICK = opts;
  modal('<h3>' + esc(opts.title) + '</h3><div class="search">' + ICON.search + '<input id="pq" placeholder="' + esc(t('name')) + '"></div><div id="pl"></div>');
  paintPicker('');
}
function paintPicker(q) {
  q = q.toLowerCase();
  $('#pl').innerHTML = PICK.items.filter(function (x) { return !q || (x.name + ' ' + (x.sub || '')).toLowerCase().indexOf(q) >= 0; }).map(function (x) {
    return '<button class="pk" data-act="pkpick" data-v="' + esc(x.id) + '">' + (x.html || '<img class="lg ' + (x.sq ? 'sq' : '') + '" src="' + esc(x.img) + '">') + '<span class="nm">' + esc(x.name) + (x.sub ? ' <small style="color:var(--muted)">' + esc(x.sub) + '</small>' : '') + '</span><span class="ck">' + (PICK.multi && PICK.isSel(x.id) ? '✓' : '') + '</span></button>';
  }).join('');
}

/* ---------- charts ---------- */
function makeChart(box, data) {
  killChart();
  box.innerHTML = '';
  if (!data || !data.length) { box.innerHTML = '<div class="empty">' + t('no_history') + '</div>'; return; }
  var dark = S.theme === 'dark';
  var chart = LightweightCharts.createChart(box, {
    width: box.clientWidth, height: box.clientHeight,
    layout: { background: { color: 'transparent' }, textColor: dark ? '#9aa0a6' : '#555' },
    grid: { vertLines: { color: dark ? '#1b1b1f' : '#e8e8ee' }, horzLines: { color: dark ? '#1b1b1f' : '#e8e8ee' } },
    rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true },
    watermark: { visible: true, text: CONFIG.BRAND, fontSize: 34, color: dark ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.1)', horzAlign: 'center', vertAlign: 'center' }
  });
  var up = '#22c55e', down = '#ef4444', s;
  if (S.cs === 'candles') {
    s = chart.addCandlestickSeries({ upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
    s.setData(data);
  } else if (S.cs === 'line') {
    s = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2 });
    s.setData(data.map(function (x) { return { time: x.time, value: x.close }; }));
  } else {
    s = chart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59,130,246,.4)', bottomColor: 'rgba(59,130,246,0)' });
    s.setData(data.map(function (x) { return { time: x.time, value: x.close }; }));
  }
  chart.timeScale().fitContent();
  S.chart = chart;
  if (window.ResizeObserver) {
    S.ro = new ResizeObserver(function () { try { chart.applyOptions({ width: box.clientWidth }); } catch (e) {} });
    S.ro.observe(box);
  }
}

/* generic chart page used by coins, gifts, models, portfolio */
function chartPage(cfg) {
  S.cp = cfg; S.cpState = { tab: 'price', tf: cfg.tf };
  var fav = cfg.isFav ? cfg.isFav() : false;
  $('#view').innerHTML =
    '<div class="dhead"><button class="ib" data-act="back">' + ICON.back + '</button>' +
    (cfg.imgHtml || '<img class="lg ' + (cfg.sq ? 'sq' : '') + '" src="' + esc(cfg.img) + '">') +
    '<div class="dt"><div class="dn">' + esc(cfg.title) + '</div><div class="dp">' + cfg.price + '</div></div>' + pill(cfg.chg) +
    '<div class="grow"></div>' +
    (cfg.models ? '<button class="chip" data-act="cpmodels">' + t('models') + '</button>' : '') +
    '<button class="ib" data-act="share">' + ICON.share + '</button>' +
    '<button class="ib" data-act="dl">' + ICON.dl + '</button>' +
    (cfg.isFav ? '<button class="ib ' + (fav ? 'on' : '') + '" id="favbtn" data-act="fav">' + (fav ? ICON.heartF : ICON.heart) + '</button>' : '') +
    '</div>' +
    '<div class="tabs2"><button class="on" data-act="cptab" data-v="price">' + t('price') + '</button>' +
    (cfg.overview ? '<button data-act="cptab" data-v="ov">' + t('overview') + '</button>' : '') + '</div>' +
    '<div id="cpbody"></div>';
  paintCP();
}
function paintCP() {
  var cfg = S.cp, st = S.cpState, body = $('#cpbody');
  killChart();
  if (st.tab === 'ov') {
    body.innerHTML = '<div class="card">' + cfg.overview.map(function (r) { return '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
    return;
  }
  body.innerHTML = '<div class="tfs">' + cfg.tfs.map(function (x) { return '<button class="tf ' + (x === st.tf ? 'on' : '') + '" data-act="tf" data-v="' + x + '">' + x + '</button>'; }).join('') + '</div><div id="chart" class="chart"></div>';
  drawCP();
}
function drawCP() {
  var tok = ++S.ctok, box = $('#chart');
  if (!box) return;
  box.innerHTML = loadingBox();
  S.cp.fetch(S.cpState.tf).then(function (data) {
    if (tok !== S.ctok || !$('#chart')) return;
    makeChart($('#chart'), data);
  }).catch(function () {
    if (tok === S.ctok && $('#chart')) $('#chart').innerHTML = errBox('retrychart');
  });
}

/* ---------- CRYPTO ---------- */
function setTon() {
  if (Gifts.rateSrc) return; // سعر الصرف جاي من Baltic Assets
  var ton = S.cache.coins && S.cache.coins.find(function (c) { return c.id === 'the-open-network'; });
  if (ton) Gifts.tonUsd = ton.current_price;
}
function vCrypto(tok) {
  var el = $('#view');
  var fresh = S.cache.coins && Date.now() - S.cache.ct < 60000;
  if (fresh) return paintCrypto();
  el.innerHTML = loadingBox();
  Promise.all([Crypto.markets(), Crypto.global().catch(function () { return null; })]).then(function (r) {
    S.cache.coins = r[0]; S.cache.glob = r[1]; S.cache.ct = Date.now(); setTon();
    if (tok === S.tok) paintCrypto();
  }).catch(function () {
    if (tok !== S.tok) return;
    if (S.cache.coins) paintCrypto(); else el.innerHTML = errBox();
  });
}
function paintCrypto() {
  var c = S.c, g = S.cache.glob;
  var tabs = [['all', ICON.chartI.replace('<svg', '<svg').replace('M3 17l6-6 4 4 8-9', 'M3 17l6-6 4 4 8-9'), t('all')], ['hot', ICON.fire, t('hot')], ['fav', ICON.heartS, t('favorites')], ['gain', ICON.up, t('gainers')], ['loss', ICON.down, t('losers')]];
  var sum = '';
  if (g) {
    var cap = g.total_market_cap.usd, pc = g.market_cap_change_percentage_24h_usd || 0;
    var abs = cap * (pc / 100) / (1 + pc / 100);
    sum = '<div class="sum"><div><small>' + t('market_cap') + '</small><b>$' + fmtBig(cap) + '</b>' + pill(pc).replace('class="pill', 'class="pill') + '</div>' +
      '<div><small>' + t('change24') + '</small><b class="' + (abs >= 0 ? 'up-t' : 'down-t') + '">' + (abs >= 0 ? '+' : '-') + '$' + fmtBig(Math.abs(abs)) + '</b></div></div>';
  }
  $('#view').innerHTML =
    '<div class="tabs">' + tabs.map(function (x) { return '<button class="' + (c.tab === x[0] ? 'on' : '') + '" data-act="ctab" data-v="' + x[0] + '">' + x[1] + x[2] + '</button>'; }).join('') + '</div>' +
    '<div class="bar"><label class="search">' + ICON.search + '<input id="q" value="' + esc(c.q) + '" placeholder="' + t('search_coins') + '"></label>' +
    '<button class="ib" data-act="csort">' + ICON.sort + '</button>' +
    '<button class="ib ' + (!c.grid ? 'act' : '') + '" data-act="cview" data-v="list">' + ICON.list + '</button>' +
    '<button class="ib ' + (c.grid ? 'act' : '') + '" data-act="cview" data-v="grid">' + ICON.grid + '</button></div>' +
    sum + '<div id="list"></div>';
  paintCryptoList();
}
function coinList() {
  var c = S.c, L = S.cache.coins.slice();
  if (c.q) L = L.filter(function (x) { return (x.name + ' ' + x.symbol).toLowerCase().indexOf(c.q.toLowerCase()) >= 0; });
  var ch = function (x) { return x.price_change_percentage_24h || 0; };
  if (c.tab === 'fav') L = L.filter(function (x) { return S.favC.indexOf(x.id) >= 0; });
  else if (c.tab === 'gain') L = L.filter(function (x) { return ch(x) > 0; }).sort(function (a, b) { return ch(b) - ch(a); });
  else if (c.tab === 'loss') L = L.filter(function (x) { return ch(x) < 0; }).sort(function (a, b) { return ch(a) - ch(b); });
  else if (c.tab === 'hot') L = L.sort(function (a, b) { return Math.abs(ch(b)) - Math.abs(ch(a)); }).slice(0, 30);
  if (c.tab === 'all' || c.tab === 'fav') {
    var f = { cap: function (x) { return x.market_cap_rank || 9999; }, price: function (x) { return x.current_price; }, chg: ch, name: function (x) { return x.name.toLowerCase(); } }[c.key];
    var dirMul = c.key === 'cap' ? (c.asc ? -1 : 1) : (c.asc ? 1 : -1);
    L.sort(function (a, b) { var A = f(a), B = f(b); return (A > B ? 1 : A < B ? -1 : 0) * (c.key === 'cap' ? -dirMul : dirMul) * (c.key === 'cap' ? -1 : 1); });
  }
  return L;
}
function paintCryptoList() {
  var c = S.c, L = coinList(), box = $('#list');
  if (!box) return;
  var addBtn = '<div class="empty" style="padding:16px"><button class="btn" data-act="addcoins">+ ' + t('add_coins') + '</button></div>';
  if (c.tab === 'fav' && !L.length && !c.q) { box.innerHTML = '<div class="empty"><p>' + t('no_favs') + '</p><button class="btn" data-act="addcoins">+ ' + t('add_coins') + '</button></div>'; return; }
  var html;
  if (c.grid) {
    html = '<div class="grid">' + L.map(function (x) {
      return '<div class="cell" data-act="coin" data-v="' + esc(x.id) + '"><img class="lg" src="' + esc(x.image) + '" loading="lazy"><b>' + esc(x.symbol.toUpperCase()) + '</b><span class="p">$' + fmtPrice(x.current_price) + '</span>' + pill(x.price_change_percentage_24h) + '</div>';
    }).join('') + '</div>';
  } else {
    html = L.map(function (x) {
      return '<div class="row" data-act="coin" data-v="' + esc(x.id) + '"><img class="lg" src="' + esc(x.image) + '" loading="lazy"><div class="nm">' + esc(x.name) + '</div><div class="pr">$' + fmtPrice(x.current_price) + '</div>' + pill(x.price_change_percentage_24h) + '</div>';
    }).join('');
  }
  box.innerHTML = html + (c.tab === 'fav' ? addBtn : '');
}
function vCoin(tok) {
  var load = S.cache.coins ? Promise.resolve(S.cache.coins) : Crypto.markets().then(function (c) { S.cache.coins = c; S.cache.ct = Date.now(); return c; });
  $('#view').innerHTML = loadingBox();
  load.then(function (coins) {
    if (tok !== S.tok) return;
    var c = coins.find(function (x) { return x.id === S.view.id; });
    if (!c) return back();
    chartPage({
      img: c.image, title: c.name, price: '$' + fmtPrice(c.current_price), chg: c.price_change_percentage_24h,
      tfs: CTFS, tf: '1h', fname: c.symbol,
      fetch: function (tf) { return Crypto.candles(c.symbol, c.id, tf); },
      isFav: function () { return S.favC.indexOf(c.id) >= 0; }, toggleFav: function () { toggle(S.favC, c.id, 'favC'); },
      shareText: c.name + ' — $' + fmtPrice(c.current_price),
      overview: [
        [t('rank'), '#' + (c.market_cap_rank || '—')], [t('market_cap'), '$' + fmtBig(c.market_cap)], [t('volume'), '$' + fmtBig(c.total_volume)],
        [t('high24'), '$' + fmtPrice(c.high_24h)], [t('low24'), '$' + fmtPrice(c.low_24h)], [t('ath'), '$' + fmtPrice(c.ath)],
        [t('supply'), c.circulating_supply ? fmtBig(c.circulating_supply) + ' ' + c.symbol.toUpperCase() : '—']
      ]
    });
  }).catch(function () { if (tok === S.tok) $('#view').innerHTML = errBox(); });
}

/* ---------- GIFTS ---------- */
function getGifts() {
  if (S.cache.gifts) return Promise.resolve(S.cache.gifts);
  return Gifts.list().then(function (l) { S.cache.gifts = l; return l; });
}
function vGifts(tok) {
  $('#view').innerHTML = loadingBox();
  getGifts().then(function () { if (tok === S.tok) paintGifts(); });
}
function paintGifts() {
  var g = S.g;
  var tabs = [['all', ICON.gifts, t('all_gifts')], ['hot', ICON.fire, t('hot')], ['fav', ICON.heartS, t('favorites')], ['gain', ICON.up, t('gainers')], ['loss', ICON.down, t('losers')]];
  var L = S.cache.gifts, sumHtml;
  if (Gifts.hasSupply) {
    var mc = L.reduce(function (a, x) { return a + x.floor * x.supply; }, 0);
    var fdv = L.reduce(function (a, x) { return a + x.floor * x.maxSupply; }, 0);
    var avgCh = L.reduce(function (a, x) { return a + x.change * x.floor * x.supply; }, 0) / mc;
    sumHtml = '<div class="sum"><div><small>' + t('market_cap') + '</small><b>' + gvBig(mc) + '</b>' + pill(avgCh) + '</div>' +
      '<div><small>' + t('fdv') + '</small><b>' + gvBig(fdv) + '</b>' + pill(avgCh) + '</div></div>';
  } else {
    // المصدر الحي مفيهوش supply، فمفيش Market Cap: بنعرض عدد الكوليكشنز ومتوسط التغير
    var avg = L.reduce(function (a, x) { return a + x.change; }, 0) / (L.length || 1);
    sumHtml = '<div class="sum"><div><small>' + t('collections') + '</small><b>' + L.length + '</b></div>' +
      '<div><small>' + t('daily_change') + '</small>' + pill(avg) + '</div></div>';
  }
  var badge = Gifts.demo
    ? '<div class="demo">' + t('demo_note') + (Gifts.err ? ' — ' + esc(Gifts.err) : '') + ' <button data-act="gretry" style="color:var(--accent);font-weight:700">' + t('retry') + '</button></div>'
    : '<div class="demo" style="color:var(--up);border-color:#22c55e55">● ' + t('live') + ' · ' + esc(Gifts.source) + (Gifts.rateSrc ? ' · $ ' + esc(Gifts.rateSrc) : '') + '</div>';
  $('#view').innerHTML =
    badge +
    '<div class="tabs">' + tabs.map(function (x) { return '<button class="' + (g.tab === x[0] ? 'on' : '') + '" data-act="gtab" data-v="' + x[0] + '">' + x[1] + x[2] + '</button>'; }).join('') + '</div>' +
    '<div class="bar"><label class="search">' + ICON.search + '<input id="q" value="' + esc(g.q) + '" placeholder="' + t('search_gifts') + '"></label>' +
    '<button class="ib ' + (g.map ? 'act' : '') + '" data-act="gmap">' + (g.map ? ICON.list : ICON.grid) + '</button></div>' +
    sumHtml + '<div id="glist"></div>';
  paintGiftList();
}
function giftFiltered() {
  var g = S.g, L = S.cache.gifts.slice();
  if (g.q) L = L.filter(function (x) { return x.name.toLowerCase().indexOf(g.q.toLowerCase()) >= 0; });
  if (g.tab === 'fav') L = L.filter(function (x) { return S.favG.indexOf(x.id) >= 0; });
  if (g.tab === 'gain') L = L.filter(function (x) { return x.change > 0; }).sort(function (a, b) { return b.change - a.change; });
  else if (g.tab === 'loss') L = L.filter(function (x) { return x.change < 0; }).sort(function (a, b) { return a.change - b.change; });
  else if (g.tab === 'hot') L = L.filter(function (x) { return x.change !== 0; }).sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change); }).slice(0, 20);
  else L.sort(function (a, b) { return b.floor - a.floor; });
  return L;
}
function paintGiftList() {
  var g = S.g, L = giftFiltered(), box = $('#glist');
  if (!box) return;
  if (g.tab === 'fav' && !L.length && !g.q) { box.innerHTML = '<div class="empty"><p>' + t('no_favs') + '</p><button class="btn" data-act="addgifts">+ ' + t('add_gifts') + '</button></div>'; return; }
  if (g.map) return paintMap(L, box);
  box.innerHTML = L.map(function (x) {
    return '<div class="row"><button class="lgb" data-act="models" data-v="' + x.id + '">' + gImg(x, null, 'lg sq') + '</button>' +
      '<div class="nm" data-act="gift" data-v="' + x.id + '">' + esc(x.name) + '</div>' +
      '<button class="pr" data-act="gift" data-v="' + x.id + '">' + gv(x.floor) + '</button>' + pill(x.change) + '</div>';
  }).join('') + (g.tab === 'fav' ? '<div class="empty" style="padding:16px"><button class="btn" data-act="addgifts">+ ' + t('add_gifts') + '</button></div>' : '');
}
function squarify(items, x, y, w, h) {
  var total = items.reduce(function (a, b) { return a + b.value; }, 0);
  var sc = w * h / total;
  var nodes = items.map(function (i) { return Object.assign({}, i, { area: i.value * sc }); });
  var out = [], rect = { x: x, y: y, w: w, h: h }, row = [];
  function worst(r, side) {
    var s = r.reduce(function (a, b) { return a + b.area; }, 0);
    var mx = Math.max.apply(null, r.map(function (q) { return q.area; })), mn = Math.min.apply(null, r.map(function (q) { return q.area; }));
    return Math.max(side * side * mx / (s * s), s * s / (side * side * mn));
  }
  function layout(r) {
    var s = r.reduce(function (a, b) { return a + b.area; }, 0);
    if (rect.w >= rect.h) {
      var rw = s / rect.h, cy = rect.y;
      r.forEach(function (n) { var nh = n.area / rw; out.push(Object.assign({}, n, { x: rect.x, y: cy, w: rw, h: nh })); cy += nh; });
      rect = { x: rect.x + rw, y: rect.y, w: rect.w - rw, h: rect.h };
    } else {
      var rh = s / rect.w, cx = rect.x;
      r.forEach(function (n) { var nw = n.area / rh; out.push(Object.assign({}, n, { x: cx, y: rect.y, w: nw, h: rh })); cx += nw; });
      rect = { x: rect.x, y: rect.y + rh, w: rect.w, h: rect.h - rh };
    }
  }
  nodes.forEach(function (n) {
    var side = Math.min(rect.w, rect.h);
    if (!row.length || worst(row.concat([n]), side) <= worst(row, side)) row.push(n);
    else { layout(row); row = [n]; }
  });
  if (row.length) layout(row);
  return out;
}
function paintMap(L, box) {
  var m = Gifts.hasSupply ? S.g.metric : 'floor';
  var items = L.map(function (x) { return { g: x, value: m === 'cap' ? x.floor * x.supply : x.floor }; }).sort(function (a, b) { return b.value - a.value; });
  var H = Math.max(420, Math.round(window.innerHeight - 330));
  box.innerHTML = '<div class="mrow"><select id="metric">' +
    (Gifts.hasSupply ? '<option value="cap" ' + (m === 'cap' ? 'selected' : '') + '>' + t('market_cap') + '</option>' : '') +
    '<option value="floor" ' + (m === 'floor' ? 'selected' : '') + '>' + t('floor') + '</option></select></div><div class="tm" id="tm" style="height:' + H + 'px"></div>';
  var tm = $('#tm');
  if (!items.length) { tm.innerHTML = '<div class="empty">—</div>'; return; }
  var W = tm.clientWidth;
  var tiles = squarify(items, 0, 0, W, H);
  tm.innerHTML = tiles.map(function (n) {
    var c = n.g.change, i = Math.min(Math.abs(c) / 6, 1);
    var bg = c > 0 ? 'rgba(34,197,94,' + (0.45 + 0.55 * i) + ')' : c < 0 ? 'rgba(239,68,68,' + (0.45 + 0.55 * i) + ')' : '#3a3a40';
    var big = n.w > 70 && n.h > 44, mid = n.w > 44 && n.h > 28;
    return '<div class="tile" data-act="gift" data-v="' + n.g.id + '" style="left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.w + 'px;height:' + n.h + 'px;background:' + bg + '">' +
      (mid ? '<b style="font-size:' + (big ? Math.min(15, 9 + n.w / 40) : 9) + 'px">' + esc(n.g.name) + '</b>' : '') +
      (big ? '<i>' + gv(n.g.floor) + '</i><i>' + (c > 0 ? '+' : '') + c.toFixed(2) + '%</i>' : '') + '</div>';
  }).join('');
}
function vModels(tok) {
  var gid = S.view.id;
  $('#view').innerHTML = loadingBox();
  Promise.all([getGifts(), Gifts.models(gid)]).then(function (r) {
    if (tok !== S.tok) return;
    var g = r[0].find(function (x) { return x.id === gid; }); if (!g) return back();
    S.ms = r[1]; S.mtab = S.mtab && S.mtab.gid === gid ? S.mtab : { gid: gid, v: 'all' };
    paintModels(g);
  });
}
function paintModels(g) {
  var hasCh = S.ms.some(function (m) { return m.change != null; });
  var tabs = hasCh ? [['all', t('all')], ['gain', t('gainers')], ['loss', t('losers')], ['rare', t('rarest')]] : [['all', t('all')], ['rare', t('rarest')]];
  var L = S.ms.slice(), v = S.mtab.v;
  if (!hasCh && (v === 'gain' || v === 'loss')) v = S.mtab.v = 'all';
  if (v === 'gain') L = L.filter(function (x) { return x.change > 0; }).sort(function (a, b) { return b.change - a.change; });
  if (v === 'loss') L = L.filter(function (x) { return x.change < 0; }).sort(function (a, b) { return a.change - b.change; });
  if (v === 'rare') L.sort(function (a, b) { return a.rarity - b.rarity; });
  $('#view').innerHTML =
    '<div class="dhead"><button class="ib" data-act="back">' + ICON.back + '</button><div class="dn" style="flex:1;text-align:center;margin-inline-end:36px">' + esc(g.name) + '</div></div>' +
    '<div class="tabs">' + tabs.map(function (x) { return '<button class="' + (v === x[0] ? 'on' : '') + '" data-act="mtab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
    '<div class="grid">' + L.map(function (m) {
      return '<div class="cell" data-act="model" data-v="' + g.id + '" data-m="' + esc(m.name) + '">' + gImg(g, m.name, 'lg sq big') + '<b>' + esc(m.name) + '</b>' + (m.floor != null ? '<span class="p">' + gv(m.floor) + '</span>' : '') + (m.rarity != null && m.change == null ? '<span class="p">' + m.rarity + '‰</span>' : '') + pillN(m.change) + '</div>';
    }).join('') + '</div>' + (S.ms.length ? '' : '<div class="empty">' + t('no_models') + '</div>');
}
function vGift(tok) {
  $('#view').innerHTML = loadingBox();
  getGifts().then(function (list) {
    var g = list.find(function (x) { return x.id === S.view.id; }); if (!g) return back();
    var mp = S.view.model ? Gifts.models(g.id) : Promise.resolve(null);
    return mp.then(function (ms) {
      if (tok !== S.tok) return;
      var name = g.name, floor = g.floor, chg = g.change, rar = null, lst = null, isModel = false;
      if (ms) { var m = ms.find(function (x) { return x.name === S.view.model; }); if (m) { isModel = true; name = g.name + ' · ' + m.name; floor = m.floor; chg = m.change; rar = m.rarity; lst = m.listings; } }
      var ov = floor != null ? [[t('floor'), gv(floor)]] : [];
      if (chg != null) ov.push([t(Gifts.hasSupply ? 'change24' : 'daily_change'), pill(chg)]);
      if (isModel) {
        if (rar != null) ov.push([t('rarity'), rar + '‰']);
        if (lst != null) ov.push([t('listings'), nf(lst, 0)]);
      } else {
        if (g.sales != null) ov.push([t('recent_sales'), nf(g.sales, 0)]);
        if (Gifts.hasSupply) ov.push([t('minted'), nf(g.supply, 0)], [t('max_supply'), nf(g.maxSupply, 0)], [t('market_cap'), gvBig(g.floor * g.supply)]);
      }
      chartPage({
        imgHtml: gImg(g, isModel ? S.view.model : null, 'lg sq'), title: name, price: floor != null ? gv(floor) : '—', chg: chg, tfs: GTFS, tf: '1d', fname: g.name,
        fetch: function (tf) { return Gifts.chart(g.id, S.view.model || '', tf, floor); },
        isFav: function () { return S.favG.indexOf(g.id) >= 0; }, toggleFav: function () { toggle(S.favG, g.id, 'favG'); },
        models: !S.view.model, gid: g.id, shareText: name + (floor != null ? ' — ' + nf(floor, 2) + ' TON' : ''), overview: ov
      });
    });
  });
}

/* ---------- PROFILE ---------- */
function giftById(id) { return (S.cache.gifts || []).find(function (x) { return x.id === id; }); }
function itemValue(it) { var g = giftById(it.gid); return g ? g.floor * it.qty : 0; }
function vProfile(tok) {
  getGifts().then(function () { if (S.tab === 'profile' && !S.view) paintProfile(); });
}
function paintProfile() {
  var P = S.prof, p = S.p;
  var name = U.first_name || 'User', un = U.username ? '@' + U.username : '@username';
  var av = U.photo_url ? '<img class="av" src="' + esc(U.photo_url) + '">' : '<div class="av">' + esc(name.charAt(0).toUpperCase()) + '</div>';
  var total = 0, wch = 0;
  P.items.forEach(function (it) { var g = giftById(it.gid); if (g) { var v = g.floor * it.qty; total += v; wch += v * g.change; } });
  var pch = total ? wch / total : 0;
  var tabs = '<button class="' + (p.tab === 'assets' ? 'on' : '') + '" data-act="ptab" data-v="assets">' + t('assets') + '</button>' +
    '<button class="' + (p.tab === 'all' ? 'on' : '') + '" data-act="ptab" data-v="all">' + t('all_gifts') + '</button>' +
    P.cols.map(function (c) { return '<button class="' + (p.tab === c.id ? 'on' : '') + '" data-act="ptab" data-v="' + c.id + '">' + esc(c.name) + '</button>'; }).join('') +
    '<button data-act="paddcol">+ ' + t('add_collection') + '</button>';
  var body;
  if (p.tab === 'all') {
    body = '<div class="grid">' + S.cache.gifts.map(function (g) {
      return '<div class="cell" data-act="pgiftadd" data-v="' + g.id + '"><span class="addb">+</span>' + gImg(g, null, 'lg sq big') + '<b>' + esc(g.name) + '</b><span class="p">' + gv(g.floor) + '</span></div>';
    }).join('') + '</div>';
  } else {
    var items = p.tab === 'assets' ? P.items : P.items.filter(function (i) { return i.col === p.tab; });
    body = items.length ? '<div class="grid">' + items.map(function (it) {
      var g = giftById(it.gid); if (!g) return '';
      return '<div class="cell" data-act="' + (p.edit ? 'noop' : 'pitem') + '" data-v="' + it.uid + '">' +
        (p.edit ? '<button class="x" data-act="pdel" data-v="' + it.uid + '">×</button>' : (it.num ? '<span class="num">#' + esc(it.num) + '</span>' : '')) +
        gImg(g, null, 'lg sq big') + '<b>' + esc(g.name) + (it.qty > 1 ? ' ×' + it.qty : '') + '</b><span class="p">' + gv(g.floor * it.qty) + '</span></div>';
    }).join('') + '</div>' : '<div class="empty">' + t('empty_assets') + '</div>';
  }
  $('#view').innerHTML =
    '<div class="pf">' + av + '<h2>' + esc(name) + '</h2></div>' +
    '<div class="pacts"><button data-act="padd">' + ICON.plus + t('add') + '</button><button class="' + (p.edit ? 'on' : '') + '" data-act="pedit">' + ICON.edit + t('edit') + '</button><button data-act="pmore">' + ICON.more + t('more') + '</button></div>' +
    '<div class="card"><div class="kv" style="display:block;padding:12px 0"><b class="u" style="color:var(--accent)">' + esc(un) + '</b><br><small style="color:var(--muted)">' + t('username') + '</small></div>' +
    '<div class="val"><b style="font-size:18px">' + gv(total) + '</b> <span class="' + (pch >= 0 ? 'up-t' : 'down-t') + '">' + (pch > 0 ? '+' : '') + pch.toFixed(2) + '%</span><small>' + t('assets_value') + '</small>' +
    '<button class="pulse" data-act="ppulse">' + ICON.pulse + '</button></div></div>' +
    '<div class="tabs">' + tabs + '</div>' + body;
}
function vPortfolio(tok) {
  getGifts().then(function () {
    if (tok !== S.tok) return;
    var items = S.prof.items;
    var total = items.reduce(function (a, it) { return a + itemValue(it); }, 0);
    chartPage({
      img: Gifts.img('Portfolio'), sq: true, title: t('portfolio_chart'), price: gv(total), chg: 0, tfs: GTFS, tf: '1d', fname: 'portfolio',
      shareText: t('portfolio_chart') + ' — ' + nf(total, 2) + ' TON',
      fetch: function (tf) {
        if (!items.length) return Promise.resolve([]);
        return Promise.all(items.map(function (it) { var g = giftById(it.gid); return Gifts.chart(it.gid, '', tf, g.floor); })).then(function (all) {
          // دمج السلاسل على محور زمني موحّد (آخر قيمة معروفة تتكرر لو ناقصة)
          var times = {};
          all.forEach(function (arr) { arr.forEach(function (c) { times[c.time] = 1; }); });
          var ts = Object.keys(times).map(Number).sort(function (a, b) { return a - b; });
          var idx = all.map(function () { return 0; }), last = all.map(function () { return null; });
          return ts.map(function (tm) {
            var o = { time: tm, open: 0, high: 0, low: 0, close: 0 };
            all.forEach(function (arr, k) {
              while (idx[k] < arr.length && arr[idx[k]].time <= tm) { last[k] = arr[idx[k]]; idx[k]++; }
              var c = last[k] || arr[0]; if (!c) return;
              var q = items[k].qty; o.open += c.open * q; o.high += c.high * q; o.low += c.low * q; o.close += c.close * q;
            });
            return o;
          });
        });
      }
    });
  });
}
function itemForm(gid, col) {
  var gifts = S.cache.gifts, cols = S.prof.cols;
  modal('<h3>' + t('add') + '</h3>' +
    '<div class="frow"><label>' + t('select_gift') + '</label><select id="f_g">' + gifts.map(function (g) { return '<option value="' + g.id + '" ' + (g.id === gid ? 'selected' : '') + '>' + esc(g.name) + '</option>'; }).join('') + '</select></div>' +
    '<div class="frow"><label>' + t('number') + '</label><input id="f_n" inputmode="numeric" placeholder="#"></div>' +
    '<div class="frow"><label>' + t('qty') + '</label><input id="f_q" type="number" min="1" value="1"></div>' +
    (cols.length ? '<div class="frow"><label>' + t('collection') + '</label><select id="f_c"><option value="">' + t('no_collection') + '</option>' + cols.map(function (c) { return '<option value="' + c.id + '" ' + (c.id === col ? 'selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' : '') +
    '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('cancel') + '</button><button class="btn" data-act="fsave">' + t('save') + '</button></div>');
}

/* ---------- SETTINGS ---------- */
function seg(act, opts, cur) {
  return '<div class="seg">' + opts.map(function (o) { return '<button class="' + (cur === o[0] ? 'on' : '') + '" data-act="' + act + '" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
}
function sw(key) { return '<button class="sw ' + (S.alerts[key] ? 'on' : '') + '" data-act="alert" data-v="' + key + '"><i></i></button>'; }
function vSettings() {
  var csNames = { candles: t('candles'), line: t('line'), area: t('area') };
  $('#view').innerHTML =
    '<div class="card">' +
    '<div class="srow"><span class="si" style="background:#6d5dfc">' + ICON.moon + '</span><b>' + t('theme') + '</b>' + seg('theme', [['dark', ICON.moon], ['light', ICON.sun]], S.theme) + '</div>' +
    '<div class="srow"><span class="si" style="background:#2f80ed">' + ICON.globe + '</span><b>' + t('language') + '</b>' + seg('lang', [['ru', 'RU'], ['en', 'EN'], ['ar', 'AR']], S.lang) + '</div>' +
    '<div class="srow"><span class="si" style="background:#1fb5b0">' + ICON.dollar + '</span><b>' + t('currency') + '</b>' + seg('cur', [['gem', GEM], ['usd', '$']], S.cur) + '</div>' +
    '<div class="srow" data-act="csToggle" style="cursor:pointer"><span class="si" style="background:#5b5ff0">' + ICON.chartI + '</span><b>' + t('chart_style') + '</b><span style="color:var(--muted)">' + csNames[S.cs] + ' ' + (S.csOpen ? '⌃' : '⌄') + '</span></div>' +
    (S.csOpen ? '<div class="opts">' + ['candles', 'line', 'area'].map(function (k) { return '<button class="' + (S.cs === k ? 'on' : '') + '" data-act="cs" data-v="' + k + '">' + csNames[k] + '</button>'; }).join('') + '</div>' : '') +
    '</div>' +
    '<div class="lbl">' + t('alerts') + '</div>' +
    '<div class="card">' +
    '<div class="srow"><span class="si" style="background:#6d5dfc">' + ICON.brief + '</span><b>' + t('portfolio_summary') + '<small>' + t('portfolio_sub') + '</small></b>' + sw('portfolio') + '</div>' +
    '<div class="srow"><span class="si" style="background:#22c55e">' + ICON.bolt + '</span><b>' + t('pumps') + '<small>' + t('pumps_sub') + '</small></b>' + sw('pumps') + '</div></div>' +
    '<div class="note">' + t('needs_server') + '</div>' +
    '<div class="promos">' +
    '<button class="promo" data-act="grp" style="background:linear-gradient(135deg,var(--card),#7c4a1b55)"><span class="si" style="background:#f97316">' + ICON.users + '</span><b>' + t('to_group') + '</b><small>' + t('to_group_sub') + '</small></button>' +
    '<button class="promo" data-act="chn" style="background:linear-gradient(135deg,var(--card),#1b3f7c55)"><span class="si" style="background:#3b82f6">' + ICON.mega + '</span><b>' + t('to_channel') + '</b><small>' + t('to_channel_sub') + '</small></button></div>' +
    '<div style="text-align:center;margin-top:10px"><button class="chip" data-act="diag">' + t('diagnostics') + '</button></div>' +
    '<div class="attr">' + t('data_credit') + ': TG Gifts (tggifts.com) · Baltic Assets (balticassets.eu) — CC BY 4.0<br>' + t('images_credit') + ': <a href="#" data-act="credit" style="color:var(--accent)">@GiftChanges</a><br>Charts: TradingView Lightweight Charts™ · Crypto: CoinGecko, Binance · ' + esc(CONFIG.BRAND) + ' v' + esc(CONFIG.VERSION) + '</div>';
}

/* ---------- actions ---------- */
function openTg(url) { try { if (tg && tg.openTelegramLink) return tg.openTelegramLink(url); } catch (e) {} window.open(url, '_blank'); }
var A = {
  noop: function () {},
  tab: function (v) { setTab(v); },
  back: function () { back(); },
  retry: function () { S.cache.ct = 0; render(); },
  retrychart: function () { drawCP(); },
  mclose: function () { closeModal(); },
  sheetpick: function (v) { var f = SHEET_FN[+v]; closeModal(); if (f) f(); },
  pkpick: function (v) {
    if (PICK.multi) { PICK.onPick(v); paintPicker($('#pq').value); } else { closeModal(); PICK.onPick(v); }
  },
  // crypto
  ctab: function (v) { S.c.tab = v; paintCrypto(); },
  cview: function (v) { S.c.grid = v === 'grid'; paintCrypto(); },
  csort: function () {
    var k = S.c.key, opts = [['cap', t('market_cap')], ['price', t('price')], ['chg', t('change24')], ['name', t('name')]];
    var rows = opts.map(function (o) { return { l: o[1], on: k === o[0], f: function () { S.c.key = o[0]; paintCryptoList(); } }; });
    rows.push({ l: S.c.asc ? t('desc') : t('asc'), f: function () { S.c.asc = !S.c.asc; paintCryptoList(); } });
    sheet(t('sort_by'), rows);
  },
  addcoins: function () {
    picker({ title: t('add_coins'), multi: true, isSel: function (id) { return S.favC.indexOf(id) >= 0; },
      items: S.cache.coins.map(function (c) { return { id: c.id, name: c.name, sub: c.symbol.toUpperCase(), img: c.image }; }),
      onPick: function (id) { toggle(S.favC, id, 'favC'); paintCryptoList(); } });
  },
  coin: function (v) { go({ type: 'coin', id: v }); },
  // chart page
  cptab: function (v) {
    S.cpState.tab = v;
    document.querySelectorAll('.tabs2 button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    paintCP();
  },
  tf: function (v) {
    S.cpState.tf = v;
    document.querySelectorAll('.tf').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); });
    drawCP();
  },
  fav: function () {
    S.cp.toggleFav();
    var on = S.cp.isFav(), b = $('#favbtn');
    b.classList.toggle('on', on); b.innerHTML = on ? ICON.heartF : ICON.heart;
  },
  share: function () {
    var link = 'https://t.me/' + CONFIG.BOT_USERNAME;
    openTg('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(S.cp.shareText || CONFIG.BRAND));
  },
  dl: function () {
    if (!S.chart || !S.chart.takeScreenshot) return;
    try {
      var cv = S.chart.takeScreenshot(), a = document.createElement('a');
      a.href = cv.toDataURL('image/png'); a.download = CONFIG.BRAND + '-' + (S.cp.fname || 'chart') + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
  },
  cpmodels: function () { go({ type: 'models', id: S.cp.gid }); },
  // gifts
  credit: function (v, el, e) { if (e && e.preventDefault) e.preventDefault(); openTg('https://t.me/GiftChanges'); },
  diag: function () {
    modal('<h3>' + t('diagnostics') + '</h3><div id="dg" class="loading">' + t('loading') + '</div>');
    Gifts.diagnose().then(function (rows) {
      var el = $('#dg'); if (!el) return;
      el.className = '';
      el.innerHTML = rows.map(function (r) {
        return '<div class="kv" style="padding:9px 0;gap:10px"><span style="flex:1">' + esc(r[0]) + '</span><b style="font-size:12px;text-align:end;color:var(--' + (r[1] ? 'up' : 'down') + ')">' + (r[1] ? '✓ ' : '✗ ') + esc(r[2]) + '</b></div>';
      }).join('') + '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>';
    });
  },
  gretry: function () { Gifts.reset(); S.cache.gifts = null; render(); },
  gtab: function (v) { S.g.tab = v; paintGifts(); },
  gmap: function () { S.g.map = !S.g.map; paintGifts(); },
  gift: function (v) { go({ type: 'gift', id: v }); },
  models: function (v) { go({ type: 'models', id: v }); },
  model: function (v, el) { go({ type: 'gift', id: v, model: el.dataset.m }); },
  mtab: function (v) { S.mtab.v = v; var g = giftById(S.mtab.gid); paintModels(g); },
  addgifts: function () {
    picker({ title: t('add_gifts'), multi: true, isSel: function (id) { return S.favG.indexOf(id) >= 0; },
      items: S.cache.gifts.map(function (g) { return { id: g.id, name: g.name, html: gImg(g, null, 'lg sq') }; }),
      onPick: function (id) { toggle(S.favG, id, 'favG'); paintGiftList(); } });
  },
  // profile
  ptab: function (v) { S.p.tab = v; paintProfile(); },
  padd: function () {
    picker({ title: t('select_gift'), multi: false, items: S.cache.gifts.map(function (g) { return { id: g.id, name: g.name, html: gImg(g, null, 'lg sq') }; }),
      onPick: function (id) { itemForm(id, S.p.tab !== 'assets' && S.p.tab !== 'all' ? S.p.tab : ''); } });
  },
  pgiftadd: function (v) { itemForm(v, ''); },
  fsave: function () {
    var q = Math.max(1, parseInt($('#f_q').value, 10) || 1), n = $('#f_n').value.trim().replace(/^#/, '');
    var cEl = $('#f_c');
    S.prof.items.push({ uid: 'i' + Date.now() + Math.floor(Math.random() * 1000), gid: $('#f_g').value, num: n, qty: q, col: cEl ? cEl.value : '' });
    store.set('prof', S.prof); closeModal(); paintProfile();
  },
  pedit: function () { S.p.edit = !S.p.edit; paintProfile(); },
  pdel: function (v) { S.prof.items = S.prof.items.filter(function (i) { return i.uid !== v; }); store.set('prof', S.prof); paintProfile(); },
  pitem: function (v) {
    var rows = [];
    S.prof.cols.forEach(function (c) { rows.push({ l: t('move_to') + ': ' + c.name, f: function () { S.prof.items.forEach(function (i) { if (i.uid === v) i.col = c.id; }); store.set('prof', S.prof); paintProfile(); } }); });
    rows.push({ l: t('no_collection'), f: function () { S.prof.items.forEach(function (i) { if (i.uid === v) i.col = ''; }); store.set('prof', S.prof); paintProfile(); } });
    rows.push({ l: t('delete'), red: true, f: function () { A.pdel(v); } });
    sheet(t('edit'), rows);
  },
  paddcol: function () {
    modal('<h3>' + t('new_collection') + '</h3><div class="frow"><label>' + t('name') + '</label><input id="f_name"></div><div class="btns"><button class="btn ghost" data-act="mclose">' + t('cancel') + '</button><button class="btn" data-act="colsave">' + t('save') + '</button></div>');
  },
  colsave: function () {
    var n = $('#f_name').value.trim(); if (!n) return;
    var id = 'c' + Date.now(); S.prof.cols.push({ id: id, name: n }); store.set('prof', S.prof); S.p.tab = id; closeModal(); paintProfile();
  },
  pmore: function () {
    var rows = [];
    var col = S.prof.cols.find(function (c) { return c.id === S.p.tab; });
    if (col) {
      rows.push({ l: t('rename'), f: function () {
        modal('<h3>' + t('rename') + '</h3><div class="frow"><input id="f_name" value="' + esc(col.name) + '"></div><div class="btns"><button class="btn ghost" data-act="mclose">' + t('cancel') + '</button><button class="btn" data-act="colren">' + t('save') + '</button></div>');
      } });
      rows.push({ l: t('delete_collection'), red: true, f: function () {
        S.prof.cols = S.prof.cols.filter(function (c) { return c.id !== col.id; });
        S.prof.items.forEach(function (i) { if (i.col === col.id) i.col = ''; });
        store.set('prof', S.prof); S.p.tab = 'assets'; paintProfile();
      } });
    }
    rows.push({ l: t('clear_all'), red: true, f: function () { S.prof.items = []; store.set('prof', S.prof); paintProfile(); } });
    sheet(t('more'), rows);
  },
  colren: function () {
    var n = $('#f_name').value.trim(); if (!n) return;
    S.prof.cols.forEach(function (c) { if (c.id === S.p.tab) c.name = n; });
    store.set('prof', S.prof); closeModal(); paintProfile();
  },
  ppulse: function () { go({ type: 'portfolio' }); },
  // settings
  theme: function (v) { S.theme = v; store.set('theme', v); applyTheme(); vSettings(); },
  lang: function (v) { S.lang = v; store.set('lang', v); applyTheme(); renderNav(); vSettings(); },
  cur: function (v) { S.cur = v; store.set('cur', v); vSettings(); },
  csToggle: function () { S.csOpen = !S.csOpen; vSettings(); },
  cs: function (v) { S.cs = v; store.set('cs', v); vSettings(); },
  alert: function (v) { S.alerts[v] = !S.alerts[v]; store.set('alerts', S.alerts); vSettings(); },
  grp: function () { openTg('https://t.me/' + CONFIG.BOT_USERNAME + '?startgroup=true'); },
  chn: function () { openTg('https://t.me/' + CONFIG.BOT_USERNAME + '?startchannel=true'); }
};

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (!el) { if (e.target.id === 'modal') closeModal(); return; }
  var fn = A[el.dataset.act];
  if (fn) fn(el.dataset.v, el, e);
});
document.addEventListener('input', function (e) {
  if (e.target.id === 'q') {
    if (S.tab === 'crypto' && !S.view) { S.c.q = e.target.value; paintCryptoList(); }
    else if (S.tab === 'gifts' && !S.view) { S.g.q = e.target.value; paintGiftList(); }
  } else if (e.target.id === 'pq') paintPicker(e.target.value);
});
document.addEventListener('change', function (e) {
  if (e.target.id === 'metric') { S.g.metric = e.target.value; paintGiftList(); }
});

/* ---------- boot ---------- */
applyTheme();
try { if (tg) { tg.ready(); tg.expand(); tg.BackButton.onClick(back); } } catch (e) {}
render();
// تحديث تلقائي لقائمة العملات كل دقيقة
setInterval(function () {
  if (document.hidden || S.tab !== 'crypto' || S.view || !$('#list')) return;
  Crypto.markets().then(function (c) { S.cache.coins = c; S.cache.ct = Date.now(); setTon(); if (S.tab === 'crypto' && !S.view && $('#list')) paintCryptoList(); }).catch(function () {});
}, 60000);
})();
