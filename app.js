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

var GTFS = ['1d', '1w', '1M']; // الوضع التجريبي فقط
var GTFS2 = ['2h', '4h', '1d', '1w', '1M']; // شارت الهدايا الحي (مبيعات + لقطات الفلور)
var MKT = ['all', 'portals', 'tonnel', 'mrkt', 'getgems', 'tg'];
var MKT_LABEL = { portals: 'Portals', tonnel: 'Tonnel', mrkt: 'MRKT', getgems: 'GetGems', tg: 'Telegram' };
function mktName(k) { return k === 'all' ? t('all_markets') : (MKT_LABEL[k] || k); }
function fmtDate(ts) { return new Date(ts * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
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
  c: { tab: 'all', q: '', key: 'cap', asc: false, grid: false, map: false, metric: 'cap', top: 50 },
  g: { tab: 'all', q: '', map: false, metric: 'cap', top: 50 },
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
  tmap: I('<rect x="3" y="3" width="10" height="18" rx="1.500"/><rect x="15" y="3" width="6" height="8" rx="1.500"/><rect x="15" y="13" width="6" height="8" rx="1.500"/>'),
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
function addSeries(chart, data, forced) {
  var up = '#22c55e', down = '#ef4444', s, st = forced || S.cs;
  if (st === 'candles') {
    s = chart.addCandlestickSeries({ upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
    s.setData(data);
  } else if (st === 'line') {
    s = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2 });
    s.setData(data.map(function (x) { return { time: x.time, value: x.close }; }));
  } else {
    s = chart.addAreaSeries({ lineColor: '#3b82f6', topColor: 'rgba(59,130,246,.4)', bottomColor: 'rgba(59,130,246,0)' });
    s.setData(data.map(function (x) { return { time: x.time, value: x.close }; }));
  }
  return s;
}
function makeChart(box, data, forced) {
  killChart();
  box.innerHTML = '';
  if (!data || !data.length) { box.innerHTML = '<div class="empty">' + t('no_history') + '</div>'; return; }
  var dark = S.theme === 'dark';
  var chart = LightweightCharts.createChart(box, {
    width: box.clientWidth, height: box.clientHeight,
    layout: { background: { color: 'transparent' }, textColor: dark ? '#9aa0a6' : '#555' },
    grid: { vertLines: { color: dark ? '#1b1b1f' : '#e8e8ee' }, horzLines: { color: dark ? '#1b1b1f' : '#e8e8ee' } },
    rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true },
    watermark: { visible: true, text: '@' + CONFIG.BRAND, fontSize: 34, color: dark ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.1)', horzAlign: 'center', vertAlign: 'center' }
  });
  S.lastData = data; S.lastForced = forced;
  addSeries(chart, data, forced);
  chart.timeScale().fitContent();
  S.chart = chart;
  if (window.ResizeObserver) {
    S.ro = new ResizeObserver(function () { try { chart.applyOptions({ width: box.clientWidth }); } catch (e) {} });
    S.ro.observe(box);
  }
}

/* generic chart page used by coins, gifts, models, portfolio */
function chartPage(cfg) {
  S.cp = cfg; S.cpState = { tab: 'price', tf: cfg.tf, mode: cfg.mode || null, market: 'all', sn: 40 };
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
    (cfg.extra || []).map(function (x) { return '<button data-act="cptab" data-v="' + x.id + '">' + esc(x.label) + '</button>'; }).join('') +
    (cfg.overview ? '<button data-act="cptab" data-v="ov">' + t('overview') + '</button>' : '') + '</div>' +
    '<div id="cpbody"></div>';
  paintCP();
}
function cpCtl(noModes) {
  var cfg = S.cp, st = S.cpState, h = '';
  if (!noModes && cfg.modes && cfg.modes.length > 1) {
    h += '<div class="chips">' + cfg.modes.map(function (m) { return '<button class="chip2 ' + (st.mode === m ? 'on' : '') + '" data-act="cpmode" data-v="' + m + '">' + t('mode_' + m) + '</button>'; }).join('') + '</div>';
  }
  if (cfg.markets && !(cfg.hideMkt || ['frag']).includes(noModes ? '' : st.mode)) {
    h += '<div class="chips">' + MKT.map(function (m) { return '<button class="chip2 ' + (st.market === m ? 'on' : '') + '" data-act="cpmkt" data-v="' + m + '">' + esc(mktName(m)) + '</button>'; }).join('') + '</div>';
  }
  return h;
}
function paintCP() {
  var cfg = S.cp, st = S.cpState, body = $('#cpbody');
  killChart();
  if (st.tab === 'ov') {
    body.innerHTML = '<div class="card" id="ovc">' + cfg.overview.map(function (r) { return '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
    if (cfg.ovAsync) {
      var otk = S.ctok;
      cfg.ovAsync().then(function (rows) {
        var c = $('#ovc'); if (!c || otk !== S.ctok || !rows || !rows.length) return;
        c.insertAdjacentHTML('beforeend', rows.map(function (r) { return '<div class="kv"><span>' + esc(r[0]) + '</span><b>' + r[1] + '</b></div>'; }).join(''));
      }).catch(function () {});
    }
    return;
  }
  var ex = (cfg.extra || []).find(function (x) { return x.id === st.tab; });
  if (ex) { body.innerHTML = cpCtl(true) + '<div id="cpx"><div class="loading">' + t('loading') + '</div></div>'; var tk = ++S.ctok; ex.render($('#cpx'), st, function () { return tk === S.ctok && $('#cpx'); }); return; }
  var note = typeof cfg.note === 'function' ? cfg.note(st) : (cfg.note || '');
  body.innerHTML = cpCtl() + '<div class="tfs">' + cfg.tfs.map(function (x) { return '<button class="tf ' + (x === st.tf ? 'on' : '') + '" data-act="tf" data-v="' + x + '">' + x + '</button>'; }).join('') + '</div><div id="chart" class="chart"></div>' + '<div class="note" id="cpnote"' + (note ? '' : ' style="display:none"') + '>' + esc(note) + '</div>';
  drawCP();
}
function drawCP() {
  var tok = ++S.ctok, box = $('#chart');
  if (!box) return;
  box.innerHTML = loadingBox();
  S.cp.fetch(S.cpState.tf, S.cpState).then(function (data) {
    if (tok !== S.ctok || !$('#chart')) return;
    if ((!data || !data.length) && S.cp.emptyMsg) { S.lastData = null; $('#chart').innerHTML = '<div class="empty">' + esc(S.cp.emptyMsg(S.cpState)) + '</div>'; return; }
    makeChart($('#chart'), data, S.cp.forceStyle);
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
    '<button class="ib ' + (!c.grid && !c.map ? 'act' : '') + '" data-act="cview" data-v="list">' + ICON.list + '</button>' +
    '<button class="ib ' + (c.grid && !c.map ? 'act' : '') + '" data-act="cview" data-v="grid">' + ICON.grid + '</button>' +
    '<button class="ib ' + (c.map ? 'act' : '') + '" data-act="cview" data-v="map">' + ICON.tmap + '</button></div>' +
    (c.map ? '' : sum) + '<div id="list"></div>';
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
  if (c.map) return paintCoinMap(L, box);
  if (c.grid) {
    html = '<div class="grid">' + L.map(function (x) {
      return '<div class="cell" data-act="coin" data-v="' + esc(x.id) + '"><img class="lg" src="' + esc(x.image) + '" loading="lazy"><b>' + esc(x.symbol.toUpperCase()) + '</b><span class="p">$' + fmtPrice(x.current_price) + '</span>' + pill(x.price_change_percentage_24h) + '</div>';
    }).join('') + '</div>';
  } else {
    html = L.map(function (x) {
      return '<div class="row" data-act="coin" data-v="' + esc(x.id) + '"><img class="lg" src="' + esc(x.image) + '" loading="lazy"><div class="nm">' + esc(x.name) + '</div><div class="pr">$' + fmtPrice(x.current_price) + '</div>' + pill(x.price_change_percentage_24h) + '</div>';
    }).join('');
  }
  box.innerHTML = html + (c.tab === 'fav' ? addBtn : '') + (c.q && c.q.length >= 2 && (c.tab === 'all' || c.tab === 'fav') ? '<div id="xs"></div>' : '');
  if (c.q && c.q.length >= 2 && (c.tab === 'all' || c.tab === 'fav')) xSearch(c.q);
}
// بحث بالاسم في كل العملات (أكتر من أول 100) عبر CoinGecko
var xTimer = null, xTok = 0;
function xSearch(q) {
  clearTimeout(xTimer);
  var tk = ++xTok;
  xTimer = setTimeout(function () {
    Crypto.search(q).then(function (arr) {
      if (tk !== xTok || !$('#xs')) return;
      var have = {}; (S.cache.coins || []).forEach(function (x) { have[x.id] = 1; });
      var res = arr.filter(function (x) { return !have[x.id]; }).slice(0, 12);
      $('#xs').innerHTML = res.length
        ? '<div class="xh">' + t('search_all') + '</div>' + res.map(function (x) {
          return '<div class="row" data-act="xcoin" data-v="' + esc(x.id) + '"><img class="lg" src="' + esc(x.thumb || x.large || '') + '" loading="lazy"><div class="nm">' + esc(x.name) + ' <small style="color:var(--muted)">' + esc((x.symbol || '').toUpperCase()) + '</small></div><div class="pr" style="color:var(--muted)">' + (x.market_cap_rank ? '#' + x.market_cap_rank : '') + '</div></div>';
        }).join('')
        : (coinList().length ? '' : '<div class="empty"><p>' + t('no_results') + '</p></div>');
    }).catch(function () {});
  }, 450);
}
function vCoin(tok) {
  var load = S.cache.coins ? Promise.resolve(S.cache.coins) : Crypto.markets().then(function (c) { S.cache.coins = c; S.cache.ct = Date.now(); return c; });
  $('#view').innerHTML = loadingBox();
  load.then(function (coins) {
    if (tok !== S.tok) return;
    var c = coins.find(function (x) { return x.id === S.view.id; }) || (S.cache.extra && S.cache.extra[S.view.id]);
    if (!c) return back();
    chartPage({
      img: c.image, title: c.name, price: '$' + fmtPrice(c.current_price), chg: c.price_change_percentage_24h,
      priceTxt: '$' + fmtPrice(c.current_price), imgUrls: function () { return [Gifts.thumb(c.image, 160, 'png')]; }, subTxt: function () { return c.symbol.toUpperCase() + '/USD'; },
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
    : '<div class="demo" style="color:var(--up);border-color:#22c55e55">● ' + t('live') + ' · ' + esc(Gifts.source) + (Gifts.mk ? ' · Gift Satellite (' + Gifts.mk.hit + ')' : '') + (Gifts.rateSrc ? ' · $ ' + esc(Gifts.rateSrc) : '') + '</div>';
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
/* ---------- Treemap مشترك (هدايا + كريبتو) ---------- */
function tmColor(c) {
  c = +c || 0;
  var i = Math.min(Math.abs(c) / 5, 1);
  return c >= 0 ? 'hsl(145,85%,' + (37 - 9 * i) + '%)' : 'hsl(3,90%,' + (61 - 11 * i) + '%)';
}
// حجم المربع: مقياس لوغاريتمي، الأولوية للأعلى (سعر/قيمة سوقية)، وأصغر مربع لسه بيتّسع للصورة + الاسم + النسبة
function tmValue(raw, lo, hi) {
  var t0 = hi > lo ? (Math.log(Math.max(raw, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : 0;
  return 1 + 7 * Math.pow(Math.min(1, Math.max(0, t0)), 1.6);
}
function tmScale(arr, get) {
  var v = arr.map(function (x) { return Math.max(1e-9, +get(x) || 0); });
  var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v);
  return arr.map(function (x, i) { return tmValue(v[i], lo, hi); });
}
// items: {id, act, value, name, short, price(html), priceTxt, gem, change, gid, g, imgFn(), imgUrls()}
function tmTiles(items, W, H) {
  return squarify(items, 0, 0, W, H).map(function (n) {
    var w = n.w, h = n.h, c = +n.change || 0, avail = h - 5, gap = 1.5;
    var nm = (n.short && w / (n.name.length * 0.6) < 9) ? n.short : n.name;
    var fs = Math.max(6.5, Math.min(18, w / (Math.max(nm.length, 4) * 0.6), h / 4));
    var iconS = Math.max(12, Math.min(w * 0.6, h * 0.46, 100));
    var price = w >= 38 && h >= 52, chg = w >= 30 && h >= 38;
    var pf = function () { return Math.max(6.5, fs * 0.75); };
    var total = function () {
      var t = iconS + fs * 1.2 + gap;
      if (price) t += pf() * 1.2 + gap;
      if (chg) t += pf() * 1.2 + gap;
      return t;
    };
    for (var it = 0; it < 60 && total() > avail; it++) {
      if (price) price = false;
      else if (iconS > 12.5) iconS = Math.max(12, iconS * 0.9);
      else if (fs > 6.6) fs = Math.max(6.5, fs * 0.92);
      else if (chg) chg = false;
      else break;
    }
    n.c = c; n.nm = nm; n.fs = fs; n.pfs = pf(); n.iconS = iconS; n.showIcon = !!n.imgFn; n.showName = true; n.showChg = chg; n.showPrice = price;
    return n;
  });
}
function treemapHtml(items, W, H) {
  return tmTiles(items, W, H).map(function (n) {
    var w = n.w, h = n.h, c = n.c, fs = n.fs;
    return '<div class="tile" data-act="' + n.act + '" data-v="' + esc(n.id) + '" style="left:' + n.x.toFixed(1) + 'px;top:' + n.y.toFixed(1) + 'px;width:' + w.toFixed(1) + 'px;height:' + h.toFixed(1) + 'px;background:' + tmColor(c) + '">' +
      (n.showIcon ? '<span class="tw" style="width:' + n.iconS.toFixed(0) + 'px;height:' + n.iconS.toFixed(0) + 'px">' + n.imgFn() + '</span>' : '') +
      '<b style="font-size:' + fs.toFixed(1) + 'px">' + esc(n.nm) + '</b>' +
      (n.showPrice ? '<i class="tp" style="font-size:' + n.pfs.toFixed(1) + 'px">' + n.price + '</i>' : '') +
      (n.showChg ? '<i style="font-size:' + n.pfs.toFixed(1) + 'px">' + (c > 0 ? '+' : '') + c.toFixed(2) + '%</i>' : '') + '</div>';
  }).join('');
}
var FOOT = 28; // شريط تحت الخريطة فيه @ARBTON (عشان ما يغطيش أي مربع)
function mapHeight(n) { return Math.max(440, Math.round(window.innerHeight - 190)); }
// أصغر ارتفاع بحيث كل مربع يتّسع للصورة + الاسم + النسبة. الخريطة بتتفرد بالارتفاع بدل ما تخبّي مربعات
function tmFit(items, W, H0) {
  var H = H0, cap = items.length <= 50 ? 880 : 1500; // سقف الارتفاع: 50 مربع تقريباً شاشة ونص، و100 حوالي شاشتين
  for (var i = 0; i < 60; i++) {
    var ok = squarify(items, 0, 0, W, H).every(function (n) { return n.w >= 32 && n.h >= 36; });
    if (ok || H >= cap) break;
    H = Math.min(cap, Math.round(H * 1.04));
  }
  return H;
}
function fillTreemap(items, title, total) {
  var tm = $('#tm');
  if (!tm) return;
  if (!items.length) { tm.innerHTML = '<div class="empty">—</div>'; S.tmData = null; return; }
  items.sort(function (a, b) { return b.value - a.value; });
  var W = tm.clientWidth, H = tmFit(items, W, mapHeight());
  tm.style.height = (H + FOOT) + 'px';
  tm.innerHTML = treemapHtml(items, W, H) + '<div class="tmwm">@' + esc(CONFIG.BRAND) + '</div>';
  var cnt = $('#tmcount'); if (cnt) cnt.textContent = t('shown_count').replace('{n}', tm.querySelectorAll('.tile').length).replace('{m}', total);
  S.tmData = { items: items, W: W, H: H, title: title };
}
function mapRow(metricHtml, topHtml) {
  return '<div class="mrow">' + metricHtml + topHtml + '<button class="ib" data-act="mshare">' + ICON.share + '</button><button class="ib" data-act="mdl">' + ICON.dl + '</button></div>';
}
function topSelect(id, top) {
  return '<select id="' + id + '"><option value="50" ' + (top === 50 ? 'selected' : '') + '>' + t('map_top') + ' 50</option><option value="100" ' + (top === 100 ? 'selected' : '') + '>' + t('map_top') + ' 100</option></select>';
}
function paintMap(L, box) {
  var m = Gifts.hasSupply ? S.g.metric : 'floor', top = S.g.top || 50;
  var key = function (x) { return m === 'cap' ? x.floor * x.supply : x.floor; };
  var all = L.slice().sort(function (a, b) { return key(b) - key(a); }), pick = all.slice(0, top);
  var vals = tmScale(pick, key);
  var items = pick.map(function (x, i) {
    return { id: x.id, act: 'gift', value: vals[i], name: x.name, short: x.name.split(' ')[0],
             price: gv(x.floor), priceTxt: S.cur === 'gem' ? nf(x.floor, 2) : '$' + nf(x.floor * Gifts.tonUsd, 2), gem: S.cur === 'gem',
             change: x.change, gid: x.id, g: x, imgFn: function () { return gImg(x, null, 'tim'); } };
  });
  box.innerHTML = mapRow('<select id="metric">' +
    (Gifts.hasSupply ? '<option value="cap" ' + (m === 'cap' ? 'selected' : '') + '>' + t('market_cap') + '</option>' : '') +
    '<option value="floor" ' + (m === 'floor' ? 'selected' : '') + '>' + t('floor') + '</option></select>', topSelect('gtop', top)) +
    '<div class="tm" id="tm"></div><div class="note" id="tmcount"></div><div class="note">' + t('size_note') + '</div>';
  fillTreemap(items, t('map_title_gifts') + ' · ' + t('map_top') + ' ' + top, all.length);
}
function paintCoinMap(L, box) {
  var m = S.c.metric, top = S.c.top || 50;
  var val = function (x) { return Math.max(1, m === 'vol' ? x.total_volume : x.market_cap); };
  var all = L.slice().sort(function (a, b) { return val(b) - val(a); }), pick = all.slice(0, top);
  var vals = tmScale(pick, val);
  var items = pick.map(function (x, i) {
    return { id: x.id, act: 'coin', value: vals[i], name: x.name, short: x.symbol.toUpperCase(),
             price: '$' + fmtPrice(x.current_price), priceTxt: '$' + fmtPrice(x.current_price), change: x.price_change_percentage_24h,
             imgUrls: function () { return [Gifts.thumb(x.image, 128, 'png')]; },
             imgFn: function () { return '<img class="tim" src="' + esc(x.image) + '" alt="">'; } };
  });
  box.innerHTML = mapRow('<select id="cmetric"><option value="cap" ' + (m === 'cap' ? 'selected' : '') + '>' + t('market_cap') + '</option>' +
    '<option value="vol" ' + (m === 'vol' ? 'selected' : '') + '>' + t('volume') + '</option></select>', topSelect('ctop', top)) +
    '<div class="tm" id="tm"></div><div class="note" id="tmcount"></div><div class="note">' + t('size_note') + '</div>';
  fillTreemap(items, t('map_title_coins') + ' · ' + t('map_top') + ' ' + top, all.length);
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
/* ---------- شارت الهدية الحي: مبيعات فعلية / فلور (لكل سوق) + تابات المبيعات والفوليوم ---------- */
function salesNote(r) { return t('sales_note').replace('{n}', r.all).replace('{d}', r.since ? fmtDate(r.since) : '—'); }
function renderSalesTab(g, model) {
  return function (box, st, alive) {
    Gifts.salesRows(g, st.market, model).then(function (r) {
      if (!alive()) return;
      if (!r.rows.length) { box.innerHTML = '<div class="empty">' + t('no_sales') + '</div>'; return; }
      var n = st.sn || 40;
      box.innerHTML = '<div class="note">' + esc(salesNote(r)) + '</div><div class="stbl"><div class="srow sh"><span>' + t('date') + '</span><span>' + t('price') + '</span><span>' + t('market') + '</span><span>' + t('gift_no') + '</span></div>' +
        r.rows.slice(0, n).map(function (x) {
          return '<div class="srow" data-act="nft" data-v="' + esc(x[7]) + '"><span class="sd">' + fmtDate(x[0]) + '</span><b>' + gv(x[1]) + '</b><span>' + esc(mktName(x[2] === 'telegram' ? 'tg' : x[2])) + '</span><span class="sn">' + (x[3] != null ? '#' + x[3] : '') + (!model && x[4] ? ' · ' + esc(x[4]) : '') + '</span></div>';
        }).join('') + '</div>' + (r.rows.length > n ? '<div class="empty" style="padding:12px"><button class="btn ghost" data-act="smore">' + t('show_more') + '</button></div>' : '');
    });
  };
}
function renderVolTab(g, model) {
  return function (box, st, alive) {
    Gifts.salesRows(g, st.market, model).then(function (r) {
      if (!alive()) return;
      if (!r.rows.length) { box.innerHTML = '<div class="empty">' + t('no_sales') + '</div>'; return; }
      var v = Gifts.volume(r.rows);
      var cards = [['w24', 'd1'], ['w7', 'd7'], ['w30', 'd30'], ['w_all', 'all']].map(function (w) {
        var x = v[w[1]];
        return '<div class="vc"><small>' + t(w[0]) + '</small><b>' + gvBig(x.vol) + '</b><span>' + x.n + ' ' + t('sales_count') + '</span>' +
          (x.n ? '<span>' + t('avg_price') + ' ' + gv(x.avg) + '</span>' : '') + '</div>';
      }).join('');
      var keys = Object.keys(v.by).sort(function (a, b) { return v.by[b].vol - v.by[a].vol; }), mx = keys.length ? v.by[keys[0]].vol : 1;
      var bars = keys.map(function (k) {
        return '<div class="vb"><div class="vbh"><span>' + esc(mktName(k)) + '</span><b>' + gvBig(v.by[k].vol) + '</b><span>' + v.by[k].n + '</span></div><div class="vbar"><i style="width:' + Math.max(3, v.by[k].vol / mx * 100).toFixed(0) + '%"></i></div></div>';
      }).join('');
      box.innerHTML = '<div class="note">' + esc(salesNote(r)) + '</div><div class="vgrid">' + cards + '</div><div class="card" style="padding:10px 14px"><div class="vt">' + t('vol_by_market') + '</div>' + bars + '</div>';
    });
  };
}
function giftChartCfg(g, o) {
  var modes = ['sales', 'floor'].concat(!o.isModel && g.points && g.points.length > 1 ? ['frag'] : []);
  return {
    imgHtml: gImg(g, o.isModel ? o.model : null, 'lg sq'), title: o.name, price: o.floor != null ? gv(o.floor) : '—', chg: o.chg,
    tfs: GTFS2, tf: '1d', fname: g.name + (o.isModel ? '-' + o.model : ''), modes: modes, mode: modes[0], markets: true,
    hideMkt: o.isModel ? ['floor', 'frag'] : ['frag'], ovAsync: o.ovAsync,
    priceTxt: o.floor != null ? (S.cur === 'gem' ? nf(o.floor, 2) + ' TON' : '$' + nf(o.floor * Gifts.tonUsd, 2)) : '',
    imgUrls: function () { return Gifts.exportImgs(g, o.isModel ? o.model : null); },
    subTxt: function (st) { return t('mode_' + st.mode) + (st.mode !== 'frag' ? ' · ' + mktName(st.market) : ''); },
    fetch: function (tf, st) { return Gifts.series(g, { mode: st.mode, market: st.market, model: o.model, tf: tf }); },
    emptyMsg: function (st) { return st.mode === 'floor' ? t('no_floor_hist') : st.mode === 'frag' ? t('no_history') : t('no_sales'); },
    note: function (st) { return st.mode === 'floor' ? (o.isModel ? t('model_floor_note') : t('floor_note')) : st.mode === 'frag' ? t('daily_note') : ''; },
    extra: [{ id: 'sales', label: t('tab_sales'), render: renderSalesTab(g, o.model) }, { id: 'vol', label: t('tab_volume'), render: renderVolTab(g, o.model) }],
    isFav: function () { return S.favG.indexOf(g.id) >= 0; }, toggleFav: function () { toggle(S.favG, g.id, 'favG'); },
    models: !o.isModel, gid: g.id, shareText: o.name + (o.floor != null ? ' — ' + nf(o.floor, 2) + ' TON' : ''), overview: o.ov
  };
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
      var hasMk = !isModel && g.markets && Gifts.mode === 'live';
      var ov = floor != null ? [[hasMk ? t('best_floor') + ' (' + (Gifts.marketLabel[g.best] || g.best) + ')' : t('floor') + (Gifts.mode === 'live' ? ' (' + t('market_src') + ')' : ''), gv(floor)]] : [];
      if (hasMk) {
        Object.keys(g.markets).sort(function (a, b) { return g.markets[a].p - g.markets[b].p; }).forEach(function (k) {
          var m = g.markets[k];
          ov.push([(Gifts.marketLabel[k] || k) + (k === g.best ? ' ★' : ''), gv(m.p) + ' <small style="opacity:.6">· ' + (m.n >= 50 ? '50+' : m.n) + '</small>']);
        });
        if (g.fragFloor != null) ov.push([t('fragment'), gv(g.fragFloor)]);
      }
      if (chg != null) ov.push([t(Gifts.hasSupply ? 'change24' : 'daily_change'), pill(chg)]);
      var mObj = isModel ? ms.find(function (x) { return x.name === S.view.model; }) : null;
      if (isModel) {
        if (mObj && mObj.live) {
          ov = [[t('best_floor') + ' (' + (Gifts.marketLabel[mObj.best] || mObj.best) + ')', gv(mObj.floor)]];
          Object.keys(mObj.mk || {}).sort(function (a, b) { return mObj.mk[a] - mObj.mk[b]; }).forEach(function (k) {
            ov.push([(Gifts.marketLabel[k] || k) + (k === mObj.best ? ' ★' : ''), gv(mObj.mk[k])]);
          });
          if (chg != null) ov.push([t('change24'), pill(chg)]);
        }
        if (rar != null) ov.push([t('rarity'), rar + '‰']);
        if (lst != null) ov.push([t('listings'), nf(lst, 0)]);
        ov.push([t('collection'), esc(g.name)]);
      } else {
        if (g.sales != null) ov.push([t('recent_sales'), nf(g.sales, 0)]);
        if (Gifts.hasSupply) ov.push([t('minted'), nf(g.supply, 0)], [t('max_supply'), nf(g.maxSupply, 0)], [t('market_cap'), gvBig(g.floor * g.supply)]);
      }
      var mdl = isModel ? S.view.model : '';
      var ovAsync = function () {
        return Gifts.salesRows(g, 'all', mdl).then(function (r) {
          if (!r.rows.length) return [];
          var v = Gifts.volume(r.rows), last = r.rows[0], out = [];
          out.push([t('last_sale'), gv(last[1]) + ' <small style="opacity:.6">· ' + fmtDate(last[0]) + '</small>']);
          out.push([t('w24') + ' · ' + t('total_vol'), gvBig(v.d1.vol) + ' <small style="opacity:.6">· ' + v.d1.n + '</small>']);
          out.push([t('w7') + ' · ' + t('total_vol'), gvBig(v.d7.vol) + ' <small style="opacity:.6">· ' + v.d7.n + '</small>']);
          if (v.d7.n) out.push([t('avg_price') + ' (' + t('w7') + ')', gv(v.d7.avg)], [t('hi') + ' / ' + t('lo') + ' (' + t('w7') + ')', gv(v.d7.hi) + ' / ' + gv(v.d7.lo)]);
          return out;
        });
      };
      if (Gifts.mode === 'live') return chartPage(giftChartCfg(g, { name: name, floor: floor, chg: chg, isModel: isModel, model: mdl, ov: ov, ovAsync: ovAsync }));
      chartPage({
        imgHtml: gImg(g, isModel ? S.view.model : null, 'lg sq'), title: name, price: floor != null ? gv(floor) : '—', chg: chg, tfs: GTFS, tf: '1d', fname: g.name,
        fetch: function (tf) { return Gifts.chart(g.id, S.view.model || '', tf, floor); },
        isFav: function () { return S.favG.indexOf(g.id) >= 0; }, toggleFav: function () { toggle(S.favG, g.id, 'favG'); },
        forceStyle: Gifts.mode === 'live' ? 'area' : null, // المصدر لقطات يومية: خط حقيقي أصدق من شموع مصطنعة
        note: Gifts.mode === 'live' && !isModel ? (hasMk ? t('gs_note') : t('daily_note')) : '',
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
    '<div class="attr">' + t('data_credit') + ': TG Gifts (tggifts.com) · Baltic Assets (balticassets.eu) — CC BY 4.0<br>' + t('prices_src') + ': Gift Satellite (@gift_satellite_app)<br>' + t('images_credit') + ': <a href="#" data-act="credit" style="color:var(--accent)">@GiftChanges</a> · wsrv.nl<br>Charts: TradingView Lightweight Charts™ · Crypto: CoinGecko, Binance · ' + esc(CONFIG.BRAND) + ' v' + esc(CONFIG.VERSION) + '</div>';
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
  cview: function (v) { S.c.grid = v === 'grid'; S.c.map = v === 'map'; paintCrypto(); },
  mshare: function () {
    var link = 'https://t.me/' + CONFIG.BOT_USERNAME;
    openTg('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('@' + CONFIG.BRAND + ' — ' + t('map')));
  },
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
  xcoin: function (v) {
    Crypto.byId(v).then(function (c) {
      if (!c) return;
      S.cache.extra = S.cache.extra || {}; S.cache.extra[c.id] = c;
      go({ type: 'coin', id: c.id });
    }).catch(function () {});
  },
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
  dl: function () { if (S.cpState && S.cpState.tab === 'price') exportChart(); },
  mdl: function () { exportMap(); },
  expsave: function () {
    var a = document.createElement('a'); a.href = S.expUrl; a.download = S.expName || 'arbton.png';
    document.body.appendChild(a); a.click(); a.remove();
  },
  expshare: function () { try { navigator.share({ files: [S.expFile], title: CONFIG.BRAND }); } catch (e) {} },
  cpmode: function (v) { S.cpState.mode = v; paintCP(); },
  cpmkt: function (v) { S.cpState.market = v; S.cpState.sn = 40; paintCP(); },
  smore: function () { S.cpState.sn = (S.cpState.sn || 40) + 40; paintCP(); },
  nft: function (v) { if (v) openTg('https://t.me/nft/' + encodeURIComponent(v)); },
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
  else if (e.target.id === 'cmetric') { S.c.metric = e.target.value; paintCryptoList(); }
  else if (e.target.id === 'gtop') { S.g.top = +e.target.value; paintGiftList(); }
  else if (e.target.id === 'ctop') { S.c.top = +e.target.value; paintCryptoList(); }
});

/* ---------- تصدير صور عالية الجودة (خريطة / شارت) ---------- */
var FONT = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
function loadImgTry(urls, ms) {
  return new Promise(function (resolve) {
    var i = 0, done = false;
    var timer = setTimeout(function () { if (!done) { done = true; resolve(null); } }, ms || 9000);
    (function next() {
      if (done) return;
      if (i >= urls.length) { done = true; clearTimeout(timer); return resolve(null); }
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () { if (!done) { done = true; clearTimeout(timer); resolve(im); } };
      im.onerror = function () { i++; next(); };
      im.src = urls[i];
    })();
  });
}
function iconFor(n) { // صورة المربع للتصدير: CORS-safe عبر wsrv، ولو مفيش Original نجرب أول نموذج
  var urls = n.imgUrls ? n.imgUrls() : (n.g ? Gifts.exportImgs(n.g) : []);
  return loadImgTry(urls).then(function (im) {
    if (im || !n.gid || !Gifts.firstModelImg) return im;
    return Gifts.firstModelImg(n.gid).then(function (u) { return u ? loadImgTry([Gifts.thumb(u.replace(/^https:\/\/wsrv\.nl\/\?url=([^&]+).*$/, function (m, e) { return decodeURIComponent(e); }), 320, 'png')]) : null; }).catch(function () { return null; });
  });
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function fitText(c, txt, maxW) { if (c.measureText(txt).width <= maxW) return txt; while (txt.length > 1 && c.measureText(txt + '…').width > maxW) txt = txt.slice(0, -1); return txt + '…'; }
function showImage(canvas, fname) {
  canvas.toBlob(function (b) {
    if (!b) return modal('<h3>' + t('error') + '</h3><div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>');
    var url = URL.createObjectURL(b), file = null;
    try { file = new File([b], fname, { type: 'image/png' }); } catch (e) {}
    S.expFile = file; S.expUrl = url; S.expName = fname;
    modal('<img class="exp" src="' + url + '" alt=""><div class="note" style="text-align:center">' + t('long_press') + '</div>' +
      '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button>' +
      (file && navigator.canShare && navigator.canShare({ files: [file] }) ? '<button class="btn ghost" data-act="expshare">' + t('share_img') + '</button>' : '') +
      '<button class="btn" data-act="expsave">' + t('save_img') + '</button></div>');
  }, 'image/png');
}
function exportMap() {
  var d = S.tmData; if (!d) return;
  modal('<div class="loading">' + t('generating') + '</div>');
  var tiles = tmTiles(d.items, d.W, d.H);
  var k = Math.min(1600 / d.W, 7600 / (d.H + FOOT)), head = Math.round(50 * k * 0.9), gap = Math.max(1.5, k * 0.8), foot = Math.round(FOOT * k);
  var W = Math.round(d.W * k), H = Math.round(d.H * k) + head + foot;
  Promise.all(tiles.map(function (n) { return n.showIcon ? iconFor(n) : Promise.resolve(null); })).then(function (imgs) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), dark = S.theme === 'dark';
    c.fillStyle = dark ? '#0b0b0d' : '#f2f2f7'; c.fillRect(0, 0, W, H);
    c.fillStyle = dark ? '#fff' : '#111'; c.font = '800 ' + Math.round(head * 0.42) + 'px ' + FONT; c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillText(d.title, k * 8, head / 2);
    c.fillStyle = dark ? '#8e8e93' : '#666'; c.font = '600 ' + Math.round(head * 0.3) + 'px ' + FONT; c.textAlign = 'right';
    c.fillText(new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), W - k * 8, head / 2);
    c.textAlign = 'center';
    tiles.forEach(function (n, idx) {
      var x = n.x * k + gap / 2, y = head + n.y * k + gap / 2, w = n.w * k - gap, h = n.h * k - gap;
      c.fillStyle = tmColor(n.c); rr(c, x, y, w, h, 3 * k * 0.5); c.fill();
      var parts = [];
      if (n.showIcon) parts.push({ t: 'i', h: n.iconS * k });
      if (n.showName) parts.push({ t: 'n', h: n.fs * 1.2 * k });
      if (n.showPrice) parts.push({ t: 'p', h: n.pfs * 1.2 * k });
      if (n.showChg) parts.push({ t: 'c', h: n.pfs * 1.2 * k });
      var g2 = 1.5 * k, tot = parts.reduce(function (a, q) { return a + q.h; }, 0) + g2 * Math.max(0, parts.length - 1), cy = y + (h - tot) / 2, cx = x + w / 2;
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      parts.forEach(function (q) {
        if (q.t === 'i') {
          var sz = q.h, im = imgs[idx];
          if (im) { c.save(); rr(c, cx - sz / 2, cy, sz, sz, sz * 0.18); c.clip(); c.drawImage(im, cx - sz / 2, cy, sz, sz); c.restore(); }
          else { c.fillStyle = 'rgba(255,255,255,.22)'; rr(c, cx - sz / 2, cy, sz, sz, sz * 0.2); c.fill(); c.fillStyle = '#fff'; c.font = '700 ' + sz * 0.5 + 'px ' + FONT; c.textBaseline = 'middle'; c.fillText((n.name || '?').charAt(0).toUpperCase(), cx, cy + sz / 2); }
        } else {
          var fs = (q.t === 'n' ? n.fs : n.pfs) * k;
          c.font = (q.t === 'n' ? '700 ' : '600 ') + fs + 'px ' + FONT; c.textBaseline = 'middle';
          c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = k; c.fillStyle = '#fff';
          var txt = q.t === 'n' ? n.nm : q.t === 'p' ? (n.priceTxt || '') : ((n.c > 0 ? '+' : '') + n.c.toFixed(2) + '%');
          if (q.t === 'p' && n.gem) { var ds = fs * 0.8, tw = c.measureText(txt).width, sx = cx - (tw + ds * 1.2) / 2; c.beginPath(); c.moveTo(sx + ds / 2, cy + q.h / 2 - ds / 2); c.lineTo(sx + ds, cy + q.h / 2 - ds * 0.1); c.lineTo(sx + ds / 2, cy + q.h / 2 + ds / 2); c.lineTo(sx, cy + q.h / 2 - ds * 0.1); c.closePath(); c.fill(); c.textAlign = 'left'; c.fillText(txt, sx + ds * 1.2, cy + q.h / 2); c.textAlign = 'center'; }
          else c.fillText(fitText(c, txt, w * 0.94), cx, cy + q.h / 2);
          c.shadowBlur = 0;
        }
        cy += q.h + g2;
      });
      c.restore();
    });
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '800 ' + Math.round(15 * k) + 'px ' + FONT;
    c.fillStyle = dark ? '#fff' : '#111';
    c.fillText('@' + CONFIG.BRAND, 8 * k, H - foot / 2);
    showImage(cv, CONFIG.BRAND + '-map.png');
  });
}
function exportChart() {
  var data = S.lastData, cfg = S.cp, st = S.cpState;
  if (!data || !data.length || !cfg) return;
  modal('<div class="loading">' + t('generating') + '</div>');
  var W = 1280, H = 760, dark = S.theme === 'dark';
  var div = document.createElement('div'); div.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + W + 'px;height:' + H + 'px';
  document.body.appendChild(div);
  var chart = LightweightCharts.createChart(div, {
    width: W, height: H,
    layout: { background: { color: dark ? '#0b0b0d' : '#ffffff' }, textColor: dark ? '#b8bbc0' : '#444', fontSize: 22 },
    grid: { vertLines: { color: dark ? '#1b1b1f' : '#e8e8ee' }, horzLines: { color: dark ? '#1b1b1f' : '#e8e8ee' } },
    rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true },
    watermark: { visible: true, text: '@' + CONFIG.BRAND, fontSize: 110, color: dark ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.1)', horzAlign: 'center', vertAlign: 'center' }
  });
  addSeries(chart, data, S.lastForced); chart.timeScale().fitContent();
  var imgP = loadImgTry(cfg.imgUrls ? cfg.imgUrls() : []);
  requestAnimationFrame(function () {
    var shot; try { shot = chart.takeScreenshot(); } catch (e) { shot = null; }
    try { chart.remove(); } catch (e) {} div.remove();
    if (!shot) return modal('<h3>' + t('error') + '</h3><div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>');
    imgP.then(function (im) {
      var sc = shot.width / W, head = 150 * sc, cv = document.createElement('canvas');
      cv.width = shot.width; cv.height = Math.round(shot.height + head);
      var c = cv.getContext('2d'); c.fillStyle = dark ? '#0b0b0d' : '#ffffff'; c.fillRect(0, 0, cv.width, cv.height);
      var x0 = 28 * sc;
      if (im) { c.save(); rr(c, x0, 28 * sc, 94 * sc, 94 * sc, 20 * sc); c.clip(); c.drawImage(im, x0, 28 * sc, 94 * sc, 94 * sc); c.restore(); x0 += 114 * sc; }
      c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.fillStyle = dark ? '#fff' : '#111'; c.font = '800 ' + 40 * sc + 'px ' + FONT;
      c.fillText(fitText(c, cfg.title, cv.width - x0 - 330 * sc), x0, 70 * sc);
      c.font = '700 ' + 34 * sc + 'px ' + FONT; c.fillText(cfg.priceTxt || '', x0, 114 * sc);
      var pw = c.measureText(cfg.priceTxt || '').width;
      if (cfg.chg != null) { c.fillStyle = cfg.chg >= 0 ? '#22c55e' : '#ef4444'; c.font = '700 ' + 28 * sc + 'px ' + FONT; c.fillText((cfg.chg > 0 ? '+' : '') + Number(cfg.chg).toFixed(2) + '%', x0 + pw + 18 * sc, 114 * sc); }
      c.textAlign = 'right'; c.fillStyle = dark ? '#8e8e93' : '#666'; c.font = '600 ' + 26 * sc + 'px ' + FONT;
      var sub = (cfg.subTxt ? cfg.subTxt(st) : '') + (st.tf ? ' · ' + st.tf : '');
      c.fillText(fitText(c, sub, 300 * sc), cv.width - 28 * sc, 70 * sc);
      c.fillText(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), cv.width - 28 * sc, 112 * sc);
      c.drawImage(shot, 0, head);
      showImage(cv, CONFIG.BRAND + '-' + (cfg.fname || 'chart') + '.png');
    });
  });
}

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
