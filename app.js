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
var GTFS2 = ['1D', '1W', '1M', '3M', '6M', '1Y', 'All']; // شارت الهدايا الحي (مبيعات + لقطات الفلور)
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
  gs: store.get('gs', { sort: 'floor_d', min: '', max: '' }), // فرز/فلترة الهدايا
  df: 'all', // فلتر صفحة الفرص
  mcur: store.get('mcur', ''), // عملة عرض الخريطة (TON/$)، فاضي = زي إعدادات العملة
  cs: store.get('cs', 'candles'),
  alerts: store.get('alerts', { portfolio: false, pumps: false }),
  favC: store.get('favC', []), favG: store.get('favG', []), favS: store.get('favS', []),
  st: { tab: 'all', q: '', map: false, metric: 'cap', top: 50 },
  prof: store.get('prof', { items: [], cols: [] }),
  c: { kind: 'coin', tab: 'all', q: '', key: 'cap', asc: false, grid: false, map: false, metric: 'cap', top: 50 },
  g: { tab: 'all', q: '', map: false, metric: 'cap', top: 50 },
  p: { tab: 'assets', edit: false },
  csOpen: false, cp: null, cpState: null,
  cache: { coins: null, ct: 0, glob: null, gifts: null }
};

var t = function (k) { return (I18N[S.lang] && I18N[S.lang][k]) || I18N.en[k] || k; };

/* ---------- icons ---------- */
var I = function (p) { return '<svg viewBox="0 0 24 24">' + p + '</svg>'; };
var ICON = {
  sticker: '<svg viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9l-6 6H6a2 2 0 0 1-2-2z"/><path d="M14 20v-4a2 2 0 0 1 2-2h4"/><circle cx="9" cy="9" r="1"/><circle cx="14" cy="9" r="1"/><path d="M8.5 13c1 1 3 1 4 0"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5L6 17zM10 20h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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
  calc: I('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/>'),
  tagI: I('<path d="M3 12V4h8l9 9-8 8-9-9z"/><circle cx="7.5" cy="8.5" r="1"/>'),
  imgI: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>'),
  bellI: I('<path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5L6 17zM10 20h4"/>'),
  users: I('<circle cx="9" cy="8" r="3.500"/><path d="M2 20c.5-3.500 3-5.500 7-5.500s6.500 2 7 5.500M16 5a3 3 0 010 6M18 14.500c2 .5 3.500 2.500 4 5.500"/>'),
  mega: I('<path d="M3 11v3l12 5V6L3 11zM15 9c2.500 1 2.500 6 0 7"/>'),
  fire: I('<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>'),
  up: I('<path d="M12 20V5M6 11l6-6 6 6"/>'),
  down: I('<path d="M12 4v15M6 13l6 6 6-6"/>'),
  heartS: I('<path d="M12 20s-7-4.600-9-9.200C1.600 7.400 4 4.500 7 4.500c2 0 3.600 1 5 3 1.400-2 3-3 5-3 3 0 5.400 2.900 4 6.300-2 4.600-9 9.200-9 9.200z"/>')
};
var MKI = {"portals": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAK/UlEQVR42tVaS4wlV3n+vv+cqntvT890D91jZNyAH2ODn7GwjYlBiZTEiRELUJQFKwtYIOUhgbyLs8kC2LAIiSCRkHiIDQs2kA0CNghIhB074DFByCYBbI9txo95eLpv37p1zpfFqapbdV/dtzUgzVVNq+bUefznnP///idv/JxwNf8MV/nP82rfgLvqb+AqvwJvBAgIAtp7EVDtbVbICQBS84rOm7qTNJ9mlgCP1L81RICHAQIM0zeheszsFSXSbV7/Li6w/WnREqv2bw1hxULzuGgZa3FBoxZ8JWYOc+lsi/rPa18FhdJW46E31u7PK9F/pl2VDBzyp6VTLxqyUv+4Wn8tQiFpHgtx4TRaznLz+oPz5ls8idSS72kUmmVjTsMPWwc63c5qw5qBljbT1i1K/8gOmCwFvGmq2JWByVrNpF0AJQBSACCS9QFWk6rbn3XPep7mMpWWSLelKVhsz9DFkmq2Ceh1uaNhIc2Cz9SnLrkiKWkGuCoSnLH5LwCJcUZzzCJee0jiMi2kqmEhO7oqJqdOC0ZIGEcMg8ooiIJIeKLn6R0MiIJ0eOQ7gDyPK2RKOCIAl0YAx9eshbdtxJ3j2ByQ0Pkhz16Kz13iub08yq/34AwhXilTYrLZtk5nR6irr7VMarq/Iy8X8Lb/5zeEB2/EfTv+1CAnaysFkvDqXvnY2dH3/m/0w+fdfsyO5y4oGSRt/lCFCU0jJ8I/DeSJk//wy3GJXpqxU8TORhOi2KVhed9b9v/6Xrvvul5S9FEMmgw1g6vGhSfPjv/1ifLHL/c3exkUNWOCzaoQLVT04nu+Um3AWqAmggAFtY47GU1qrkfJJOHlcvyxu4q/uS/zlpexfa2q9aqldeuvMWj8+ceLrzzVW89ymaIqgU1PtIpi1lIfWS1trf2Ykiauhdjqo4iACEkgrd6Ai4AgIlJJdh1AYLcYP3L/6OG71iQrQswdgfLXF+KTL+nXl/TqHilsHcP1J8I917rrNz3gRgG5633ifneyv/vPj3Otl9EAVQTJYM0G0iECiQxJBBMGJ2o7mrg+7EpLNghTAbSrNtDAghkuDMPH7x49fFd/HGFA7vDzc8Ov/gyPn+WFfSea0QmIkCls9sp3X1d85E7cdqofooLs4T84drkYfvEMN/o+RMgm67HFCxNDqUVStGrDfO/XdDTMuVzE+6/d/Ze/6AEZSM/wjZ/vf+6/bLfsH8vpW5edjqqM2C207oaffHf4q9sGZfQAhOIT3ykee3Gw3ndHwyXvidjlrUMadWvZ+O/u9d7yMshb/PrT+5/9cbY+yLcyhThB+kpxAxmxPeAorH36P4oy7n/4jsE4MHP5395bPv3tEtG5eZgfBQBTuioRnP4aa25mLWsHPjm1W+hP31bediorI7zDT14efuFJbgyynIiRaSqrJ2xeQkRuODnIv/CE/8lvR5ljGXD7qfxP3l7uFcg5Zy1HuJl21/prJFZ9Apm74qHTBByIcQhfO4MxBt4xYNLNWk/TKMAZCvS/ekbjEEAA9tBpZn6s1SkhZzYwtd7s4wzjoLdvxnduZ1H0xC/Plz99xa3nlOBSHyIzgIhCBEBkNpkWwPEcT5/Lnj0/9oYo3rrtr98oR0HOVt+AzTsqW/qEyHec1GbPogDEM+c0LHxWr50ZCuFiEaliLds/5vah8cUilrHaBghv2CvdmXMCFCI3e/6WLQTJHbT07LNyWMUMIraOuVq9h99cdOY8DYgJnfTW4/sfujneeY0fZEbEvTI8dW7878/w+Td6x3MrBRoIPnfRNcbxNWuWAgWMVy4uNNfJqBipMqkBWBlDavSG3bHuf8vw7x+w7UEP8A1u3bYdHrxh/Jn/HD7x0mAtNyPMWMSJ+U9WuufAA53yqGz5BSUQ6LTUerGJDwXIDI4oonbWh48+wO1Bbxx9y5rgOPrtweDRB9x1x0dllDOY0eIkvJR8usOwkLMuC025lLPGk82wkGP3DCAHeENRxoduwtagN47ITC++MTrzSulod5xy167nRcT2oPf+m/a+9FP5nFabX5WfSPj6yLTIpazfraUx5rMQl3jYBBvl1DFK0c9065YJ5ond8fgff1T+7LWeAbduFf/0Z1zzuYB3vskyrzgdMqOQTDnOdWG42O/3R3PFOoq5DqE5sp8OhDi/h5d381NrGYSXd/n6sFw/AQC5t2RlWHLvJxbnET0rv6pHaYSZ0hUk/k363Fi5iw0TZlQhAMhMNReI0KR/y7OQlGYQf8fR6frmY4epbKJoa3NFkZNQQ5R1XGk2h64mVlTppt91eD3BnTphaTIFCzixBqNAsvaBLNTGXQRJJTRL3FaFukkar8AGFkXN1ASXOBP8oOobmMRZ1AoqcDI8UUqyifOojrvF5lgOvwtBntQ88dQCsRWZlHEdCANJGpX4ItYsHCNJOgqkJo4JIwQqXVc7/kfRSDMozo3QLeTnlVNMLrlzHRGAq43b2FrbIUquOt76ApIR7ybwx8rBFk1wOgIKrQhDxnYopmIqM5rBkYyxkYFS6PfIiGHJUu0gBpxVcj+JQVDmYEbp9yHEKT/DKjIDJkE2h2gVV2yt6U398Yt7DtR1a8WbBy5FfAg4g9hoUzXurjHS3MrG3CIqG5ifIzqs9EDtgwqAM5RiWj9KWwP/Dw/E/3mtkOzObdtay4KSqaMY4dg4iqzVACchswUkzaVnqTW6IPVk7KgbI3KHi4V21ovTm06AkQJv2OjfsDHBhKR6b960nfXR2d2B92jjhxIaLAWgGv3YZel5jt9BT2drZYyXivLmE8NH7rGNXq4Uu9UM4AkSTvTyT97DGzeGb+yHEDtRcVIr+Ya1Dc/D5Ee6pkTHnOYHbrJ3XVO+dycbeFeqyrpJ8dVh2C9lYO651afRAJbS6ZO9T70v/OiF8c46W7kFulYcbTFJnGUhzUmnLN0AK80USQPs9q3e7VsQECTPcKkIP3g+PHkOL+1xXDoSuYU3r8d7TumP3upO5HmQDbw9eL3vmhMyytgyUXSo1JN3bcXHQ1WHOKJUJFyY5GLgGInw/efG3/yle+Fyzzt6o1ES90u8/hqefiV89zfFX948/OOdHHBBFfVR8IwhRiMNdNPpdC3XzSvDqIC+x7MX7Jnz5S0nkxJTlH7x+uhb/8v/Ppfn5jf7VTC8sg0cegThXh8N/u3M+LGXxh88Xd5yMrPk1TA+c2H07AXXz+YkC3kQffzod7R6YgZFwDE/uvtU2Mi5V+KFXfzqgh9Fv5aRQND89L4jQOwW6LnyxuPjneNY87ww1lOv2OWylxu0uibmx753lNioEUEalpBEysz6RkdEHWDHEDAiCvtBIcbkgw08nU18id9HtYoAR57o1XkSTWJYPEQyG8RaRtYMH+OKmeYrVfAU42oQPJW4bjMMj54js6u7Zs57EQcEMrAgi76gfzWfVk6iHjyKM1VD8rJFFS+HLmOY/Xq0IMOqowiAXjxMPHHxHXCe1pytqVgSHOTSYonlZyV4P1OBE4ik5UOtemNd8jAX3SOr/EWsrc4m1WtzTPGqpCZ9CqzeY2PSzV0i2WBCAMQqoZrWnY4LJQqsu1VrZb7nGhfJCLN2kQrrgfP6k90QIJfFAtWkjlgdk3Eyj58ut2gVjVDdrPhMgVATPK3KbTRJZrXNK9WVK+1ga1WSVJeecHEBEhvYJaDKGWravZsLozxs3RfbJTKH7798yJJGLqiV0FIxWy6HPEhup+SThxB1Hpok34kNYAXVyFXubMkSXLH/PIfmKi89vrprj/8fYfGiLJQ59pUAAAAASUVORK5CYII=", "mrkt": "data:image/png;base64,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", "tonnel": "data:image/png;base64,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", "tg": "data:image/png;base64,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", "getgems": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAKP0lEQVR42u1aaYxeVRl+3vecu33bTKcdaKHbUJa22C2BAgkgUgOKhBgE8QemGP6ghoi4gPwxuCEGJEpADZCAoEkpISaIWiNlM5FN21JaqLa0HQtdme1b7nbOef3xDcwwnRm+KTMYkjk/783JfZ/zbs9z3kuHBgQf58X4mK9pANMApgFMA5gGMA1gipYIZOq7vJ50o50DCAQwgwD5WAAQgRMQ4PsIPSiS3EpmYG2rThaBABAIwASijxCAddCMciQW7q1DZnu37Piv7DuCw33see5HXwnKEVs7pk3WAQKl4GtoBUVIMuS2VQwfCoBzEEilSEliN/wz3/CybN6lequecaQUjKU5MxLVDCIa3XQilCNoJbXEHeyxRwbQV5NT5/LMNs+YljDoD3PwvkYYyMZNyUMb6NXdGqLDEKUCiMBAPcPxHVwIybmR9jdDrhLBitu8K3/mVbd5J95+RzUS1Vuz91zvLuxEfw41dQCMRbkgPQPmh7/LnnwxUKTLBRDBWTg3WN4yI8e3u8CnegKm9yH3FMqhe3F79vDf8NIbOs59X5OvQYz2ItpL1lrQ1OWAsdJelG3d2S0PuF37o44SD4by8EVwVk6dC0+RyGAIEWCsRCGlaf7j35vH/66t80ohwhAiICAzKEV2VpszFpiiHDAW7UW88u/s27+hahzNqlBu5OivOYfAl+UnkbFDD3OLUkT7e9Kb7rdbdoYdFSaCtc1iBWZkBifMdJ0VLzcgSCsgeKJxXy5gW3f6rV+jkQaliDIzSoYyI82w4DizZD4n2WD8WIdiiLePpF//hdu2J+psZ3GDpg/6jJDnsnKRFCM2DtRaGZoAACcIPfQM5Lc8INUkiAKYMSKVCEkuF66SjrLODYjgBL5CLcm/e5/bezicUaLcjOxxziEK3AUryFgingIqIQLfd3c9bna9HVQK74uNEdZnBjPbss+dxY2UBtNXEIXurvXmtT3BjDLlZuQupVCL5czTsuUn+bWkpfozMQDWoa0oT21K/vSi31Hmoy0Ybkq1Ya84z500x0tyMMM4VArYuCl94gXdUeHMjH46Wtm1n2ZmlolQqFb7vFKIU/vQX5hJjcNvFKPawJL56dVrdK1BTHACzYgz+9BfidiDgI7a7mn0DrjLz83PWupVG1BMkwzACUqBPL/VbN3jlSK4MQAwwToold18FVcKXm7BBBEUQ3nh9Xzrbq8Qvtslhi1fo7cmy09Orv+8aiQ8EeNbBkCAE/fnV0REjUUwiSBAf8Pc9EW7+jR/oA7FQ6+e3iTGMr9/rwC+Rk9VFnTGt1+rQt/P7ARoXKsAROB72Hck37JTRyHsUeYLoBVE0F8z37kyu/KTYV+N9bsNRmv0VN2W3RT6NDy2FUMxDvW7xfPie65XJ8wM6ukQ5smk084h9LF9D3qqqlwYGQNE0ArVBjSn3/+yu/KCqK9GrN63d9c+c7BXewpOwARmOEEthhNz+bnpjV/wS6FXjaHV1OiBJkHfsU/sME5GABGYkRr01uySednNV9HqJUFvjZo6Zphz5O0+Z6wXRDAWqUGSilZuWVe29iL51MpCnFGcwVPHKH0+GAAzjHP7DpNiYgIpALAWcY40k5lt2dVr7NVrvErB66mOPEURMONQL97pF8BpZWd32JVd7sJVdNZSL/L0QAMgMI/MDcgk6QERMCHP0VNlAdVTxBmsdVEgC2fna1bh0rNV12y/1qBRY4AZSUYrutQPrsmOn0FzZvCJx+mOshJBPaH+fDDom+y66VhmKAYdzQ6P2QNEMBZpLm1RsmCOLDweS+bhEwt54RxdjlSaUW8VTKPnHxPSDIsX+KtOgXUwFplBf33wlVZwblBXFANoltwhTaWRiBMqBDx5bJTec+0wdSXDn42HP8nQSEAEAoiHTj03CH20hdI7YLa86bbscv95iw720aEe6ZqNn3/VB9h9UCzpVsqopxB66EvCuBubd+Ix5yK/GUL5pWfrrtlerYHcjlkEmcBqJDHxFNqKsvtg/sd/2I1beO8BnebExIGHRiYnzsq0Qm4/tAeaRNLTmFEWhhQDKgQA2Fp0H1S/fsKtfy6/4rzG1Wt0pegP1FsqhcaiUkS1nv3yD+ax59WR/iD0OfRQDAdTLrPobHeeh9TgAxtzCx5w0IpO7BTn4GQwtwiIAhRDTtLgV0/Ypzen3/uSW7046KsR8XgyxDp0lOXlN9Lb1rnXu4NyQc0swzmIYJDeKlgrJ8yCZnJupOuOmQvR4rnEPNRJBXAOxkIrdLap3QcKX7ub1j2TtJXEuTETw1q0l+TRZ5Pr7qbdBwqdbUozjIWToS0iUIzFc8lJS4WUW+kDaYalC2lm2eRHXXU0c7EcQavg1ke8BzfE7SVxdvSzby/LgxuSW3/r+SooBsjNyLtHIuQWHWW7dCGlGZgnAwAR0hzzZukVi2ycyqiZaiyY0F7Ud6z31z+bzijLCLljLGYUZf0zyR2Peu0l3eSto7LxOMGKk828WTrNW+plrekBgJgvPpOIXPP6YNRiBaBS0D9bxy+9kVYKQyZai0oRL+3Ibl+nKkXd5Oej1moRENnPnkHESiaRTjOhltD5y7xlXVktGbMyNMPXOP+2da7ayJvsrVnEBurZT9dZK77m8eRELcGyrvy8ZXqcrxyTHiBYiyhQ11wM58a7c2peW+zoDh5+Ki8VxAlEUIrkkafs691BpQDjxmuXztm1F7soULZlYdAqAVeM/rpcuDK4ZHXaU3Pe2OXXWpQK6rHnefcBE2j4Ht48YB57jssFZcZuTJ5GT81dsjpbszLsr09AGExAQRBRlvM3r/AWzUmrDRmrZ4nA13inP3jiBRv6Enry5IvmnQHf12POO7RCtSGL5qQ3XKGznIloSiY0TEhydJS8n1yLUpTGKcbBEHq08V9UjU0ttk9t4sCjUa1vqrlGilKU3nYtZpa9JMeEZPHENJxiVGOcPj+88zpEflqNxdOjMDrnEPjYc0Dv2e9277d7DujAH0XOA+Jr1GIpBOmd12Hp/LBan7CqnLAI1Qp9dZxxin/vDTK/Mz4y4BTT0V9lRpzTtr3utb0uzkjzKGehmI4MuLmd8b3fkDNO8fvrovVHMuTTivrqvHheeN+N3mXnJAMNU4vBDKWG1SeBJt6+F9u7oWmIhBCgFZhRi9HfMJedk9x/o7d4XtBXZ6WOxRg65v+FrIPvIfTdxk3pgxto67sDDk+BCExopDhtbgzCju6oEKJZUnOLOAGRWd5l1l4ka1YFcc5ZDnWs41L6MD88OYGItBUozsxzW827IyZtHBSzE7QVYgADjYhIrINi6SibFYvsZ1bT+ad7UagG6gKiiV5mTRqA9wq/ViiG4uDeOpxv24Md+7DvsPTUOM0FoECjo2zndtJp82jpAjqxUyviekzGHfvBTyaA4WPWwEfgQRFy63Iz2Hc1w9PwFFmhJEeWTXiWOuUARhl005CJTXgigIB5cuyeqkk9EZQa5VcDplZnXv9nACPAYPpvlWkA0wCmAUwDmAYwDWDc9T8Y3xxtDaIIWwAAAABJRU5ErkJggg==", "gram": "data:image/png;base64,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"};
var GEM = '<img class="gem" src="' + MKI.gram + '" alt="" onerror="this.outerHTML=\'💎\'">', GEMIMG = new Image(); GEMIMG.src = MKI.gram;

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
  if (S.theme === 'gold') document.documentElement.dataset.base = 'dark'; else delete document.documentElement.dataset.base;
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  try {
    var col = S.theme === 'gold' ? '#0d0a04' : S.theme === 'dark' ? '#000000' : '#f2f2f7';
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
  var items = [['crypto', '<span class="bt">₿</span>', t('crypto')], ['gifts', ICON.gifts, t('gifts')], ['stickers', ICON.sticker, t('stickers')], ['profile', av, t('profile')], ['settings', ICON.settings, t('settings')]];
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
    if (v.type === 'sticker') return vSticker(tok);
    if (v.type === 'gsearch') return vGsearch(tok);
    if (v.type === 'arb') return vArb(tok);
    if (v.type === 'models') return vModels(tok);
    if (v.type === 'portfolio') return vPortfolio(tok);
  }
  ({ crypto: vCrypto, gifts: vGifts, stickers: vStickers, profile: vProfile, settings: vSettings })[S.tab](tok);
}

/* ---------- modal helpers ---------- */

function alertDesc(x) {
  if (x.k === 'coin') return esc(x.n + ' (' + x.s + ')') + ' ' + (x.op === '<=' ? '≤' : '≥') + ' $' + fmtPrice(x.p);
  var nm = esc(x.c + (x.m ? ' · ' + x.m : ''));
  if (x.t === 'drop') return nm + ' ⬇ ' + x.p + '% / 24h';
  if (x.t === 'rise') return nm + ' ⬆ ' + x.p + '% / 24h';
  if (x.t === 'deal') return nm + ' 🏷 ' + x.p + '% ' + t('a_deal').replace(/^%\s*/, '');
  if (x.t === 'vol') return nm + ' 📈 ≥ ' + x.p + ' ' + t('sales7').split('/')[0].trim();
  return nm + ' ' + (x.op === '<=' ? '≤' : '≥') + ' ' + '💎 ' + nf(x.p, 2);
}
function paintSubList(r) {
  var box = $('#sub_list'); if (!box) return; var L = r && r.subs || []; if (!L.length) { box.innerHTML = ''; return; }
  box.innerHTML = '<h4 style="margin:12px 0 6px">' + t('sub_title') + '</h4>' + L.map(function (x, i) {
    var f = [(x.ms || []).join(', '), (x.bd || []).join(', '), (x.sy || []).join(', ')].filter(Boolean).join(' · ');
    return '<div class="kv"><span>' + esc(x.c) + ' ≤ ' + GEM + nf(x.p, 2) + (f ? '<br><small>' + esc(f) + '</small>' : '') + '</span><button class="ib" data-act="subdel" data-v="' + i + '">×</button></div>';
  }).join('');
}
function paintAlertList(r) {
  var box = $('#al_list'); if (!box) return;
  var L = r && r.alerts || [];
  box.innerHTML = L.length ? L.map(function (x, i) { return '<div class="kv"><span>' + alertDesc(x) + '</span><button class="ib" data-act="aldel" data-v="' + i + '">×</button></div>'; }).join('') : '<div class="empty">' + t('no_alerts_yet') + '</div>';
}
function calcUpdate(id) {
  var r = Gifts.tonUsd || 0, v = function (k) { var el = $('#' + k); return el ? parseFloat(el.value) : NaN; };
  if (id === 'cc_ton' && r) { var x = v('cc_ton'); $('#cc_usd').value = isNaN(x) ? '' : (x * r).toFixed(2); }
  if (id === 'cc_usd' && r) { var y = v('cc_usd'); $('#cc_ton').value = isNaN(y) ? '' : (y / r).toFixed(3); }
  var buy = v('cc_buy'), sell = v('cc_sell'), q = v('cc_qty') || 1, fee = v('cc_fee') || 0, out = $('#cc_out');
  if (!out || !(buy > 0) || !(sell > 0)) return;
  var net = (sell * (1 - fee / 100) - buy) * q, roi = net / (buy * q) * 100;
  out.innerHTML = '<div class="kv"><span>' + t('c_net') + '</span><b class="' + (net >= 0 ? 'up-t' : 'down-t') + '">' + (net >= 0 ? '+' : '') + '💎 ' + nf(net, 2) + (r ? ' · $' + nf(net * r, 2) : '') + '</b></div>' +
    '<div class="kv"><span>' + t('c_roi') + '</span><b class="' + (roi >= 0 ? 'up-t' : 'down-t') + '">' + (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%</b></div>';
}
function workerOn() { return !!(CONFIG.WORKER_URL && window.Telegram && Telegram.WebApp && Telegram.WebApp.initData); }
function workerPost(path, body) {
  body.initData = Telegram.WebApp.initData;
  return fetch(CONFIG.WORKER_URL.replace(/\/$/, '') + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (r) { return r.json(); }).catch(function () { return { ok: false }; });
}
function toast(msg) { try { Telegram.WebApp.showAlert(msg); } catch (e) { alert(msg); } }
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
    s = chart.addCandlestickSeries({ upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, borderVisible: true, wickUpColor: up, wickDownColor: down });
    s.setData(data);
  } else if (st === 'dots') {
    s = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2, pointMarkersVisible: true, pointMarkersRadius: 5, crosshairMarkerRadius: 6 });
    s.setData(data.map(function (x) { return { time: x.time, value: x.close }; }));
  } else if (st === 'line') {
    s = chart.addLineSeries({ color: '#3b82f6', lineWidth: 3, crosshairMarkerRadius: 5 });
    s.setData(data.map(function (x) { return { time: x.time, value: x.close }; }));
  } else {
    s = chart.addAreaSeries({ lineColor: '#3b82f6', lineWidth: 3, topColor: 'rgba(59,130,246,.35)', bottomColor: 'rgba(59,130,246,0)' });
    s.setData(data.map(function (x) { return { time: x.time, value: x.close }; }));
  }
  return s;
}
function makeChart(box, data, forced) {
  killChart();
  box.innerHTML = '';
  if (!data || !data.length) { box.innerHTML = '<div class="empty">' + t('no_history') + '</div>'; return; }
  var dark = S.theme !== 'light';
  var chart = LightweightCharts.createChart(box, {
    width: box.clientWidth, height: box.clientHeight,
    layout: { background: { color: 'transparent' }, textColor: dark ? '#c4c7cc' : '#333', fontSize: 13 },
    grid: { vertLines: { color: dark ? '#26262b' : '#e2e2ea' }, horzLines: { color: dark ? '#26262b' : '#e2e2ea' } },
    rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true },
    watermark: { visible: false }
  });
  var wm = document.createElement('div'); wm.className = 'chwm'; wm.innerHTML = GEM + '@' + esc(CONFIG.BRAND); box.appendChild(wm);
  S.lastData = data; S.lastForced = forced;
  S.series = addSeries(chart, data, forced);
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
    '<div class="dt"><div class="dn">' + esc(cfg.title) + '</div>' + (cfg.sub ? '<div class="ds">' + esc(cfg.sub) + '</div>' : '') + '<div class="dp">' + cfg.price + '</div></div>' + pill(cfg.chg) +
    '<div class="grow"></div>' +
    (cfg.models ? '<button class="chip" data-act="cpmodels">' + t('models') + '</button>' : '') +
    '<button class="ib" data-act="share">' + ICON.share + '</button>' +
    '<button class="ib" data-act="dl">' + ICON.dl + '</button>' +
    (cfg.analyze && workerOn() ? '<button class="chip" data-act="pan">' + t('an_btn') + '</button>' : '') +
    (cfg.alertName && workerOn() ? '<button class="ib" data-act="palert">' + ICON.bell + '</button>' : '') +
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
  if (!noModes && cfg.curToggle) {
    h += '<div class="chips"><button class="chip2 ' + (st.cur !== 'usd' ? 'on' : '') + '" data-act="cpcur" data-v="gem">' + GEM + ' TON</button><button class="chip2 ' + (st.cur === 'usd' ? 'on' : '') + '" data-act="cpcur" data-v="usd">$USDT</button>' +
      '<span class="gapx"></span><button class="chip2 ' + (st.style !== 'line' ? 'on' : '') + '" data-act="cpstyle" data-v="candle">' + t('candles') + '</button><button class="chip2 ' + (st.style === 'line' ? 'on' : '') + '" data-act="cpstyle" data-v="line">' + t('line') + '</button></div>';
  }
  return h;
}
function paintCP() {
  var cfg = S.cp, st = S.cpState, body = $('#cpbody');
  killChart();
  if (st.tab === 'ov') {
    body.innerHTML = '<div class="card" id="ovc">' + cfg.overview.map(function (r) { return '<div class="kv"><span>' + (r[2] ? r[0] : esc(r[0])) + '</span><b>' + r[1] + '</b></div>'; }).join('') + '</div>';
    if (cfg.card) body.insertAdjacentHTML('beforeend', '<button class="btn" data-act="gcard" style="width:100%;margin:6px 0">' + t('card') + '</button>');
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
    if ((!data || !data.length) && S.cp.autoFallback && !S.cpState.userMode && S.cpState.mode === 'floor' && S.cp.modes.indexOf('sales') >= 0) { // لسه مفيش تاريخ فلور: نعرض المبيعات
      S.cpState.mode = 'sales'; S.cpState.tf = '1d'; paintCP(); return;
    }
    if (data && data.length && S.cp.curToggle && S.cpState.cur === 'usd') data = data.map(function (p) { var r = {}; for (var k in p) r[k] = p[k]; ['open', 'high', 'low', 'close', 'value'].forEach(function (f) { if (typeof r[f] === 'number') r[f] *= Gifts.tonUsd; }); return r; });
    if ((!data || !data.length) && S.cp.emptyMsg) { S.lastData = null; $('#chart').innerHTML = '<div class="empty">' + esc(S.cp.emptyMsg(S.cpState)) + '</div>'; return; }
    var sparse = data.length <= 15 && !S.cpState.style && (S.cp.curToggle || S.cp.sparse); // عمليات قليلة: نقط على خط أوضح من شموع مسطحة
    makeChart($('#chart'), data, sparse ? 'dots' : S.cpState.style === 'line' ? 'area' : S.cp.forceStyle);
    if (sparse) { var nt = $('#cpnote'); if (nt) { nt.style.display = ''; nt.textContent = t('few_pts').replace('{n}', data.length); } }
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
/* ---------- STOCKS (داخل صفحة الكريبتو) ---------- */
function loadStocks() {
  if (S.cache.stocks && Date.now() - (S.cache.stT || 0) < 300000) return Promise.resolve(S.cache.stocks);
  return Gifts.json('stocks.json').then(function (j) {
    if (!j || !j.items) throw 0;
    S.cache.stU = j.u; S.cache.stT = Date.now();
    S.cache.stocks = j.items.slice().sort(function (a, b) { return b.mc - a.mc; }).map(function (x, i) {
      return { id: 's:' + x.s, stock: true, name: x.n, symbol: x.s, image: x.logo ? Gifts.thumb(x.logo, 128, 'png') : '', current_price: x.p, price_change_percentage_24h: x.c1,
        market_cap: x.mc, market_cap_rank: i + 1, total_volume: x.v, high_24h: x.h, low_24h: x.l, ath: x.hi52, atl: x.lo52, ind: x.ind, circulating_supply: 0 };
    });
    return S.cache.stocks;
  });
}
function curList() { return S.c.kind === 'stock' ? (S.cache.stocks || []) : (S.cache.coins || []); }
function stockHist(sym) { return Gifts.json('stocks/h/' + sym.replace(/[^A-Z0-9]/g, '') + '.json'); }
var STFS = ['1M', '3M', '6M', '1Y'];
function stockCandles(sym, tf) {
  return stockHist(sym).then(function (h) {
    if (!h || !h.length) return [];
    var days = { '1M': 31, '3M': 92, '6M': 183, '1Y': 366 }[tf] || 92, from = Date.now() / 1000 - days * 86400;
    return h.filter(function (r) { return r[0] >= from; }).map(function (r) { return { time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }; });
  });
}
function vCrypto(tok) {
  var el = $('#view');
  if (S.c.kind === 'news') return paintNews();
  if (S.c.kind === 'stock') {
    el.innerHTML = loadingBox();
    return loadStocks().then(function () { if (tok === S.tok) paintCrypto(); }).catch(function () { if (tok === S.tok) el.innerHTML = '<div class="empty"><p>' + t('stocks_wait') + '</p></div>'; });
  }
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
/* ---------- الخوف والطمع + الأخبار ---------- */
function fngColor(v) { return v < 25 ? '#ea3943' : v < 45 ? '#ea8c00' : v < 56 ? '#c8b400' : v < 76 ? '#93d900' : '#16c784'; }
function loadFng() {
  if (S.cache.fng && Date.now() - S.cache.fngT < 600000) return Promise.resolve(S.cache.fng);
  return fetch('https://api.alternative.me/fng/?limit=8').then(function (r) { return r.json(); }).then(function (j) {
    var d = j && j.data; if (!d || !d.length) throw 0; S.cache.fng = d; S.cache.fngT = Date.now(); return d;
  });
}
function fngLbl(v) { return t(v < 25 ? 'fng_xf' : v < 45 ? 'fng_f' : v < 56 ? 'fng_n' : v < 76 ? 'fng_g' : 'fng_xg'); }
function paintFng() {
  var box = $('#fng'); if (!box) return;
  loadFng().then(function (d) {
    box = $('#fng'); if (!box) return;
    var v = +d[0].value, row = function (k, x) { return x ? '<div><small>' + t(k) + '</small><b style="color:' + fngColor(+x.value) + '">' + x.value + ' · ' + fngLbl(+x.value) + '</b></div>' : ''; };
    box.innerHTML = '<div class="fng"><div class="fngt"><div><small>' + t('fng_title') + '</small><div class="fngv" style="color:' + fngColor(v) + '">' + v + '<span>' + fngLbl(v) + '</span></div></div></div>' +
      '<div class="fngbar"><i style="left:' + v + '%"></i></div><div class="fngr">' + row('fng_yday', d[1]) + row('fng_week', d[7]) + '</div></div>';
  }).catch(function () { box.innerHTML = ''; });
}
function agoTxt(ms) {
  var m = Math.round((ms - Date.now()) / 60000), f;
  try { f = new Intl.RelativeTimeFormat(S.lang === 'ar' ? 'ar' : S.lang === 'ru' ? 'ru' : 'en', { numeric: 'auto' }); } catch (e) { return ''; }
  if (m > -60) return f.format(Math.min(0, m), 'minute'); if (m > -1440) return f.format(Math.round(m / 60), 'hour'); return f.format(Math.round(m / 1440), 'day');
}
function openExt(u) { try { if (tg && tg.openLink) return tg.openLink(u); } catch (e) {} window.open(u, '_blank'); }
function loadNews() {
  if (S.cache.news && Date.now() - S.cache.newsT < 240000) return Promise.resolve(S.cache.news);
  return Gifts.json('news.json').then(function (j) { if (!j || !j.items) throw 0; S.cache.news = j; S.cache.newsT = Date.now(); return j; });
}
function newsListHtml(j) {
  var src = S.c.nsrc || '', items = j.items.filter(function (x) { return !src || x.s === src; });
  var srcs = []; j.items.forEach(function (x) { if (srcs.indexOf(x.s) < 0) srcs.push(x.s); });
  return '<div class="tabs"><button class="' + (!src ? 'on' : '') + '" data-act="nsrc" data-v="">' + t('all') + '</button>' + srcs.map(function (s) { return '<button class="' + (src === s ? 'on' : '') + '" data-act="nsrc" data-v="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>' +
    items.slice(0, 60).map(function (x) {
      return '<div class="news" data-act="nopen" data-v="' + esc(x.u) + '">' + (x.i ? '<img src="' + esc(Gifts.thumb(x.i, 200, 'webp')) + '" loading="lazy" alt="">' : '') +
        '<div class="nb"><b dir="auto">' + esc(x.t) + '</b><div class="nm"><span class="nsrc">' + esc(x.s) + '</span><span>' + esc(agoTxt(x.d)) + '</span>' + (S.lang === 'ar' ? '<button class="chip" data-act="ntr" data-v="' + esc(x.u) + '">' + t('news_tr') + '</button>' : '') + '</div></div></div>';
    }).join('') + '<div class="note">' + t('news_note') + '</div>';
}
function paintNews() {
  $('#view').innerHTML = '<div class="mrow">' + ckSeg('news') + '</div><div id="news_box">' + loadingBox() + '</div>';
  loadNews().then(function (j) { var b = $('#news_box'); if (b && S.tab === 'crypto' && S.c.kind === 'news') b.innerHTML = newsListHtml(j); }).catch(function () { var b = $('#news_box'); if (b) b.innerHTML = '<div class="empty"><p>' + t('news_wait') + '</p></div>'; });
}
function ckSeg(kind) {
  var b = function (v, l) { return '<button class="' + (kind === v ? 'on' : '') + '" data-act="ckind" data-v="' + v + '" style="flex:1">' + l + '</button>'; };
  return '<div class="seg" style="flex:1">' + b('coin', t('coins')) + b('stock', t('stocks')) + b('news', t('news')) + '</div>';
}
function paintCrypto() {
  if (S.c.kind === 'news') return paintNews();
  var c = S.c, g = S.cache.glob;
  var tabs = [['all', ICON.chartI.replace('<svg', '<svg').replace('M3 17l6-6 4 4 8-9', 'M3 17l6-6 4 4 8-9'), t('all')], ['hot', ICON.fire, t('hot')], ['fav', ICON.heartS, t('favorites')], ['gain', ICON.up, t('gainers')], ['loss', ICON.down, t('losers')]];
  var sum = '';
  if (g) {
    var cap = g.total_market_cap.usd, pc = g.market_cap_change_percentage_24h_usd || 0;
    var abs = cap * (pc / 100) / (1 + pc / 100);
    sum = '<div class="sum"><div><small>' + t('market_cap') + '</small><b>$' + fmtBig(cap) + '</b>' + pill(pc).replace('class="pill', 'class="pill') + '</div>' +
      '<div><small>' + t('change24') + '</small><b class="' + (abs >= 0 ? 'up-t' : 'down-t') + '">' + (abs >= 0 ? '+' : '-') + '$' + fmtBig(Math.abs(abs)) + '</b></div></div>';
  }
  var stock = S.c.kind === 'stock';
  if (stock) sum = '';
  $('#view').innerHTML =
    '<div class="mrow">' + ckSeg(stock ? 'stock' : 'coin') + '</div>' + (stock ? '' : '<div id="fng"></div>') +
    '<div class="tabs">' + tabs.map(function (x) { return '<button class="' + (c.tab === x[0] ? 'on' : '') + '" data-act="ctab" data-v="' + x[0] + '">' + x[1] + x[2] + '</button>'; }).join('') + '</div>' +
    '<div class="bar"><label class="search">' + ICON.search + '<input id="q" value="' + esc(c.q) + '" placeholder="' + t(stock ? 'search_stocks' : 'search_coins') + '"></label>' +
    '<button class="ib" data-act="csort">' + ICON.sort + '</button>' +
    '<button class="ib ' + (!c.grid && !c.map ? 'act' : '') + '" data-act="cview" data-v="list">' + ICON.list + '</button>' +
    '<button class="ib ' + (c.grid && !c.map ? 'act' : '') + '" data-act="cview" data-v="grid">' + ICON.grid + '</button>' +
    '<button class="ib ' + (c.map ? 'act' : '') + '" data-act="cview" data-v="map">' + ICON.tmap + '</button></div>' +
    (c.map ? '' : sum) + '<div id="list"></div>';
  paintCryptoList(); if (!stock) paintFng();
}
function coinList() {
  var c = S.c, L = curList().slice();
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
  var addBtn = c.kind === 'stock' ? '' : '<div class="empty" style="padding:16px"><button class="btn" data-act="addcoins">+ ' + t('add_coins') + '</button></div>';
  if (c.tab === 'fav' && !L.length && !c.q) { box.innerHTML = '<div class="empty"><p>' + t('no_favs') + '</p>' + (c.kind === 'stock' ? '' : '<button class="btn" data-act="addcoins">+ ' + t('add_coins') + '</button>') + '</div>'; return; }
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
  box.innerHTML = html + (c.tab === 'fav' ? addBtn : '') + (c.kind !== 'stock' && c.q && c.q.length >= 2 && (c.tab === 'all' || c.tab === 'fav') ? '<div id="xs"></div>' : '');
  if (c.kind !== 'stock' && c.q && c.q.length >= 2 && (c.tab === 'all' || c.tab === 'fav')) xSearch(c.q);
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
  if (/^s:/.test(S.view.id)) return vStock(tok);
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
      alertName: c.name, alertCoin: { id: c.id, name: c.name, symbol: c.symbol }, analyze: { symbol: c.symbol },
      shareText: c.name + ' — $' + fmtPrice(c.current_price),
      overview: [
        [t('rank'), '#' + (c.market_cap_rank || '—')], [t('market_cap'), '$' + fmtBig(c.market_cap)], [t('volume'), '$' + fmtBig(c.total_volume)],
        [t('high24'), '$' + fmtPrice(c.high_24h)], [t('low24'), '$' + fmtPrice(c.low_24h)], [t('ath'), '$' + fmtPrice(c.ath)],
        [t('supply'), c.circulating_supply ? fmtBig(c.circulating_supply) + ' ' + c.symbol.toUpperCase() : '—']
      ]
    });
  }).catch(function () { if (tok === S.tok) $('#view').innerHTML = errBox(); });
}

function vStock(tok) {
  $('#view').innerHTML = loadingBox();
  loadStocks().then(function (list) {
    if (tok !== S.tok) return;
    var c = list.find(function (x) { return x.id === S.view.id; }); if (!c) return back();
    chartPage({
      img: c.image, title: c.name, price: '$' + fmtPrice(c.current_price), chg: c.price_change_percentage_24h,
      priceTxt: '$' + fmtPrice(c.current_price), imgUrls: function () { return c.image ? [c.image] : []; }, subTxt: function () { return c.symbol + ' · USD'; },
      tfs: STFS, tf: '3M', fname: c.symbol, note: t('stocks_note'),
      fetch: function (tf) { return stockCandles(c.symbol, tf); },
      isFav: function () { return S.favC.indexOf(c.id) >= 0; }, toggleFav: function () { toggle(S.favC, c.id, 'favC'); },
      shareText: c.name + ' (' + c.symbol + ') — $' + fmtPrice(c.current_price),
      overview: [
        [t('rank'), '#' + c.market_cap_rank], [t('market_cap'), '$' + fmtBig(c.market_cap)], [t('volume'), c.total_volume ? '$' + fmtBig(c.total_volume) : '—'],
        [t('day_high'), '$' + fmtPrice(c.high_24h)], [t('day_low'), '$' + fmtPrice(c.low_24h)], [t('wk52_high'), '$' + fmtPrice(c.ath)], [t('wk52_low'), '$' + fmtPrice(c.atl)],
        [t('industry'), esc(c.ind || '—')]
      ]
    });
  }).catch(function () { if (tok === S.tok) $('#view').innerHTML = errBox(); });
}

/* ---------- STICKERS (TON + Ethereum/OpenSea) ---------- */
function loadStickers() {
  var p = S.cache.stickers && Date.now() - (S.cache.skT || 0) < 300000 ? Promise.resolve(S.cache.stickers) : Gifts.json('stickers.json').then(function (j) {
    if (!j || !j.items) throw 0; S.cache.skT = Date.now(); S.cache.stickers = j.items; return j.items;
  });
  var ep = S.cache.coins ? Promise.resolve() : Crypto.markets().then(function (c) { S.cache.coins = c; S.cache.ct = Date.now(); }).catch(function () {});
  return Promise.all([p, ep]).then(function (r) { return r[0]; });
}
function ethUsd() { var e = S.cache.coins && S.cache.coins.find(function (c) { return c.id === 'ethereum'; }); return e ? e.current_price : 0; }
function stRate(x) { return x.cur === 'ETH' ? ethUsd() : Gifts.tonUsd; }
function stP(x, v) { return v == null ? '—' : (x.cur === 'ETH' ? 'Ξ ' + fmtPrice(v) : GEM + nf(v, 2)); }
function stUsd(x, v) { var r = stRate(x); return v == null || !r ? '' : '$' + (v * r >= 100 ? nf(v * r, 0) : nf(v * r, 2)); }
function stCap(x) { return x.floor != null && x.supply ? x.floor * x.supply * stRate(x) : 0; }
function stSub(x) { return (x.chain === 'ton' ? 'TON' : 'Ethereum') + (x.supply ? ' · ' + nf(x.supply, 0) : ''); }
function stImg(x, cls) { return x.img ? '<img class="' + (cls || 'lg') + '" src="' + esc(Gifts.thumb(x.img, 160, 'png')) + '" loading="lazy" alt="">' : '<span class="' + (cls || 'lg') + '"></span>'; }
function vStickers(tok) {
  var el = $('#view'); el.innerHTML = loadingBox();
  loadStickers().then(function () { if (tok === S.tok) paintStickers(); }).catch(function () { if (tok === S.tok) el.innerHTML = '<div class="empty"><p>' + t('stickers_wait') + '</p></div>'; });
}
function paintStickers() {
  var c = S.st, tabs = [['all', t('all_st')], ['ton', 'TON'], ['eth', 'Ethereum'], ['fav', t('favorites')], ['hot', t('hot')]];
  $('#view').innerHTML = '<div class="tabs">' + tabs.map(function (x) { return '<button class="' + (c.tab === x[0] ? 'on' : '') + '" data-act="sttab" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
    '<div class="bar"><label class="search">' + ICON.search + '<input id="q" value="' + esc(c.q) + '" placeholder="' + t('search_stickers') + '"></label>' +
    '<button class="ib ' + (!c.map ? 'act' : '') + '" data-act="stview" data-v="list">' + ICON.list + '</button>' +
    '<button class="ib ' + (c.map ? 'act' : '') + '" data-act="stview" data-v="map">' + ICON.tmap + '</button></div><div id="list"></div>';
  paintStickerList();
}
function stickerFiltered() {
  var c = S.st, L = (S.cache.stickers || []).slice();
  if (c.q) L = L.filter(function (x) { return x.name.toLowerCase().indexOf(c.q.toLowerCase()) >= 0; });
  if (c.tab === 'ton' || c.tab === 'eth') L = L.filter(function (x) { return x.chain === c.tab; });
  else if (c.tab === 'fav') L = L.filter(function (x) { return S.favS.indexOf(x.id) >= 0; });
  if (c.tab === 'hot') L.sort(function (a, b) { return (b.vol1 || 0) * stRate(b) - (a.vol1 || 0) * stRate(a); });
  else L.sort(function (a, b) { return stCap(b) - stCap(a); });
  return L;
}
function paintStickerList() {
  var c = S.st, L = stickerFiltered(), box = $('#list'); if (!box) return;
  if (!L.length) { box.innerHTML = '<div class="empty"><p>' + t(c.tab === 'fav' ? 'no_favs' : 'no_results') + '</p></div>'; return; }
  if (c.map) return paintStickerMap(L, box);
  box.innerHTML = L.map(function (x) {
    return '<div class="row" data-act="stk" data-v="' + esc(x.id) + '">' + stImg(x) + '<div class="nm">' + esc(x.name) + '<div class="sub">' + esc(stSub(x)) + '</div></div><div class="pr">' + stP(x, x.floor) + '<div class="sub">' + stUsd(x, x.floor) + '</div></div>' + pillN(x.c1) + '</div>';
  }).join('') + '<div class="note">' + t('stickers_credit') + '</div>';
}
function paintStickerMap(L, box) {
  var m = S.st.metric, top = S.st.top || 50;
  var val = function (x) { return Math.max(1, m === 'vol' ? (x.vol7 || 0) * stRate(x) : stCap(x)); };
  var all = L.slice().sort(function (a, b) { return val(b) - val(a); }), pick = all.slice(0, top), vals = tmScale(pick, val);
  var items = pick.map(function (x, i) {
    var pt = x.floor == null ? '—' : stP(x, x.floor).replace(GEM, '');
    return { id: x.id, act: 'stk', value: vals[i], name: x.name, short: x.name.split(' ')[0], price: pt, priceTxt: pt, gem: false, change: x.c1,
             imgUrls: function () { return x.img ? [Gifts.thumb(x.img, 128, 'png')] : []; }, imgFn: function () { return x.img ? '<img class="tim" src="' + esc(Gifts.thumb(x.img, 128, 'png')) + '" alt="">' : ''; } };
  });
  box.innerHTML = mapRow('<select id="stmetric"><option value="cap" ' + (m === 'cap' ? 'selected' : '') + '>' + t('market_cap') + '</option><option value="vol" ' + (m === 'vol' ? 'selected' : '') + '>' + t('volume') + ' 7d</option></select>', topSelect('sttop', top)) +
    '<div class="tm" id="tm"></div><div class="note" id="tmcount"></div><div class="note">' + t('size_note') + '</div>';
  fillTreemap(items, t('map_title_stickers') + ' · ' + t('map_top') + ' ' + top, all.length);
}
function stSeries(x, tf, mode) {
  return Gifts.json('stickers/' + x.id.replace(/[^A-Za-z0-9_-]/g, '') + '.json').then(function (d) {
    d = d || { sales: [], snaps: [] };
    var pts = mode === 'sales' ? d.sales.slice().reverse().map(function (r) { return { t: r[0], v: r[1] }; }) : d.snaps.map(function (r) { return { t: r[0], v: r[1] }; });
    return Gifts._t.toOHLC(pts, tf, mode === 'floor');
  }).catch(function () { return []; });
}
function stSalesTab(x) {
  return function (box, st, alive) {
    Gifts.json('stickers/' + x.id.replace(/[^A-Za-z0-9_-]/g, '') + '.json').then(function (d) {
      if (!alive()) return;
      var rows = (d && d.sales) || [];
      if (!rows.length) { box.innerHTML = '<div class="empty">' + t('no_sales') + (x.chain === 'ton' ? '<br><small>' + t('ton_sales_note') + '</small>' : '') + '</div>'; return; }
      var n = st.sn || 40;
      box.innerHTML = (x.inferred ? '<div class="note">' + t('ton_sales_note') + '</div>' : '') + '<div class="stbl"><div class="srow sh"><span>' + t('date') + '</span><span>' + t('price') + '</span><span>USD</span><span>#</span></div>' +
        rows.slice(0, n).map(function (r) {
          return '<div class="srow"><span class="sd">' + fmtDate(r[0]) + '</span><b>' + stP(x, r[1]) + '</b><span>' + stUsd(x, r[1]) + '</span><span class="sn">' + esc(r[2] ? '#' + r[2] : '') + '</span></div>';
        }).join('') + '</div>' + (rows.length > n ? '<div class="empty" style="padding:12px"><button class="btn ghost" data-act="smore">' + t('show_more') + '</button></div>' : '');
    }).catch(function () { if (alive()) box.innerHTML = '<div class="empty">' + t('no_sales') + '</div>'; });
  };
}
function stVolTab(x) {
  return function (box, st, alive) {
    if (!alive()) return;
    var cards = [['w24', x.vol1, x.sales1], ['w7', x.vol7, x.sales7], ['w30', x.vol30, x.sales30], ['w_all', x.volAll, x.salesAll]].map(function (w) {
      var avg = w[1] != null && w[2] ? w[1] / w[2] : null;
      return '<div class="vc"><small>' + t(w[0]) + '</small><b>' + (w[1] != null ? stP(x, w[1]) : '—') + '</b><span>' + stUsd(x, w[1]) + '</span><span>' + (w[2] != null ? w[2] + ' ' + t('sales_count') : '') + '</span>' +
        (avg != null ? '<span>' + t('avg_price') + ' ' + stP(x, avg) + '</span>' : '') + '</div>';
    }).join('');
    box.innerHTML = (x.inferred ? '<div class="note">' + t('ton_sales_note') + '</div>' : '') + '<div class="vgrid">' + cards + '</div>';
  };
}
function vSticker(tok) {
  $('#view').innerHTML = loadingBox();
  loadStickers().then(function (list) {
    if (tok !== S.tok) return;
    var x = list.find(function (y) { return y.id === S.view.id; }); if (!x) return back();
    var ov = [[t('chain'), x.chain === 'ton' ? 'TON' : 'Ethereum'], [t('floor'), stP(x, x.floor) + (x.floor != null ? ' <small style="color:var(--muted)">' + stUsd(x, x.floor) + '</small>' : '')],
      [t('market_cap'), stCap(x) > 0 ? '$' + fmtBig(stCap(x)) : '—'], [t('minted'), x.supply ? nf(x.supply, 0) : '—'], [t('owners'), x.owners != null ? nf(x.owners, 0) : '—']];
    if (x.listings != null) ov.push([t('listings'), nf(x.listings, 0)]);
    ov.push([t('tab_volume') + ' · ' + t('w24'), x.vol1 != null ? stP(x, x.vol1) : '—'], [t('tab_volume') + ' · ' + t('w7'), x.vol7 != null ? stP(x, x.vol7) : '—'], [t('tab_volume') + ' · ' + t('w_all'), x.volAll != null ? stP(x, x.volAll) : '—'],
      [t('recent_sales'), x.salesAll != null ? nf(x.salesAll, 0) : '—'], ['', '<a href="' + esc(x.url) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + (x.chain === 'ton' ? 'GetGems' : 'OpenSea') + ' ↗</a>']);
    chartPage({
      imgHtml: stImg(x, 'lg sq'), title: x.name, price: x.floor != null ? stP(x, x.floor) : '—', chg: x.c1,
      tfs: ['4h', '1d', '1w', '1M'], tf: '1d', autoFallback: true, sparse: true, fname: x.id, modes: ['floor', 'sales'], mode: 'floor',
      priceTxt: x.floor != null ? (x.cur === 'ETH' ? fmtPrice(x.floor) + ' ETH' : '💎 ' + nf(x.floor, 2)) : '', imgUrls: function () { return x.img ? [Gifts.thumb(x.img, 256, 'png')] : []; },
      subTxt: function (st) { return t('mode_' + st.mode) + ' · ' + x.cur; },
      fetch: function (tf, st) { return stSeries(x, tf, st.mode); },
      emptyMsg: function (st) { return st.mode === 'floor' ? t('no_floor_hist') : t('no_sales'); },
      note: function (st) { return st.mode === 'floor' ? t('st_floor_note') : ''; },
      extra: [{ id: 'sales', label: t('tab_sales'), render: stSalesTab(x) }, { id: 'vol', label: t('tab_volume'), render: stVolTab(x) }],
      isFav: function () { return S.favS.indexOf(x.id) >= 0; }, toggleFav: function () { toggle(S.favS, x.id, 'favS'); },
      shareText: x.name + (x.floor != null ? ' — ' + stP(x, x.floor).replace(GEM, '') + ' ' + x.cur : ''), overview: ov
    });
  }).catch(function () { if (tok === S.tok) $('#view').innerHTML = errBox(); });
}

/* ---------- GIFTS ---------- */
function getGifts() {
  if (S.cache.gifts) return Promise.resolve(S.cache.gifts);
  return Gifts.list().then(function (l) { S.cache.gifts = l; return l; });
}
/* ---------- بحث الهدايا بالفلاتر (Gift Satellite عبر الـ Worker) ---------- */
var STAR_USD = 0.015, BDMAP = {}, BDP = null;
var GS_MKN = { portals: 'Portals', mrkt: 'MRKT', tonnel: 'Tonnel', onchain: 'On-chain', tg: 'Telegram' };
function mkIc(k) { var u = MKI[k === 'onchain' ? 'getgems' : k]; return u ? '<img class="mki" src="' + u + '" alt="">' : ''; }
function mkTag(k, name) { return mkIc(k) + esc(name || k); }
function gsS() { return S.gsr || (S.gsr = { mode: 'list', col: '', m: [], bd: [], sym: [], num: '', attrs: null, res: null, rows: [], page: 0, pages: 0, busy: false, err: '' }); }
function gsLbl(arr, ph) { return arr.length ? (arr.length === 1 ? arr[0] : arr[0] + ' +' + (arr.length - 1)) : ph; }
function hx(v) { return typeof v === 'number' ? '#' + ('000000' + (v & 0xffffff).toString(16)).slice(-6) : (typeof v === 'string' ? (v.charAt(0) === '#' ? v : '#' + v) : null); }
function bdColors() {
  return BDP || (BDP = fetch('https://api.changes.tg/backdrops').then(function (r) { return r.json(); }).then(function (a) {
    (Array.isArray(a) ? a : []).forEach(function (x) { var c1 = hx(x.centerColor), c2 = hx(x.edgeColor); if (x.name && c1 && c2) BDMAP[String(x.name).toLowerCase()] = [c1, c2]; });
  }).catch(function () {}));
}
function applyBd() {
  var els = document.querySelectorAll('.gst[data-bd]');
  for (var i = 0; i < els.length; i++) { var c = BDMAP[els[i].dataset.bd]; if (c) els[i].style.background = 'radial-gradient(circle at 50% 35%,' + c[0] + ',' + c[1] + ')'; }
}
function gsTile(col, model, bd, cls) {
  var g = giftByName(col);
  return '<div class="gst ' + (cls || '') + '" data-bd="' + esc(String(bd || '').toLowerCase()) + '">' + (g ? gImg(g, model || null, 'gsi') : '') + '</div>';
}
function gsUsd(ton) { return ton * (Gifts.tonUsd || 0); }
/* ---------- رادار فروق الأسعار بين الأسواق ---------- */
function arbS() { return S.arb || (S.arb = store.get('arb', { fee: '5', min: '10' })); }
function arbRows() {
  var s = arbS(), fee = Math.max(0, parseFloat(s.fee) || 0), mn = parseFloat(s.min) || 0, out = [];
  (S.cache.gifts || []).forEach(function (g) {
    var m = g.markets || {}, e = Object.keys(m).filter(function (k) { return m[k] && m[k].p > 0; }).map(function (k) { return { k: k, p: m[k].p, n: m[k].n, s: m[k].s }; });
    if (e.length < 2) return;
    e.sort(function (x, y) { return x.p - y.p; });
    var buy = e[0], sell = e[e.length - 1]; if (buy.p < mn) return;
    var spread = (sell.p - buy.p) / buy.p * 100, net = (sell.p * (1 - fee / 100) - buy.p) / buy.p * 100;
    out.push({ g: g, buy: buy, sell: sell, spread: spread, net: net, profit: sell.p * (1 - fee / 100) - buy.p });
  });
  return out.sort(function (a, b) { return b.net - a.net; });
}
function arbListHtml() {
  var L = arbRows().slice(0, 60); if (!L.length) return '<div class="empty">' + t('arb_none') + '</div>';
  return L.map(function (r) {
    return '<div class="arb" data-act="gift" data-v="' + r.g.id + '"><div class="ai">' + gImg(r.g, null, 'lg sq') + '</div><div class="ab"><b>' + esc(r.g.name) + '</b>' +
      '<div class="al"><span>' + t('arb_buy') + '</span> ' + mkTag(r.buy.k, G_MK(r.buy.k)) + ' · <b>' + GEM + nf(r.buy.p, 2) + '</b></div>' +
      '<div class="al"><span>' + t('arb_sell') + '</span> ' + mkTag(r.sell.k, G_MK(r.sell.k)) + ' · <b>' + GEM + nf(r.sell.p, 2) + '</b></div></div>' +
      '<div class="ar ' + (r.net > 0 ? 'up-t' : 'down-t') + '"><b>' + (r.net > 0 ? '+' : '') + r.net.toFixed(1) + '%</b><small>' + (r.profit > 0 ? '+' : '') + nf(r.profit, 2) + '</small><small class="mu">' + t('arb_gap') + ' ' + r.spread.toFixed(1) + '%</small></div></div>';
  }).join('');
}
function G_MK(k) { return (Gifts.marketLabel || {})[k] || k; }
function vArb(tok) { $('#view').innerHTML = loadingBox(); getGifts().then(function () { if (tok === S.tok) paintArb(); }); }
function paintArb() {
  var s = arbS();
  $('#view').innerHTML = '<div class="dhead"><button class="ib" data-act="back">' + ICON.back + '</button><div class="dn" style="flex:1;text-align:center;margin-inline-end:36px">' + t('arb_title') + '</div></div>' +
    '<div class="note">' + t('arb_note') + '</div>' +
    '<div class="gsf"><label class="arbf">' + t('arb_fee') + '<input id="arb_fee" type="number" inputmode="decimal" min="0" step="any" value="' + esc(s.fee) + '"></label><label class="arbf">' + t('arb_min') + '<input id="arb_min" type="number" inputmode="decimal" min="0" step="any" value="' + esc(s.min) + '"></label></div>' +
    '<div id="arb_list">' + arbListHtml() + '</div>';
}
function vGsearch(tok) {
  $('#view').innerHTML = loadingBox();
  Promise.all([getGifts(), gsCols()]).then(function () { if (tok === S.tok) paintGsearch(); });
  bdColors().then(applyBd);
}
function paintGsearch() {
  var s = gsS();
  $('#view').innerHTML =
    '<div class="seg gsm"><button class="' + (s.mode === 'list' ? 'on' : '') + '" data-act="gsmode" data-v="list">' + t('gs_prices') + '</button><button class="' + (s.mode === 'sales' ? 'on' : '') + '" data-act="gsmode" data-v="sales">' + t('gs_sales') + '</button></div>' +
    (workerOn() ? '' : '<div class="demo">' + t('gs_need_worker') + '</div>') +
    '<div class="gsf">' + gsPickBtn('col', s.col || t('gs_gift'), s.col ? gsTile(s.col, null, '', 'xs') : '', false) +
    gsPickBtn('m', gsLbl(s.m, t('gs_models')), s.m.length && s.col ? gsTile(s.col, s.m[0], '', 'xs') : '', !s.col) +
    gsPickBtn('bd', gsLbl(s.bd, t('gs_bds')), s.bd.length ? '<span class="gst xs" data-bd="' + esc(s.bd[0].toLowerCase()) + '"></span>' : '', !s.col) +
    gsPickBtn('sym', gsLbl(s.sym, t('gs_syms')), '', !s.col) +
    '<input id="gs_n" maxlength="6" value="' + esc(s.num) + '" placeholder="' + esc(t('gs_num')) + '"></div>' +
    '<button class="btn" data-act="gsgo" style="width:100%;margin:10px 0 6px">' + t('gs_go') + '</button>' + (workerOn() ? '<button class="btn ghost" data-act="gssub" style="width:100%;margin:0 0 10px">🔔 ' + t('sub_btn') + '</button>' : '') + '<div id="gsres"></div>' +
    '<div class="note">Data: Gift Satellite · Thanks to @GiftChanges for the API · ⭐ ≈ $' + STAR_USD + '</div>';
  paintGsRes();
}
function gsPickBtn(kind, label, ic, dis) { return '<button class="gspick' + (dis ? ' dis' : '') + (kind === 'col' ? ' wide' : '') + '" data-act="gspick" data-v="' + kind + '">' + ic + '<span>' + esc(label) + '</span><i>▾</i></button>'; }
function gsCols() {
  if (S.gscols) return Promise.resolve(S.gscols);
  if (!workerOn()) return Promise.resolve([]);
  return workerPost('/api/gs', { kind: 'collections' }).then(function (r) { S.gscols = r && r.ok && r.data && r.data.length ? r.data.slice().sort() : null; return S.gscols || []; });
}
function gsPickRows(kind) {
  var s = gsS(), a = s.attrs || {}, list, ph = { col: null, m: t('gs_models'), bd: t('gs_bds'), sym: t('gs_syms') }[kind];
  if (kind === 'col') list = S.gscols && S.gscols.length ? S.gscols : (S.cache.gifts || []).map(function (x) { return x.name; }).sort();
  else list = ((kind === 'm' ? a.models : kind === 'bd' ? a.backdrops : (a.patterns || a.symbols)) || []).map(function (x) { return x.name; });
  var cur = kind === 'col' ? [s.col] : s[kind], h = ph ? '<button class="opt gspr' + (cur.length ? '' : ' on') + '" data-act="gspsel" data-v="' + kind + '" data-n=""><span>' + esc(ph) + '</span></button>' : '';
  return h + list.map(function (n) {
    var ic = kind === 'col' ? gsTile(n, null, '', 'sm') : kind === 'm' ? gsTile(s.col, n, '', 'sm') : kind === 'bd' ? '<span class="gst sm" data-bd="' + esc(n.toLowerCase()) + '"></span>' : '';
    return '<button class="opt gspr' + (cur.indexOf(n) >= 0 ? ' on' : '') + '" data-act="gspsel" data-v="' + kind + '" data-n="' + esc(n) + '" data-q="' + esc(n.toLowerCase()) + '">' + ic + '<span class="gsn2">' + esc(n) + '</span><span>' + (cur.indexOf(n) >= 0 ? '✓' : '') + '</span></button>';
  }).join('');
}
function gsLoadAttrs() {
  var s = gsS(); if (!s.col || !workerOn()) return;
  var col = s.col;
  workerPost('/api/gs', { kind: 'attrs', collection: col }).then(function (r) {
    if (s.col !== col || !S.view || S.view.type !== 'gsearch') return;
    s.attrs = r && r.ok && r.data ? r.data : { models: [], backdrops: [], patterns: [] };
    paintGsearch();
  });
}
function gsCard(x) {
  var ton = +x[5], usd = gsUsd(ton), n = String(x[0] || '').split('-').pop();
  return '<div class="gsc" data-act="gsopen" data-v="' + esc(x[0]) + '"><div class="gsn">#' + esc(n) + '</div>' + gsTile(x[1], x[2], x[3]) +
    '<div class="gsp"><b>' + GEM + nf(ton, 2) + '</b><small>$' + (usd >= 100 ? nf(usd, 0) : nf(usd, 2)) + '</small><small>⭐ ' + nf(Math.round(usd / STAR_USD), 0) + '</small></div></div>';
}
function paintGsRes() {
  var s = gsS(), box = $('#gsres'); if (!box) return;
  if (s.busy) { box.innerHTML = loadingBox(); return; }
  if (s.err) { box.innerHTML = '<div class="empty">' + esc(s.err) + '</div>'; return; }
  var h = '';
  if (s.mode === 'list') {
    if (!s.res) { box.innerHTML = '<div class="empty">' + t('gs_hint') + '</div>'; return; }
    var ks = Object.keys(GS_MKN), floors = '';
    ks.forEach(function (k) { var l = s.res[k]; if (l && l.length) floors += '<div class="gsfl"><small>' + mkTag(k, GS_MKN[k]) + '</small><b>' + GEM + nf(l[0][5], 2) + '</b></div>'; });
    if (!floors) { box.innerHTML = '<div class="empty">' + t('gs_none') + '</div>'; return; }
    h = '<div class="sum gsfls">' + floors + '</div>';
    ks.forEach(function (k) { var l = s.res[k]; if (!l || !l.length) return; h += '<div class="gsmk"><span>' + mkTag(k, GS_MKN[k]) + '</span></div><div class="gsr">' + l.map(gsCard).join('') + '</div>'; });
  } else {
    if (!s.rows.length) { box.innerHTML = '<div class="empty">' + (s.page ? t('gs_none') : t('gs_hint')) + '</div>'; return; }
    h = s.rows.map(function (x) {
      var ton = +x[6], usd = gsUsd(ton), ts = Date.parse(x[7]) / 1000;
      return '<div class="row" data-act="gsopen" data-v="' + esc(x[0]) + '">' + gsTile(x[2], x[3], x[4], 'sm') + '<div class="nm">' + esc(x[2]) + ' #' + esc(x[1]) +
        '<div class="sub">' + esc(x[3] || '') + ' · ' + esc(x[4] || '') + '</div></div><div class="pr">' + GEM + nf(ton, 2) + '<div class="sub">$' + nf(usd, usd >= 100 ? 0 : 2) + ' · ⭐ ' + nf(Math.round(usd / STAR_USD), 0) + '</div><div class="sub">' + (ts ? fmtDate(ts) : '') + '</div></div></div>';
    }).join('') + (s.page < s.pages ? '<button class="btn ghost" data-act="gsmore" style="width:100%;margin-top:8px">' + t('gs_more') + '</button>' : '');
  }
  box.innerHTML = h; applyBd();
}
function gsFetchSales(page) {
  var s = gsS(); s.busy = true; s.err = ''; paintGsRes();
  workerPost('/api/gs', { kind: 'history', collection: s.col, models: s.m, backdrops: s.bd, symbols: s.sym, number: s.num, page: page, sortBy: 'date' }).then(function (r) {
    s.busy = false;
    if (!r || !r.ok) { s.err = t('gs_err'); } else { s.rows = (page ? s.rows : []).concat(r.data.rows || []); s.page = page + 1; s.pages = r.data.pages || 1; }
    paintGsRes();
  });
}

function vGifts(tok) {
  $('#view').innerHTML = loadingBox();
  getGifts().then(function () { if (tok === S.tok) paintGifts(); });
}
function paintGifts() {
  var g = S.g;
  var tabs = [['all', ICON.gifts, t('all_gifts')], ['hot', ICON.fire, t('hot')], ['fav', ICON.heartS, t('favorites')], ['gain', ICON.up, t('gainers')], ['loss', ICON.down, t('losers')], ['deals', ICON.tagI, t('deals')], ['top', ICON.pulse, t('top_sales')]];
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
  var special = g.tab === 'deals' || g.tab === 'top';
  $('#view').innerHTML =
    badge +
    '<div class="tabs"><button data-act="gsrch" data-v="' + (g.tab === 'top' ? 'sales' : 'list') + '" style="color:var(--accent)">' + ICON.search + t('adv_search') + '</button><button data-act="arb" style="color:var(--accent)">📡 ' + t('arb_title') + '</button>' + tabs.map(function (x) { return '<button class="' + (g.tab === x[0] ? 'on' : '') + '" data-act="gtab" data-v="' + x[0] + '">' + x[1] + x[2] + '</button>'; }).join('') + '</div>' +
    (special ? '' : '<div class="bar"><label class="search">' + ICON.search + '<input id="q" value="' + esc(g.q) + '" placeholder="' + t('search_gifts') + '"></label>' +
    '<button class="ib ' + (S.gs.sort !== 'floor_d' || S.gs.min !== '' || S.gs.max !== '' ? 'act' : '') + '" data-act="gsort">' + ICON.sort + '</button>' +
    '<button class="ib ' + (g.map ? 'act' : '') + '" data-act="gmap">' + (g.map ? ICON.list : ICON.grid) + '</button></div>' + sumHtml + '<div id="mstat"></div>') + '<div id="glist"></div>';
  if (!special) paintMStat($('#mstat'));
  paintGiftList();
}

/* ---------- بيانات الملخصات (top.json / opps.json) ---------- */
function loadExtra() {
  var c = S.cache;
  if (c.extra && Date.now() - c.extraT < 300000) return c.extra;
  c.extraT = Date.now();
  return c.extra = Promise.all([Gifts.json('top.json'), Gifts.json('opps.json')]).then(function (r) { c.extraData = { top: r[0], opps: r[1] }; return c.extraData; });
}
function giftByName(n) { var k = String(n).toLowerCase().replace(/[^a-z0-9]/g, ''); return (S.cache.gifts || []).find(function (x) { return String(x.name).toLowerCase().replace(/[^a-z0-9]/g, '') === k; }); }
function mkName(k) { return Gifts.marketLabel[k] || k; }
function openGiftByName(n, m) { var g = giftByName(n); if (!g) return; go(m ? { type: 'gift', id: g.id, model: m } : { type: 'gift', id: g.id }); }
function giftRowHtml(g, model, mid, right, act) {
  return '<div class="row" data-act="' + act + '" data-v="' + esc(g ? g.id : '') + '" data-m="' + esc(model || '') + '">' + (g ? '<span class="lgb">' + gImg(g, model || null, 'lg sq') + '</span>' : '') + mid + right + '</div>';
}
function paintMStat(box) { // ملخص السوق (24 ساعة)
  loadExtra().then(function (x) {
    var s = x.top && x.top.stats; if (!s || !box.isConnected) return;
    var d = s.d1, p = s.prev, chg = p && p.v > 0 ? (d.v - p.v) / p.v * 100 : null;
    box.innerHTML = '<div class="sum"><div><small>' + t('vol24') + '</small><b>' + gvBig(d.v) + '</b>' + (chg != null ? pill(chg) : '') + '</div><div><small>' + t('sales24') + '</small><b>' + nf(d.n, 0) + '</b></div></div>';
  });
}
function paintTop(box) {
  box.innerHTML = loadingBox();
  loadExtra().then(function (x) {
    if (!box.isConnected || S.g.tab !== 'top') return;
    var tp = x.top; if (!tp) return box.innerHTML = '<div class="empty">' + t('no_data_yet') + '</div>';
    var s = tp.stats || {}, d = s.d1 || { n: 0, v: 0 }, p = s.prev || { n: 0, v: 0 }, chg = p.v > 0 ? (d.v - p.v) / p.v * 100 : null;
    var bm = Object.keys(s.byMarket || {}).sort(function (A_, B_) { return s.byMarket[B_].v - s.byMarket[A_].v; });
    var mx = bm.length ? s.byMarket[bm[0]].v : 1;
    var html = '<div class="sum"><div><small>' + t('vol24') + '</small><b>' + gvBig(d.v) + '</b>' + (chg != null ? pill(chg) : '') + '</div><div><small>' + t('sales24') + '</small><b>' + nf(d.n, 0) + '</b></div></div>' +
      (chg != null ? '<div class="note" style="text-align:center">' + t('vs_prev') + '</div>' : '');
    if (bm.length) html += '<div class="lbl">' + t('by_market') + '</div><div class="card">' + bm.map(function (k) {
      var m = s.byMarket[k];
      return '<div class="bar2"><span>' + mkTag(k, mkName(k)) + '</span><i style="width:' + Math.max(3, m.v / mx * 100).toFixed(0) + '%"></i><b>' + gvBig(m.v) + ' <small>· ' + m.n + '</small></b></div>';
    }).join('') + '</div>';
    html += '<div class="lbl">' + t('top_gifts') + '</div>' + (tp.gifts || []).slice(0, 10).map(function (r, i) {
      var g = giftByName(r.n), f = g ? g.floor : null;
      return giftRowHtml(g, null, '<div class="nm"><span class="rk">' + (i + 1) + '</span> ' + esc(r.n) + '<small class="sub">' + r.c + ' · ' + gvBig(r.v) + '</small></div>', '<div class="pr">' + (f != null ? gv(f) : '') + '</div>', 'gift');
    }).join('');
    html += '<div class="lbl">' + t('top_models') + '</div>' + (tp.models || []).slice(0, 10).map(function (r, i) {
      var g = giftByName(r.n);
      return giftRowHtml(g, r.m, '<div class="nm"><span class="rk">' + (i + 1) + '</span> ' + esc(r.n) + ' · ' + esc(r.m) + '<small class="sub">' + r.c + ' · ' + gvBig(r.v) + '</small></div>', '', 'model');
    }).join('');
    box.innerHTML = html;
  });
}
function paintDeals(box) {
  box.innerHTML = loadingBox();
  loadExtra().then(function (x) {
    if (!box.isConnected || S.g.tab !== 'deals') return;
    var o = x.opps; if (!o || !o.items || !o.items.length) return box.innerHTML = '<div class="empty">' + t('no_data_yet') + '</div>';
    var f = S.df, L = o.items.filter(function (i) { return i.d >= 3 && (f === 'all' || (f === 'gifts' ? !i.m : !!i.m)); }).slice(0, 60);
    var chips = [['all', t('f_all')], ['gifts', t('f_gifts')], ['models', t('f_models')]].map(function (c) { return '<button class="chip2 ' + (f === c[0] ? 'on' : '') + '" data-act="dfilter" data-v="' + c[0] + '">' + c[1] + '</button>'; }).join('');
    box.innerHTML = '<div class="chips">' + chips + '</div><div class="note">' + t('deals_note') + '</div>' + (L.length ? L.map(function (i) {
      var g = giftByName(i.n);
      return giftRowHtml(g, i.m, '<div class="nm">' + esc(i.n) + (i.m ? ' · ' + esc(i.m) : '') + '<small class="sub">' + t('avg7') + ' ' + gv(i.avg) + ' · ' + t('last') + ' ' + (i.last != null ? gv(i.last) : '—') + ' · ' + i.c7 + ' ' + t('sales7') + '</small></div>',
        '<div class="pr">' + gv(i.f) + '<small class="sub">' + mkTag(i.mk, mkName(i.mk)) + '</small></div><span class="pill up">-' + i.d.toFixed(1) + '%</span>', i.m ? 'model' : 'gift');
    }).join('') : '<div class="empty">' + t('no_data_yet') + '</div>') +
      '<div class="note" style="text-align:center">' + t('updated_at') + ': ' + fmtDate(o.u) + '</div>';
  });
}
function giftFiltered() {
  var g = S.g, L = S.cache.gifts.slice();
  if (g.q) L = L.filter(function (x) { return x.name.toLowerCase().indexOf(g.q.toLowerCase()) >= 0; });
  if (g.tab === 'fav') L = L.filter(function (x) { return S.favG.indexOf(x.id) >= 0; });
  if (g.tab === 'gain') L = L.filter(function (x) { return x.change > 0; }).sort(function (a, b) { return b.change - a.change; });
  else if (g.tab === 'loss') L = L.filter(function (x) { return x.change < 0; }).sort(function (a, b) { return a.change - b.change; });
  else if (g.tab === 'hot') L = L.filter(function (x) { return x.change !== 0; }).sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change); }).slice(0, 20);
  else {
    var gs = S.gs, ex = S.cache.extraData, cols = ex && ex.opps && ex.opps.cols || {};
    var cv = function (x, k) { var r = cols[x.name]; if (!r) { var nk = Object.keys(cols).find(function (n) { return n.toLowerCase().replace(/[^a-z0-9]/g, '') === x.name.toLowerCase().replace(/[^a-z0-9]/g, ''); }); r = nk ? cols[nk] : null; } return r ? r[k] || 0 : 0; };
    var mn = parseFloat(gs.min), mx = parseFloat(gs.max);
    if (mn > 0) L = L.filter(function (x) { return x.floor >= mn; });
    if (mx > 0) L = L.filter(function (x) { return x.floor <= mx; });
    var fn = { floor_d: function (p, q) { return q.floor - p.floor; }, floor_a: function (p, q) { return p.floor - q.floor; }, chg_d: function (p, q) { return q.change - p.change; }, chg_a: function (p, q) { return p.change - q.change; },
      name: function (p, q) { return p.name.localeCompare(q.name); }, sales: function (p, q) { return cv(q, 'c1') - cv(p, 'c1'); }, vol: function (p, q) { return cv(q, 'v1') - cv(p, 'v1'); } }[gs.sort] || function (p, q) { return q.floor - p.floor; };
    L.sort(fn);
  }
  return L;
}
function paintGiftList() {
  var g = S.g, box = $('#glist');
  if (!box) return;
  if (g.tab === 'deals') return paintDeals(box);
  if (g.tab === 'top') return paintTop(box);
  var L = giftFiltered();
  if (g.tab === 'fav' && !L.length && !g.q) { box.innerHTML = '<div class="empty"><p>' + t('no_favs') + '</p><button class="btn" data-act="addgifts">+ ' + t('add_gifts') + '</button></div>'; return; }
  if (g.map) return paintMap(L, box);
  box.innerHTML = L.map(function (x) {
    return '<div class="row"><button class="lgb" data-act="models" data-v="' + x.id + '">' + gImg(x, null, 'lg sq') + '</button>' +
      '<div class="nm" data-act="gift" data-v="' + x.id + '">' + esc(x.name) + '</div>' +
      '<button class="pr" data-act="gift" data-v="' + x.id + '">' + gv(x.floor) + '</button>' + pill(x.change) + '</div>';
  }).join('') + (g.tab === 'fav' ? '<div class="empty" style="padding:16px"><button class="btn" data-act="addgifts">+ ' + t('add_gifts') + '</button></div>' : '');
}
function drawBrand(c, x, y, fs, ga) { // رمز الجرام + @ARBTON على الكانفس (x يسار، y منتصف)
  var d = fs * 1.05;
  if (GEMIMG.complete && GEMIMG.naturalWidth) { c.save(); if (ga != null) c.globalAlpha = ga; c.beginPath(); c.arc(x + d / 2, y, d / 2, 0, 6.2832); c.clip(); c.drawImage(GEMIMG, x, y - d / 2, d, d); c.restore(); }
  c.fillText('@' + CONFIG.BRAND, x + d + fs * 0.25, y);
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
  var i = Math.min(Math.abs(c) / 8, 1);
  return c >= 0 ? 'hsl(142,96%,' + (34 - 4 * i) + '%)' : 'hsl(0,100%,' + (62 - 5 * i) + '%)';
}
// حجم المربع: مقياس لوغاريتمي، الأولوية للأعلى (سعر/قيمة سوقية)، وأصغر مربع لسه بيتّسع للصورة + الاسم + النسبة
function tmValue(raw, lo, hi) {
  var t0 = hi > lo ? (Math.log(Math.max(raw, lo)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : 0;
  return 1 + 7 * Math.pow(Math.min(1, Math.max(0, t0)), 1.6);
}
function tmScale(arr, get, fl) { // مساحة متناسبة مع القيمة (زي المرجع) مع حد أدنى عشان أصغر مربع يفضل مقروء
  var v = arr.map(function (x) { return Math.max(1e-9, +get(x) || 0); });
  var hi = Math.max.apply(null, v) || 1;
  return v.map(function (x) { return Math.pow(Math.max(x, hi * (fl || 0.008)) / hi, 0.38) * 100; }); // جذر تربيعي: المربعات الكبيرة تصغر وكل الصور تبان
}
// items: {id, act, value, name, short, price(html), priceTxt, gem, change, gid, g, imgFn(), imgUrls()}
function tmTiles(items, W, H) {
  return squarify(items, 0, 0, W, H).map(function (n) {
    var w = n.w, h = n.h, c = +n.change || 0, avail = h - 3, gap = 1.2;
    var nm = (n.short && w / (n.name.length * 0.6) < 9) ? n.short : n.name;
    var fs = Math.max(5, Math.min(18, w / (Math.max(nm.length, 4) * 0.6), h / 4.4));
    var ptxt = (n.priceTxt || '0.00'), plen = ptxt.length + (n.gem ? 2 : 1);
    var pf = Math.max(4.4, Math.min(fs * 0.78, (w - 4) / (plen * 0.6)));
    var price = w >= 22 && h >= 20 && !!n.priceTxt, chg = w >= 22 && h >= 24;
    // الأولوية: الاسم + السعر + النسبة. الصورة بتتحط بس لو فيه مساحة، وبتصغر قبل ما نصغّر الخط
    var textH = function () { return fs * 1.2 + (price ? pf * 1.2 + gap : 0) + (chg ? pf * 1.2 + gap : 0); };
    for (var it = 0; it < 40 && textH() > avail; it++) {
      if (fs > 5.1) { fs *= 0.93; pf = Math.max(4.4, pf * 0.93); }
      else if (pf > 4.5) pf = Math.max(4.4, pf * 0.93);
      else if (chg) chg = false;
      else break;
    }
    var room = avail - textH() - gap, iconS = Math.min(w * 0.62, room, 90);
    var showIcon = !!n.imgFn && iconS >= 10;
    n.c = c; n.nm = nm; n.fs = fs; n.pfs = pf; n.iconS = showIcon ? iconS : 0; n.showIcon = showIcon; n.showName = true; n.showChg = chg; n.showPrice = price;
    n.th = textH() + (showIcon ? iconS + gap : 0);
    return n;
  });
}
function tmMark(tiles) { // العلامة في أكبر مساحة فاضية أسفل مربع (حجم الخط يتكيّف مع المساحة)
  var best = null, bf = -1;
  tiles.forEach(function (n) { var free = (n.h - n.th * 1.2) / 2; if (n.w >= 60 && (free > bf + 6 || (Math.abs(free - bf) <= 6 && best && n.w * n.h > best.w * best.h))) { best = n; bf = free; } });
  if (!best) return null;
  var fs = Math.max(9, Math.min(14, bf - 2));
  return { x: best.x + 5, y: best.y + best.h - fs - 3, fs: fs };
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
var FOOT = 0; // @ARBTON بيتحط فوق أكبر مربع زي المرجع (من غير شريط منفصل)
function mapHeight(n) { return Math.max(440, Math.round(window.innerHeight - 190)); }
// أصغر ارتفاع بحيث كل مربع يتّسع للصورة + الاسم + النسبة. الخريطة بتتفرد بالارتفاع بدل ما تخبّي مربعات
function tmFit(items, W, H0) {
  var H = H0, cap = items.length <= 25 ? 760 : items.length <= 50 ? 1150 : 2000; // سقف الارتفاع: 50 مربع تقريباً شاشة ونص، و100 حوالي شاشتين
  for (var i = 0; i < 60; i++) {
    var ok = squarify(items, 0, 0, W, H).every(function (n) { return n.w >= 44 && n.h >= 58; });
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
  var mk = tmMark(tmTiles(items, W, H));
  tm.innerHTML = treemapHtml(items, W, H) + '<div class="tmwm" style="' + (mk ? 'left:' + mk.x.toFixed(0) + 'px;top:' + mk.y.toFixed(0) + 'px;font-size:' + mk.fs.toFixed(0) + 'px' : 'left:8px;bottom:4px') + '">' + GEM + '@' + esc(CONFIG.BRAND) + '</div>';
  var cnt = $('#tmcount'); if (cnt) cnt.textContent = t('shown_count').replace('{n}', tm.querySelectorAll('.tile').length).replace('{m}', total);
  S.tmData = { items: items, W: W, H: H, title: title };
}
function mapCur() { return S.tab === 'crypto' && S.c.kind === 'stock' ? 'usd' : (S.mcur || (S.tab === 'crypto' ? 'usd' : S.cur)); }
function mapRow(metricHtml, topHtml) {
  var mc = mapCur();
  var seg = '<div class="seg"><button class="' + (mc === 'gem' ? 'on' : '') + '" data-act="mcur" data-v="gem">' + GEM + '</button><button class="' + (mc === 'usd' ? 'on' : '') + '" data-act="mcur" data-v="usd">$</button></div>';
  if ((S.tab === 'crypto' && S.c.kind === 'stock') || S.tab === 'stickers') seg = '';
  return '<div class="mrow">' + metricHtml + topHtml + seg + '<button class="ib" data-act="mshare">' + ICON.share + '</button><button class="ib" data-act="mdl">' + ICON.dl + '</button></div>';
}
function topSelect(id, top) {
  return '<select id="' + id + '"><option value="25" ' + (top === 25 ? 'selected' : '') + '>' + t('map_top') + ' 25</option><option value="50" ' + (top === 50 ? 'selected' : '') + '>' + t('map_top') + ' 50</option><option value="100" ' + (top === 100 ? 'selected' : '') + '>' + t('map_top') + ' 100</option></select>';
}
function paintMap(L, box) {
  var m = Gifts.hasSupply ? S.g.metric : 'floor', top = S.g.top || 50;
  var key = function (x) { return m === 'chg' ? Math.abs(+x.change || 0) : m === 'cap' ? x.floor * x.supply : x.floor; };
  var all = L.slice().sort(function (a, b) { return key(b) - key(a); }), pick = all.slice(0, top);
  var vals = tmScale(pick, key, m === 'chg' ? 0.03 : 0.008), mcur = mapCur();
  var items = pick.map(function (x, i) {
    return { id: x.id, act: 'gift', value: vals[i], name: x.name, short: x.name.split(' ')[0],
             price: mcur === 'gem' ? GEM + nf(x.floor, 2) : '$' + nf(x.floor * Gifts.tonUsd, 2), priceTxt: mcur === 'gem' ? nf(x.floor, 2) : '$' + nf(x.floor * Gifts.tonUsd, 2), gem: mcur === 'gem',
             change: x.change, gid: x.id, g: x, imgFn: function () { return gImg(x, null, 'tim'); } };
  });
  box.innerHTML = mapRow('<select id="metric">' +
    (Gifts.hasSupply ? '<option value="cap" ' + (m === 'cap' ? 'selected' : '') + '>' + t('market_cap') + '</option>' : '') +
    '<option value="floor" ' + (m === 'floor' ? 'selected' : '') + '>' + t('floor') + '</option>' +
    '<option value="chg" ' + (m === 'chg' ? 'selected' : '') + '>' + t('change') + '</option></select>', topSelect('gtop', top)) +
    '<div class="tm" id="tm"></div><div class="note" id="tmcount"></div><div class="note">' + t('size_note') + '</div>';
  fillTreemap(items, t('map_title_gifts') + ' · ' + t('map_top') + ' ' + top, all.length);
}
function paintCoinMap(L, box) {
  var m = S.c.metric, top = S.c.top || 50;
  var val = function (x) { return m === 'chg' ? Math.abs(+x.price_change_percentage_24h || 0) : Math.max(1, m === 'vol' ? x.total_volume : x.market_cap); };
  var all = L.slice().sort(function (a, b) { return val(b) - val(a); }), pick = all.slice(0, top);
  var vals = tmScale(pick, val, m === 'chg' ? 0.03 : 0.008), mcur = mapCur();
  var items = pick.map(function (x, i) {
    return { id: x.id, act: 'coin', value: vals[i], name: x.name, short: x.symbol.toUpperCase(),
             price: mcur === 'gem' && Gifts.tonUsd > 0 ? GEM + fmtPrice(x.current_price / Gifts.tonUsd) : '$' + fmtPrice(x.current_price),
             priceTxt: mcur === 'gem' && Gifts.tonUsd > 0 ? fmtPrice(x.current_price / Gifts.tonUsd) : '$' + fmtPrice(x.current_price), gem: mcur === 'gem' && Gifts.tonUsd > 0, change: x.price_change_percentage_24h,
             imgUrls: function () { return [Gifts.thumb(x.image, 128, 'png')]; },
             imgFn: function () { return '<img class="tim" src="' + esc(x.image) + '" alt="">'; } };
  });
  box.innerHTML = mapRow('<select id="cmetric"><option value="cap" ' + (m === 'cap' ? 'selected' : '') + '>' + t('market_cap') + '</option>' +
    '<option value="vol" ' + (m === 'vol' ? 'selected' : '') + '>' + t('volume') + '</option>' +
    '<option value="chg" ' + (m === 'chg' ? 'selected' : '') + '>' + t('change') + '</option></select>', topSelect('ctop', top)) +
    '<div class="tm" id="tm"></div><div class="note" id="tmcount"></div><div class="note">' + t('size_note') + '</div>';
  fillTreemap(items, t(S.c.kind === 'stock' ? 'map_title_stocks' : 'map_title_coins') + ' · ' + t('map_top') + ' ' + top, all.length);
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
  var modes = ['floor', 'sales'].concat(!o.isModel && g.points && g.points.length > 1 ? ['frag'] : []);
  return {
    imgHtml: gImg(g, o.isModel ? o.model : null, 'lg sq'), title: o.name, sub: !o.isModel && g.supply ? fmtBig(g.supply) : '', price: o.floor != null ? gv(o.floor) : '—', chg: o.chg,
    tfs: GTFS2, tf: '1W', curToggle: true, autoFallback: true, fname: g.name + (o.isModel ? '-' + o.model : ''), modes: modes, mode: modes[0], markets: true,
    hideMkt: o.isModel ? ['floor', 'frag'] : ['frag'], ovAsync: o.ovAsync,
    priceTxt: o.floor != null ? (S.cur === 'gem' ? '💎 ' + nf(o.floor, 2) : '$' + nf(o.floor * Gifts.tonUsd, 2)) : '',
    imgUrls: function () { return Gifts.exportImgs(g, o.isModel ? o.model : null); },
    subTxt: function (st) { return t('mode_' + st.mode) + (st.mode !== 'frag' ? ' · ' + mktName(st.market) : ''); },
    fetch: function (tf, st) { return Gifts.series(g, { mode: st.mode, market: st.market, model: o.model, tf: tf }); },
    emptyMsg: function (st) { return st.mode === 'floor' ? t('no_floor_hist') : st.mode === 'frag' ? t('no_history') : t('no_sales'); },
    note: function (st) { return st.mode === 'floor' ? (o.isModel ? t('model_floor_note') : t('floor_note')) : st.mode === 'frag' ? t('daily_note') : ''; },
    extra: [{ id: 'sales', label: t('tab_sales'), render: renderSalesTab(g, o.model) }, { id: 'vol', label: t('tab_volume'), render: renderVolTab(g, o.model) }],
    isFav: function () { return S.favG.indexOf(g.id) >= 0; }, toggleFav: function () { toggle(S.favG, g.id, 'favG'); },
    alertName: g.name, models: !o.isModel, gid: g.id, shareText: o.name + (o.floor != null ? ' — ' + '💎 ' + nf(o.floor, 2) : ''), overview: o.ov
  };
}
function vGift(tok) {
  $('#view').innerHTML = loadingBox();
  getGifts().then(function (list) {
    var g = list.find(function (x) { return x.id === S.view.id; }); if (!g) return back();
    var mp = S.view.model ? Gifts.models(g.id) : Promise.resolve(null), fb = null;
    if (S.view.model) mp = mp.then(function (ms) { // موديل من غير فلور: نستخدم آخر عملية بيع بدل "—"
      var m0 = ms && ms.find(function (x) { return x.name === S.view.model; });
      if (m0 && m0.floor != null) return ms;
      return Gifts.salesRows(g, 'all', S.view.model).then(function (r) { if (r.rows.length) fb = r.rows[0]; return ms; }).catch(function () { return ms; });
    });
    return mp.then(function (ms) {
      if (tok !== S.tok) return;
      var name = g.name, floor = g.floor, chg = g.change, rar = null, lst = null, isModel = false;
      if (ms) { var m = ms.find(function (x) { return x.name === S.view.model; }); if (m) { isModel = true; name = g.name + ' · ' + m.name; floor = m.floor; chg = m.change; rar = m.rarity; lst = m.listings; if (floor == null && fb) { floor = fb[1]; } } }
      var hasMk = !isModel && g.markets && Gifts.mode === 'live';
      var ov = floor != null ? [[hasMk ? t('best_floor') + ' (' + (Gifts.marketLabel[g.best] || g.best) + ')' : t('floor') + (Gifts.mode === 'live' ? ' (' + t('market_src') + ')' : ''), gv(floor)]] : [];
      if (hasMk) {
        Object.keys(g.markets).sort(function (a, b) { return g.markets[a].p - g.markets[b].p; }).forEach(function (k) {
          var m = g.markets[k];
          var bp = g.markets[g.best] ? g.markets[g.best].p : m.p;
          ov.push([mkTag(k, Gifts.marketLabel[k]) + (k === g.best ? ' ★' : ''), gv(m.p) + (k !== g.best && bp > 0 ? ' <small class="up-t">+' + ((m.p - bp) / bp * 100).toFixed(1) + '%</small>' : '') + ' <small style="opacity:.6">· ' + (m.n >= 50 ? '50+' : m.n) + '</small>', true]);
        });
        var ps = Object.keys(g.markets).map(function (k) { return g.markets[k].p; });
        if (ps.length > 1) ov.push([t('spread'), pill((Math.max.apply(null, ps) - Math.min.apply(null, ps)) / Math.min.apply(null, ps) * 100)]);
        if (g.fragFloor != null) ov.push([t('fragment'), gv(g.fragFloor)]);
      }
      if (chg != null) ov.push([t(Gifts.hasSupply ? 'change24' : 'daily_change'), pill(chg)]);
      var mObj = isModel ? ms.find(function (x) { return x.name === S.view.model; }) : null;
      if (isModel) {
        if (mObj && mObj.live) {
          ov = [[t('best_floor') + ' (' + (Gifts.marketLabel[mObj.best] || mObj.best) + ')', gv(mObj.floor)]];
          Object.keys(mObj.mk || {}).sort(function (a, b) { return mObj.mk[a] - mObj.mk[b]; }).forEach(function (k) {
            var bp2 = mObj.mk[mObj.best] || mObj.mk[k];
            ov.push([mkTag(k, Gifts.marketLabel[k]) + (k === mObj.best ? ' ★' : ''), gv(mObj.mk[k]) + (k !== mObj.best && bp2 > 0 ? ' <small class="up-t">+' + ((mObj.mk[k] - bp2) / bp2 * 100).toFixed(1) + '%</small>' : ''), true]);
          });
          var ps2 = Object.keys(mObj.mk || {}).map(function (k) { return mObj.mk[k]; });
          if (ps2.length > 1) ov.push([t('spread'), pill((Math.max.apply(null, ps2) - Math.min.apply(null, ps2)) / Math.min.apply(null, ps2) * 100)]);
          if (chg != null) ov.push([t('change24'), pill(chg)]);
        }
        if (rar != null) ov.push([t('rarity'), rar + '‰']);
        if (mObj && mObj.c7 != null) ov.push(['7d', pill(mObj.c7)]);
        if (mObj && mObj.c30 != null) ov.push(['30d', pill(mObj.c30)]);
        if (mObj && mObj.actual != null) ov.push([t('rarity') + ' (census)', nf(mObj.actual, 1) + '‰']);
        if (lst != null) ov.push([t('listings'), nf(lst, 0)]);
        ov.push([t('collection'), esc(g.name)]);
      } else {
        if (g.sales != null) ov.push([t('recent_sales'), nf(g.sales, 0)]);
        if (g.issued) ov.push([t('minted'), nf(g.issued, 0) + ' / ' + nf(g.total, 0)], [t('market_cap'), gvBig(g.floor * g.issued)]);
        if (g.c7 != null) ov.push(['7d', pill(g.c7)]);
        if (g.c30 != null) ov.push(['30d', pill(g.c30)]);
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
      var cardRows = [];
      var mks = isModel ? (mObj && mObj.mk) : (g.markets ? Object.keys(g.markets).reduce(function (o, k) { o[k] = g.markets[k].p; return o; }, {}) : null);
      if (mks) Object.keys(mks).sort(function (x, y) { return mks[x] - mks[y]; }).slice(0, 5).forEach(function (k) { cardRows.push([Gifts.marketLabel[k] || k, '💎 ' + nf(mks[k], 2)]); });
      var cardInfo = { title: g.name, sub: isModel ? mdl : '', g: g, model: isModel ? mdl : null, price: floor, chg: chg, rows: cardRows };
      if (Gifts.mode === 'live') { var cfgG = giftChartCfg(g, { name: name, floor: floor, chg: chg, isModel: isModel, model: mdl, ov: ov, ovAsync: ovAsync }); cfgG.card = cardInfo; return chartPage(cfgG); }
      chartPage({
        imgHtml: gImg(g, isModel ? S.view.model : null, 'lg sq'), title: name, price: floor != null ? gv(floor) : '—', chg: chg, tfs: GTFS, tf: '1d', fname: g.name,
        fetch: function (tf) { return Gifts.chart(g.id, S.view.model || '', tf, floor); },
        isFav: function () { return S.favG.indexOf(g.id) >= 0; }, toggleFav: function () { toggle(S.favG, g.id, 'favG'); },
        forceStyle: Gifts.mode === 'live' ? 'area' : null, // المصدر لقطات يومية: خط حقيقي أصدق من شموع مصطنعة
        note: Gifts.mode === 'live' && !isModel ? (hasMk ? t('gs_note') : t('daily_note')) : '',
        models: !S.view.model, gid: g.id, shareText: name + (floor != null ? ' — ' + '💎 ' + nf(floor, 2) : ''), overview: ov
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
/* ---------- محفظة الكارت (بروفايل) ---------- */
var WC_TH = {
  gold: ['#8a7a45', '#b9a46a', '#d9c590'], blue: ['#1d56b8', '#3a8ae8', '#8fc2ff'], dark: ['#17171d', '#30303b', '#7d7d8c'],
  pink: ['#a8386f', '#e06aa4', '#ffb3d6'], green: ['#16694a', '#35ad78', '#9be3c1'], purple: ['#4b2a8f', '#8458e0', '#c9b3ff']
};
var WC_BLK = { 'black': ['#3a3b3d', '#0c0c0d'], 'onyx black': ['#2b2b2e', '#000000'] };
function wcMix(h, k) { var n = parseInt(h.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return 'rgb(' + Math.round(r + (255 - r) * k) + ',' + Math.round(g + (255 - g) * k) + ',' + Math.round(b + (255 - b) * k) + ')'; }
function wcTotal(assets) { var w = WC(); return w.src === 'wallet' && w.addr && S.wcBal != null ? S.wcBal : assets; }
function wcFetchBal() {
  var w = WC(); if (w.src !== 'wallet' || !w.addr) return;
  if (S.wcBalT && Date.now() - S.wcBalT < 30000 && S.wcBalA === w.addr) return;
  S.wcBalT = Date.now(); S.wcBalA = w.addr;
  fetch('https://tonapi.io/v2/accounts/' + encodeURIComponent(w.addr)).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
    S.wcBal = (+j.balance || 0) / 1e9; S.wcErr = false;
    var b = $('.wbal'), u = $('.wusd'); if (b) b.innerHTML = wcBalHtml(S.wcBal); if (u && Gifts.tonUsd > 0) u.textContent = '$' + nf(S.wcBal * Gifts.tonUsd, 2);
  }).catch(function () { S.wcErr = true; S.wcBalT = 0; });
}
function wcCols() { var w = WC(); return w.c ? w.c : WC_TH[w.theme]; } // [edge, center, light]
function wcBg(w) { var c = wcCols(); return w.c ? 'radial-gradient(circle at 38% 45%,' + c[1] + ',' + c[0] + ' 85%)' : 'linear-gradient(135deg,' + c[0] + ',' + c[1] + ' 55%,' + c[0] + ')'; }
function WC() { var w = S.wc || (S.wc = store.get('wc', { theme: 'gold', stk: [] })); if (!w.stk) w.stk = []; if (!WC_TH[w.theme]) w.theme = 'gold'; return w; }
function wcSave() { store.set('wc', WC()); }
function wcBalHtml(total) {
  var s = nf(total, 2), p = s.lastIndexOf('.'), hasDec = p >= 0 && /^\d+$/.test(s.slice(p + 1));
  return GEM + '<b>' + esc(hasDec ? s.slice(0, p) : s) + '</b>' + (hasDec ? '<small>.' + esc(s.slice(p + 1)) + '</small>' : '') + '<span>GRAM</span>';
}
function wcStickerHtml(w, edit) {
  return w.stk.map(function (st, i) {
    var g = giftById(st.gid); if (!g) return '';
    return '<div class="wst' + (edit ? ' ed' : '') + (edit && S.wcSel === i ? ' sel' : '') + '" data-i="' + i + '" style="left:' + st.x.toFixed(1) + '%;top:' + st.y.toFixed(1) + '%;width:' + st.s.toFixed(1) + '%">' + gImg(g, st.m || null, 'wsi') + '</div>';
  }).join('');
}
function wcardHtml(total, name, un) {
  var w = WC(), th = wcCols(), edit = !!S.wcEdit; total = wcTotal(total); var usd = total * (Gifts.tonUsd || 0);
  return '<div class="wcard" id="wcard" style="background:' + wcBg(w) + '"><div class="wpat"></div>' +
    '<div class="wbal">' + wcBalHtml(total) + '</div>' + (usd > 0 ? '<div class="wusd">$' + nf(usd, 2) + '</div>' : '') +
    '<div class="wname">' + esc((U.username ? U.username : name).toUpperCase()) + '</div>' +
    '<div class="wqr"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18z"/></svg></div>' +
    wcStickerHtml(w, edit) + '</div>' +
    '<div class="pacts wcb"><button data-act="wcadd">' + ICON.plus + t('wc_sticker') + '</button><button data-act="wctheme">🎨 ' + t('wc_color') + '</button><button class="' + (edit ? 'on' : '') + '" data-act="wcedit">' + ICON.edit + t('wc_move') + '</button><button data-act="wcsave">' + ICON.dl + t('wc_save') + '</button><button data-act="wcaddr">👛 ' + t('wc_wallet') + '</button></div>' +
    (edit && w.stk.length ? '<div class="pacts wcb"><button data-act="wcsmall">− ' + t('wc_size') + '</button><button data-act="wcbig">+ ' + t('wc_size') + '</button><button data-act="wcdel">🗑 ' + t('wc_remove') + '</button></div><div class="note">' + t('wc_hint') + '</div>' : '');
}
function wcBind() {
  var c = $('#wcard'); if (!c) return;
  c.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.wst'); if (!el || !S.wcEdit) return;
    e.preventDefault();
    var i = +el.getAttribute('data-i'), r = c.getBoundingClientRect(), st = WC().stk[i], sx = e.clientX, sy = e.clientY, ox = st.x, oy = st.y;
    S.wcSel = i; Array.prototype.forEach.call(c.querySelectorAll('.wst'), function (n) { n.classList.toggle('sel', n === el); });
    function mv(ev) { st.x = Math.max(0, Math.min(100, ox + (ev.clientX - sx) / r.width * 100)); st.y = Math.max(0, Math.min(100, oy + (ev.clientY - sy) / r.height * 100)); el.style.left = st.x + '%'; el.style.top = st.y + '%'; }
    function up() { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); wcSave(); }
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
  });
}
function wcExport() {
  var w = WC(), th = wcCols(), W = 1280, H = 737, total = 0;
  S.prof.items.forEach(function (it) { var g = giftById(it.gid); if (g) total += g.floor * it.qty; });
  total = wcTotal(total);
  var jobs = w.stk.map(function (st) { var g = giftById(st.gid); return g ? loadImgTry(Gifts.exportImgs(g, st.m || null)) : Promise.resolve(null); });
  modal('<div class="loading">' + t('generating') + '</div>');
  Promise.all(jobs).then(function (imgs) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var c = cv.getContext('2d');
    var gr; if (w.c) { gr = c.createRadialGradient(W * 0.38, H * 0.45, 20, W * 0.38, H * 0.45, W * 0.85); gr.addColorStop(0, th[1]); gr.addColorStop(1, th[0]); } else { gr = c.createLinearGradient(0, 0, W, H); gr.addColorStop(0, th[0]); gr.addColorStop(0.55, th[1]); gr.addColorStop(1, th[0]); }
    rr(c, 0, 0, W, H, 70); c.save(); c.clip(); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.07)'; for (var y = 40; y < H; y += 110) for (var x = ((y / 110) % 2) * 80 + 40; x < W; x += 160) { c.beginPath(); c.arc(x, y, 9, 0, 6.2832); c.fill(); }
    var sh = c.createLinearGradient(0, 0, W, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.45, 'rgba(255,255,255,.10)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sh; c.fillRect(0, 0, W, H);
    c.textBaseline = 'middle'; c.textAlign = 'left';
    var s = nf(total, 2), p = s.lastIndexOf('.'), ip = p >= 0 ? s.slice(0, p) : s, dp = p >= 0 ? s.slice(p) : '', x0 = 110, yb = H * 0.42;
    if (GEMIMG.complete && GEMIMG.naturalWidth) { c.save(); c.beginPath(); c.arc(x0 + 38, yb, 38, 0, 6.2832); c.clip(); c.drawImage(GEMIMG, x0, yb - 38, 76, 76); c.restore(); }
    var tx = x0 + 100; c.fillStyle = '#fff'; c.font = '700 84px system-ui,sans-serif'; c.fillText(ip, tx, yb); tx += c.measureText(ip).width;
    c.font = '600 54px system-ui,sans-serif'; c.fillText(dp, tx, yb + 10); tx += c.measureText(dp).width + 18;
    c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '700 70px system-ui,sans-serif'; c.fillText('GRAM', tx, yb);
    if (Gifts.tonUsd > 0) { c.font = '600 44px system-ui,sans-serif'; c.fillStyle = 'rgba(255,255,255,.6)'; c.fillText('$' + nf(total * Gifts.tonUsd, 2), x0, yb + 92); }
    c.fillStyle = '#fff'; c.font = '700 46px ui-monospace,monospace'; c.fillText((U.username ? U.username : (U.first_name || 'User')).toUpperCase(), x0, H - 100);
    rr(c, W - 360, H * 0.37, 150, 112, 22); c.fillStyle = 'rgba(255,255,255,.88)'; c.fill();
    c.strokeStyle = '#555'; c.lineWidth = 6; [[W - 330, H * 0.37 + 22], [W - 290, H * 0.37 + 22], [W - 330, H * 0.37 + 62]].forEach(function (q) { rr(c, q[0], q[1], 28, 28, 7); c.stroke(); });
    imgs.forEach(function (im, i) { if (!im) return; var st = w.stk[i], sz = st.s / 100 * W, cx = st.x / 100 * W, cy = st.y / 100 * H, k = Math.min(sz / im.width, sz / im.height); c.drawImage(im, cx - im.width * k / 2, cy - im.height * k / 2, im.width * k, im.height * k); });
    c.restore();
    c.textAlign = 'right'; c.fillStyle = 'rgba(255,255,255,.5)'; c.font = '700 30px system-ui,sans-serif'; c.fillText('@' + CONFIG.BRAND, W - 60, H - 40);
    closeModal(); showImage(cv, CONFIG.BRAND + '-wallet.png');
  });
}
function paintProfile() {
  var P = S.prof, p = S.p;
  var name = U.first_name || 'User', un = U.username ? '@' + U.username : '@username';
  var av = U.photo_url ? '<img class="av" src="' + esc(U.photo_url) + '">' : '<div class="av">' + esc(name.charAt(0).toUpperCase()) + '</div>';
  var total = 0, wch = 0, cost = 0;
  P.items.forEach(function (it) { var g = giftById(it.gid); if (g) { var v = g.floor * it.qty; total += v; wch += v * g.change; if (it.cost > 0) cost += it.cost * it.qty; } });
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
        gImg(g, null, 'lg sq big') + '<b>' + esc(g.name) + (it.qty > 1 ? ' ×' + it.qty : '') + '</b><span class="p">' + gv(g.floor * it.qty) + '</span>' +
        (it.cost > 0 ? '<small class="' + (g.floor >= it.cost ? 'up-t' : 'down-t') + '">' + (g.floor >= it.cost ? '+' : '') + ((g.floor - it.cost) / it.cost * 100).toFixed(1) + '%</small>' : '') + '</div>';
    }).join('') + '</div>' : '<div class="empty">' + t('empty_assets') + '</div>';
  }
  $('#view').innerHTML =
    '<div class="pf">' + av + '<h2>' + esc(name) + '</h2></div>' + wcardHtml(total, name, un) +
    '<div class="pacts"><button data-act="padd">' + ICON.plus + t('add') + '</button><button class="' + (p.edit ? 'on' : '') + '" data-act="pedit">' + ICON.edit + t('edit') + '</button><button data-act="pmore">' + ICON.more + t('more') + '</button></div>' +
    '<div class="pacts"><button data-act="myalerts">' + ICON.bellI + t('my_alerts') + '</button><button data-act="calc">' + ICON.calc + t('calc') + '</button><button data-act="pcard">' + ICON.imgI + t('card') + '</button></div>' +
    '<div class="card"><div class="kv" style="display:block;padding:12px 0"><b class="u" style="color:var(--accent)">' + esc(un) + '</b><br><small style="color:var(--muted)">' + t('username') + '</small></div>' +
    '<div class="val"><b style="font-size:18px">' + gv(total) + '</b> <span class="' + (pch >= 0 ? 'up-t' : 'down-t') + '">' + (pch > 0 ? '+' : '') + pch.toFixed(2) + '%</span><small>' + t('assets_value') + (cost > 0 ? ' · ' + t('pnl') + ' <span class="' + (total - cost >= 0 ? 'up-t' : 'down-t') + '">' + (total - cost >= 0 ? '+' : '') + gv(total - cost) + '</span>' : '') + '</small>' +
    '<button class="pulse" data-act="ppulse">' + ICON.pulse + '</button></div></div>' +
    '<div class="tabs">' + tabs + '</div>' + body;
  wcBind(); wcFetchBal();
}
function vPortfolio(tok) {
  getGifts().then(function () {
    if (tok !== S.tok) return;
    var items = S.prof.items;
    var total = items.reduce(function (a, it) { return a + itemValue(it); }, 0);
    chartPage({
      img: Gifts.img('Portfolio'), sq: true, title: t('portfolio_chart'), price: gv(total), chg: 0, tfs: GTFS, tf: '1d', fname: 'portfolio',
      shareText: t('portfolio_chart') + ' — ' + '💎 ' + nf(total, 2),
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
    '<div class="frow"><label>' + t('cost_ph') + ' (TON)</label><input id="f_cost" type="number" inputmode="decimal" min="0" step="any"></div>' +
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
    '<div class="srow"><span class="si" style="background:#6d5dfc">' + ICON.moon + '</span><b>' + t('theme') + '</b>' + seg('theme', [['dark', ICON.moon], ['light', ICON.sun], ['gold', '<span style="color:#f5b301;font-weight:800">★</span>']], S.theme) + '</div>' +
    '<div class="srow"><span class="si" style="background:#2f80ed">' + ICON.globe + '</span><b>' + t('language') + '</b>' + seg('lang', [['ru', 'RU'], ['en', 'EN'], ['ar', 'AR']], S.lang) + '</div>' +
    '<div class="srow"><span class="si" style="background:#1fb5b0">' + ICON.dollar + '</span><b>' + t('currency') + '</b>' + seg('cur', [['gem', GEM], ['usd', '$']], S.cur) + '</div>' +
    '<div class="srow" data-act="csToggle" style="cursor:pointer"><span class="si" style="background:#5b5ff0">' + ICON.chartI + '</span><b>' + t('chart_style') + '</b><span style="color:var(--muted)">' + csNames[S.cs] + ' ' + (S.csOpen ? '⌃' : '⌄') + '</span></div>' +
    (S.csOpen ? '<div class="opts">' + ['candles', 'line', 'area'].map(function (k) { return '<button class="' + (S.cs === k ? 'on' : '') + '" data-act="cs" data-v="' + k + '">' + csNames[k] + '</button>'; }).join('') + '</div>' : '') +
    '</div>' +
    '<div class="lbl">' + t('alerts') + '</div>' +
    '<div class="card">' +
    '<div class="srow"><span class="si" style="background:#6d5dfc">' + ICON.brief + '</span><b>' + t('portfolio_summary') + '<small>' + t('portfolio_sub') + '</small></b>' + sw('portfolio') + '</div>' +
    '<div class="srow"><span class="si" style="background:#22c55e">' + ICON.bolt + '</span><b>' + t('pumps') + '<small>' + t('pumps_sub') + '</small></b>' + sw('pumps') + '</div></div>' +
    (workerOn() ? '' : '<div class="note">' + t('needs_server') + '</div>') +
    '<div class="promos">' +
    '<button class="promo" data-act="grp" style="background:linear-gradient(135deg,var(--card),#7c4a1b55)"><span class="si" style="background:#f97316">' + ICON.users + '</span><b>' + t('to_group') + '</b><small>' + t('to_group_sub') + '</small></button>' +
    '<button class="promo" data-act="chn" style="background:linear-gradient(135deg,var(--card),#1b3f7c55)"><span class="si" style="background:#3b82f6">' + ICON.mega + '</span><b>' + t('to_channel') + '</b><small>' + t('to_channel_sub') + '</small></button></div>' +
    '<div style="text-align:center;margin-top:10px"><button class="chip" data-act="diag">' + t('diagnostics') + '</button></div>' +
    '<div class="attr">Data: <a href="https://see.tg" style="color:var(--accent)">see.tg</a><br>' + t('data_credit') + ': TG Gifts (tggifts.com) · Baltic Assets (balticassets.eu) — CC BY 4.0<br>' + t('prices_src') + ': Gift Satellite (@gift_satellite_app)<br>' + t('images_credit') + ': <a href="#" data-act="credit" style="color:var(--accent)">@GiftChanges</a> · wsrv.nl<br>Charts: TradingView Lightweight Charts™ · Crypto: CoinGecko, Binance · ' + esc(CONFIG.BRAND) + ' v' + esc(CONFIG.VERSION) + '</div>';
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
  stk: function (v) { go({ type: 'sticker', id: v }); },
  sttab: function (v) { S.st.tab = v; paintStickers(); },
  stview: function (v) { S.st.map = v === 'map'; paintStickers(); },
  ckind: function (v) { S.c.kind = v; S.c.tab = 'all'; S.c.q = ''; S.c.map = S.c.map; vCrypto(S.tok); },
  nsrc: function (v) { S.c.nsrc = v; var b = $('#news_box'); if (b && S.cache.news) b.innerHTML = newsListHtml(S.cache.news); },
  nopen: function (v) { openExt(v); },
  ntr: function (v) { openExt('https://translate.google.com/translate?sl=auto&tl=ar&u=' + encodeURIComponent(v)); },
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
  dfilter: function (v) { S.df = v; paintDeals($('#glist')); },
  gsort: function () {
    var gs = S.gs, opts = [['floor_d', 's_floor_d'], ['floor_a', 's_floor_a'], ['chg_d', 's_chg_d'], ['chg_a', 's_chg_a'], ['name', 's_name'], ['sales', 's_sales'], ['vol', 's_vol']];
    loadExtra();
    modal('<h3>' + t('sort_filter') + '</h3><div class="opts col">' + opts.map(function (o) { return '<button class="' + (gs.sort === o[0] ? 'on' : '') + '" data-act="gsortset" data-v="' + o[0] + '">' + t(o[1]) + '</button>'; }).join('') + '</div>' +
      '<div class="frow"><label>' + t('p_min') + '</label><input id="gs_min" type="number" inputmode="decimal" min="0" step="any" value="' + esc(gs.min) + '"></div>' +
      '<div class="frow"><label>' + t('p_max') + '</label><input id="gs_max" type="number" inputmode="decimal" min="0" step="any" value="' + esc(gs.max) + '"></div>' +
      '<div class="btns"><button class="btn ghost" data-act="gsreset">' + t('reset') + '</button><button class="btn" data-act="gsapply">' + t('apply') + '</button></div>');
  },
  gsortset: function (v) { S.gs.sort = v; var o = $('#modal .opts'); if (o) o.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === v); }); },
  gsapply: function () { S.gs.min = $('#gs_min').value.trim(); S.gs.max = $('#gs_max').value.trim(); store.set('gs', S.gs); closeModal(); paintGifts(); },
  gsreset: function () { S.gs = { sort: 'floor_d', min: '', max: '' }; store.set('gs', S.gs); closeModal(); paintGifts(); },
  expsend: function () {
    var b = S.expBlob; if (!b) return;
    var rd = new FileReader();
    rd.onload = function () {
      workerPost('/api/photo', { image: rd.result, caption: '@' + CONFIG.BRAND + (S.expName ? ' · ' + S.expName.replace(/\.png$/, '') : '') })
        .then(function (r) { toast(r && r.ok ? t('sent_ok') : t('send_fail')); });
    };
    rd.readAsDataURL(b);
  },
  pan: function () {
    var c = S.cp; if (!c || !c.analyze) return; S.an = S.an || { kind: 'analysis', tf: '4h' };
    var seg = function (act, cur, arr) { return '<div class="seg">' + arr.map(function (x) { return '<button data-act="' + act + '" data-v="' + x[0] + '" class="' + (cur === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>'; };
    modal('<h3>' + t('an_title') + ' · ' + esc(c.analyze.symbol.toUpperCase()) + '</h3>' +
      '<div class="frow"><label>' + t('an_kind') + '</label>' + seg('ankind', S.an.kind, [['analysis', t('an_analysis')], ['signal', t('an_signal')]]) + '</div>' +
      '<div class="frow"><label>' + t('an_tf') + '</label>' + seg('antf', S.an.tf, [['15m', '15m'], ['1h', '1h'], ['4h', '4h'], ['1d', '1d']]) + '</div>' +
      '<p class="muted" style="font-size:12px;margin:8px 0">' + t('an_note') + '</p>' +
      '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button><button class="btn" id="an_go" data-act="ansend">' + t('an_send') + '</button></div>');
  },
  ankind: function (v) { S.an.kind = v; A.pan(); },
  antf: function (v) { S.an.tf = v; A.pan(); },
  ansend: function () {
    var c = S.cp; if (!c || !c.analyze || S.anBusy) return; S.anBusy = true;
    var b = $('#an_go'); if (b) { b.disabled = true; b.textContent = t('an_sending'); }
    workerPost('/api/analyze', { symbol: c.analyze.symbol, tf: S.an.tf, kind: S.an.kind, lang: S.lang }).then(function (r) {
      S.anBusy = false; closeModal();
      toast(r && r.ok ? t('an_ok') : t(r && r.error === 'nopair' ? 'an_nopair' : r && r.error === 'limit' ? 'an_limit' : 'an_fail') + (r && r.detail ? ' [' + r.detail + ']' : (r ? '' : ' [no response]')));
    }, function () { S.anBusy = false; closeModal(); toast(t('an_fail')); });
  },
  palert: function () {
    var c = S.cp, name = c && c.alertName; if (!name) return;
    var coin = !!c.alertCoin, types = coin ? [['below', 'a_below'], ['above', 'a_above']]
      : [['below', 'a_below'], ['above', 'a_above'], ['drop', 'a_drop'], ['rise', 'a_rise'], ['deal', 'a_deal'], ['vol', 'a_vol']];
    S.altype = 'below';
    modal('<h3>' + t('alert_title') + ' · ' + esc(name) + '</h3>' +
      '<div class="frow"><select id="al_op">' + types.map(function (x) { return '<option value="' + x[0] + '">' + t(x[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="frow"><label id="al_lbl">' + (coin ? t('alert_price_usd') : t('a_val_ton')) + '</label><input id="al_p" type="number" inputmode="decimal" min="0" step="any"></div>' +
      '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button><button class="btn" data-act="alertsave">' + t('alert_save') + '</button></div>');
    $('#al_op').addEventListener('change', function () {
      var v = this.value; $('#al_lbl').textContent = coin ? t('alert_price_usd') : (v === 'drop' || v === 'rise' || v === 'deal') ? t('a_val_pct') : v === 'vol' ? t('a_val_n') : t('a_val_ton');
    });
  },
  alertsave: function () {
    var p = parseFloat($('#al_p').value), ty = $('#al_op').value;
    if (!(p > 0)) return;
    var body = S.cp.alertCoin ? { action: 'add', kind: 'coin', coinId: S.cp.alertCoin.id, name: S.cp.alertCoin.name, symbol: S.cp.alertCoin.symbol, price: p, op: ty === 'above' ? '>=' : '<=' }
      : { action: 'add', gift: S.cp.alertName, price: p, op: ty === 'above' ? '>=' : '<=', type: ['drop', 'rise', 'deal', 'vol'].indexOf(ty) >= 0 ? ty : undefined };
    workerPost('/api/alerts', body).then(function (r) { closeModal(); toast(r && r.ok ? t('alert_ok') : t('alert_fail')); });
  },
  // صفحة تنبيهاتي (من الملف الشخصي)
  gcard: function () { if (S.cp && S.cp.card) exportCard(S.cp.card); },
  pcard: function () {
    var rows = S.prof.items.map(function (it) { var g = giftById(it.gid); return g ? [g.name + (it.qty > 1 ? ' ×' + it.qty : ''), g.floor * it.qty] : null; }).filter(Boolean).sort(function (p, q) { return q[1] - p[1]; });
    var total = rows.reduce(function (s, r) { return s + r[1]; }, 0), wch = 0;
    S.prof.items.forEach(function (it) { var g = giftById(it.gid); if (g) wch += g.floor * it.qty * g.change; });
    exportCard({ title: t('portfolio_chart'), sub: '', g: null, price: total, chg: total ? wch / total : 0, rows: rows.slice(0, 6).map(function (r) { return [r[0], '💎 ' + nf(r[1], 2)]; }) });
  },
  calc: function () {
    var r = Gifts.tonUsd || 0;
    modal('<h3>' + t('calc') + '</h3><div class="lbl" style="margin:4px 0">' + t('c_conv') + ' · ' + t('c_rate') + ' 1 TON = $' + nf(r, 3) + '</div>' +
      '<div class="frow" style="display:flex;gap:8px"><input id="cc_ton" type="number" inputmode="decimal" placeholder="TON" step="any"><input id="cc_usd" type="number" inputmode="decimal" placeholder="USD" step="any"></div>' +
      '<div class="lbl" style="margin:14px 0 0">' + t('c_pnl') + '</div>' +
      '<div class="frow" style="display:flex;gap:8px"><div style="flex:1"><label>' + t('c_buy') + '</label><input id="cc_buy" type="number" inputmode="decimal" step="any"></div><div style="flex:1"><label>' + t('c_sell') + '</label><input id="cc_sell" type="number" inputmode="decimal" step="any"></div></div>' +
      '<div class="frow" style="display:flex;gap:8px"><div style="flex:1"><label>' + t('c_qty') + '</label><input id="cc_qty" type="number" min="1" value="1"></div><div style="flex:1"><label>' + t('c_fee')+ '</label><input id="cc_fee" type="number" step="any" value="5"></div></div>' +
      '<div class="card" id="cc_out" style="margin:8px 0"><div class="kv"><span>' + t('c_net') + '</span><b>—</b></div><div class="kv"><span>' + t('c_roi') + '</span><b>—</b></div></div>' +
      '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>');
  },
  myalerts: function () {
    if (!workerOn()) return modal('<h3>' + t('my_alerts') + '</h3><div class="note">' + t('alerts_need_tg') + '</div><div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>');
    modal('<h3>' + t('my_alerts') + '</h3><div id="al_list"><div class="loading">' + t('loading') + '</div></div><div id="sub_list"></div><div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>');
    workerPost('/api/alerts', { action: 'list' }).then(paintAlertList);
    workerPost('/api/subs', { action: 'list' }).then(paintSubList);
  },
  wcedit: function () { S.wcEdit = !S.wcEdit; S.wcSel = S.wcEdit && WC().stk.length ? WC().stk.length - 1 : null; paintProfile(); },
  wctheme: function () {
    bdColors().then(function () {
      var w = WC(), sw = function (act, v, c1, c2, name, on) { return '<button class="wsw' + (on ? ' on' : '') + '" data-act="' + act + '" data-v="' + esc(v) + '"><i style="background:radial-gradient(circle at 38% 40%,' + c2 + ',' + c1 + ' 85%)"></i><small>' + esc(name) + '</small></button>'; };
      var cur = w.c ? (w.bd || '') : '', all = {}; Object.keys(WC_BLK).forEach(function (k) { all[k] = WC_BLK[k].slice().reverse(); }); Object.keys(BDMAP).forEach(function (k) { all[k] = [BDMAP[k][1], BDMAP[k][0]]; });
      var cap = function (s) { return s.replace(/\b\w/g, function (m) { return m.toUpperCase(); }); };
      var bds = Object.keys(all).sort().map(function (k) { return sw('wccolor', 'bd:' + k, all[k][0], all[k][1], cap(k), cur === k); }).join('');
      var ths = Object.keys(WC_TH).map(function (k) { return sw('wccolor', 'th:' + k, WC_TH[k][0], WC_TH[k][1], cap(k), !w.c && w.theme === k); }).join('');
      modal('<h3>' + t('wc_color') + '</h3><div class="wsws">' + ths + bds + '</div><div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>');
    });
  },
  wccolor: function (v) {
    var w = WC(), p = String(v).split(':'), k = p.slice(1).join(':');
    if (p[0] === 'th') { w.theme = k; delete w.c; delete w.bd; }
    else { var pair = BDMAP[k] ? [BDMAP[k][1], BDMAP[k][0]] : WC_BLK[k] ? WC_BLK[k].slice().reverse() : null; if (!pair) return; w.c = [pair[0], pair[1], wcMix(pair[1], 0.4)]; w.bd = k; }
    wcSave(); closeModal(); paintProfile();
  },
  wcadd: function () {
    getGifts().then(function (list) {
      modal('<h3>' + t('wc_sticker') + '</h3><div class="search">' + ICON.search + '<input id="wc_q" placeholder="' + esc(t('search_gifts')) + '"></div><div class="grid wcg" id="wc_g"></div><div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>');
      var paint = function (q) { q = (q || '').toLowerCase(); $('#wc_g').innerHTML = list.filter(function (g) { return !q || g.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 80).map(function (g) { return '<div class="cell" data-act="wcpick" data-v="' + g.id + '">' + gImg(g, null, 'lg sq big') + '<b>' + esc(g.name) + '</b></div>'; }).join(''); };
      paint(''); $('#wc_q').addEventListener('input', function () { paint(this.value); });
    });
  },
  wcpick: function (v) {
    var g = giftById(v); if (!g) return; S.wcG = v;
    modal('<div class="loading">' + t('loading') + '</div>');
    Gifts.models(v).then(function (ms) {
      S.wcMs = ms || [];
      modal('<h3>' + esc(g.name) + ' · ' + t('gs_models') + '</h3><div class="grid wcg"><div class="cell" data-act="wcmodel" data-v="-1">' + gImg(g, null, 'lg sq big') + '<b>' + t('wc_nomodel') + '</b></div>' +
        S.wcMs.slice(0, 120).map(function (m, i) { return '<div class="cell" data-act="wcmodel" data-v="' + i + '">' + gImg(g, m.name, 'lg sq big') + '<b>' + esc(m.name) + '</b></div>'; }).join('') +
        '</div><div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>');
    }).catch(function () { A.wcmodel('-1'); });
  },
  wcmodel: function (v) {
    var w = WC(), i = +v, m = i >= 0 && S.wcMs && S.wcMs[i] ? S.wcMs[i].name : null, n = w.stk.length;
    w.stk.push({ gid: S.wcG, m: m, x: 76 - (n % 3) * 8, y: 66 - (n % 3) * 6, s: 26 }); S.wcSel = n; S.wcEdit = true; wcSave(); closeModal(); paintProfile();
  },
  wcaddr: function () {
    var w = WC();
    modal('<h3>' + t('wc_wallet') + '</h3><div class="seg"><button class="' + (w.src !== 'wallet' ? 'on' : '') + '" data-act="wcsrc" data-v="assets">' + t('wc_src_assets') + '</button><button class="' + (w.src === 'wallet' ? 'on' : '') + '" data-act="wcsrc" data-v="wallet">' + t('wc_src_wallet') + '</button></div>' +
      '<div class="frow"><label>' + t('wc_addr') + '</label><input id="wc_addr" value="' + esc(w.addr || '') + '" placeholder="UQ… / EQ…" autocomplete="off" spellcheck="false"></div>' +
      '<div class="note">' + t('wc_addr_note') + '</div><div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button><button class="btn" data-act="wcaddrsave">' + t('alert_save') + '</button></div>');
  },
  wcsrc: function (v) { var w = WC(); w.src = v; wcSave(); document.querySelectorAll('#modal .seg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); }); },
  wcaddrsave: function () {
    var w = WC(), v = ($('#wc_addr').value || '').trim().replace(/\s+/g, '');
    if (v && !/^[A-Za-z0-9_\-:]{40,70}$/.test(v)) { toast(t('wc_addr_bad')); return; }
    w.addr = v; if (!v) w.src = 'assets'; S.wcBal = null; S.wcBalT = 0; wcSave(); closeModal(); paintProfile();
  },
  wcbig: function () { var w = WC(), st = w.stk[S.wcSel]; if (st) { st.s = Math.min(80, st.s + 5); wcSave(); paintProfile(); } },
  wcsmall: function () { var w = WC(), st = w.stk[S.wcSel]; if (st) { st.s = Math.max(8, st.s - 5); wcSave(); paintProfile(); } },
  wcdel: function () { var w = WC(); if (S.wcSel != null && w.stk[S.wcSel]) { w.stk.splice(S.wcSel, 1); S.wcSel = w.stk.length ? w.stk.length - 1 : null; wcSave(); paintProfile(); } },
  wcsave: function () { wcExport(); },
  subdel: function (v) { workerPost('/api/subs', { action: 'del', index: +v }).then(paintSubList); },
  gssub: function () {
    var s = gsS(); if (!s.col) { toast(t('gs_pick')); return; }
    var f = [s.m.length ? t('gs_models') + ': ' + s.m.join(', ') : '', s.bd.length ? t('gs_bds') + ': ' + s.bd.join(', ') : '', s.sym.length ? t('gs_syms') + ': ' + s.sym.join(', ') : ''].filter(Boolean).join(' · ');
    modal('<h3>' + t('sub_title') + ' · ' + esc(s.col) + '</h3>' + (f ? '<div class="note">' + esc(f) + '</div>' : '') +
      '<div class="frow"><label>' + t('sub_price') + '</label><input id="sub_p" type="number" inputmode="decimal" min="0" step="any"></div>' +
      '<div class="note">' + t('sub_note') + '</div>' +
      '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button><button class="btn" data-act="gssubsave">' + t('alert_save') + '</button></div>');
  },
  gssubsave: function () {
    var s = gsS(), p = parseFloat($('#sub_p').value); if (!(p > 0)) return;
    workerPost('/api/subs', { action: 'add', collection: s.col, models: s.m, backdrops: s.bd, symbols: s.sym, price: p }).then(function (r) {
      closeModal(); toast(r && r.ok ? t('sub_ok') : t(r && r.error === 'limit' ? 'sub_limit' : 'alert_fail'));
    });
  },
  aldel: function (v) { workerPost('/api/alerts', { action: 'del', index: +v }).then(paintAlertList); },
  expshare: function () { try { navigator.share({ files: [S.expFile], title: CONFIG.BRAND }); } catch (e) {} },
  cpmode: function (v) { S.cpState.mode = v; S.cpState.userMode = true; paintCP(); },
  cpcur: function (v) { S.cpState.cur = v; paintCP(); },
  cpstyle: function (v) { S.cpState.style = v; paintCP(); },
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
      var sc = document.querySelector('script[src^="app.js"]'), idata = !!(window.Telegram && Telegram.WebApp && Telegram.WebApp.initData);
      rows = rows.concat([['Worker URL (config.js)', !!CONFIG.WORKER_URL, CONFIG.WORKER_URL ? 'set' : 'empty'], ['Telegram initData', idata, idata ? 'ok' : 'missing — open from the bot menu button'], ['Files', true, sc ? sc.getAttribute('src') : '?']]);
      el.className = '';
      el.innerHTML = rows.map(function (r) {
        return '<div class="kv" style="padding:9px 0;gap:10px"><span style="flex:1">' + esc(r[0]) + '</span><b style="font-size:12px;text-align:end;color:var(--' + (r[1] ? 'up' : 'down') + ')">' + (r[1] ? '✓ ' : '✗ ') + esc(r[2]) + '</b></div>';
      }).join('') + '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button></div>';
    });
  },
  gretry: function () { Gifts.reset(); S.cache.gifts = null; render(); },
  gtab: function (v) { S.g.tab = v; paintGifts(); },
  arb: function () { go({ type: 'arb' }); },
  gsrch: function (v) { gsS().mode = v === 'sales' ? 'sales' : 'list'; go({ type: 'gsearch' }); },
  gsmode: function (v) { gsS().mode = v; paintGsearch(); },
  gsgo: function () {
    var s = gsS(); if (!s.col) { toast(t('gs_pick')); return; } if (!workerOn()) { toast(t('gs_need_worker')); return; }
    if (s.mode === 'sales') { gsFetchSales(0); return; }
    s.busy = true; s.err = ''; paintGsRes();
    workerPost('/api/gs', { kind: 'search', collection: s.col, models: s.m, backdrops: s.bd, symbols: s.sym, number: s.num }).then(function (r) {
      s.busy = false; if (!r || !r.ok) { s.err = t('gs_err') + (r && r.error ? ' (' + r.error + ')' : ''); s.res = null; } else { s.res = r.data; var ek = Object.keys(r.errs || {}); if (ek.length && ek.length === Object.keys(r.data).length) { s.err = t('gs_err') + ' (' + r.errs[ek[0]] + ')'; s.res = null; } } paintGsRes();
    });
  },
  gsmore: function () { gsFetchSales(gsS().page); },
  gspick: function (v, el) {
    if (el.classList.contains('dis')) return;
    var ttl = { col: t('gs_gift'), m: t('gs_models'), bd: t('gs_bds'), sym: t('gs_syms') }[v];
    modal('<h3>' + esc(ttl) + '</h3><div class="search"><input id="gsq" placeholder="' + esc(t('adv_search')) + '" autocomplete="off"></div><div class="gspl">' + gsPickRows(v) + '</div>' + (v === 'col' ? '' : '<div class="btns"><button class="btn" data-act="gspdone">' + t('done') + '</button></div>'));
    applyBd();
  },
  gspsel: function (v, el) {
    var s = gsS(), n = el.dataset.n || '';
    if (v !== 'col') { // اختيار متعدد: بنفضل في المودال ونحدّث العلامات
      if (!n) s[v] = []; else { var ix = s[v].indexOf(n); if (ix >= 0) s[v].splice(ix, 1); else s[v].push(n); }
      var gl = document.querySelector('#modal .gspl'); if (gl) { gl.innerHTML = gsPickRows(v); applyBd(); var qi = $('#gsq'); if (qi && qi.value) qi.dispatchEvent(new Event('input', { bubbles: true })); }
      paintGsearch(); return;
    }
    closeModal();
    s.col = n; s.m = []; s.bd = []; s.sym = []; s.attrs = null; s.res = null; s.rows = []; s.page = 0; paintGsearch(); gsLoadAttrs();
  },
  gspdone: function () { closeModal(); paintGsearch(); },
  gsopen: function (v) { if (!v) return; var u = 'https://t.me/nft/' + v; try { Telegram.WebApp.openTelegramLink(u); } catch (e) { window.open(u, '_blank'); } },
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
    S.prof.items.push({ uid: 'i' + Date.now() + Math.floor(Math.random() * 1000), gid: $('#f_g').value, num: n, qty: q, col: cEl ? cEl.value : '', cost: parseFloat($('#f_cost').value) || 0 });
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
  mcur: function (v) { S.mcur = v; store.set('mcur', v); if (S.tab === 'crypto') paintCryptoList(); else paintGiftList(); },
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
    else if (S.tab === 'stickers' && !S.view) { S.st.q = e.target.value; paintStickerList(); }
  } else if (e.target.id === 'pq') paintPicker(e.target.value);
  else if (e.target.id === 'gsq') { var q = e.target.value.toLowerCase().trim(); document.querySelectorAll('#modal .gspr[data-q]').forEach(function (b) { b.style.display = !q || b.dataset.q.indexOf(q) >= 0 ? '' : 'none'; }); }
  else if (e.target.id === 'arb_fee' || e.target.id === 'arb_min') { var as = arbS(); as.fee = $('#arb_fee').value; as.min = $('#arb_min').value; store.set('arb', as); var al = $('#arb_list'); if (al) al.innerHTML = arbListHtml(); }
  else if (e.target.id === 'gs_n') gsS().num = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
  else if (e.target.id && e.target.id.indexOf('cc_') === 0) calcUpdate(e.target.id);
});
document.addEventListener('change', function (e) {
  if (e.target.id === 'metric') { S.g.metric = e.target.value; paintGiftList(); }
  else if (e.target.id === 'cmetric') { S.c.metric = e.target.value; paintCryptoList(); }
  else if (e.target.id === 'gtop') { S.g.top = +e.target.value; paintGiftList(); }
  else if (e.target.id === 'stmetric') { S.st.metric = e.target.value; paintStickerList(); }
  else if (e.target.id === 'sttop') { S.st.top = +e.target.value; paintStickerList(); }
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
    S.expFile = file; S.expUrl = url; S.expName = fname; S.expBlob = b;
    modal('<img class="exp" src="' + url + '" alt=""><div class="note" style="text-align:center">' + t('long_press') + '</div>' +
      '<div class="btns"><button class="btn ghost" data-act="mclose">' + t('done') + '</button>' +
      (file && navigator.canShare && navigator.canShare({ files: [file] }) ? '<button class="btn ghost" data-act="expshare">' + t('share_img') + '</button>' : '') +
      (workerOn() ? '<button class="btn ghost" data-act="expsend">' + t('send_chat') + '</button>' : '') +
      '<button class="btn" data-act="expsave">' + t('save_img') + '</button></div>');
  }, 'image/png');
}
function exportCard(info) { // كارت مشاركة 1080×1350
  modal('<div class="loading">' + t('generating') + '</div>');
  var urls = info.g ? Gifts.exportImgs(info.g, info.model || null) : [];
  loadImgTry(urls).then(function (im) {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), th = S.theme, light = th === 'light';
    var gr = c.createLinearGradient(0, 0, 0, H);
    if (th === 'gold') { gr.addColorStop(0, '#1d1404'); gr.addColorStop(1, '#4a3208'); } else if (light) { gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e9edf5'); } else { gr.addColorStop(0, '#0b0b0d'); gr.addColorStop(1, '#1a1f2e'); }
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    var fg = light ? '#111' : '#fff', mu = light ? '#666' : (th === 'gold' ? '#c9a95a' : '#9aa0aa'), acc = th === 'gold' ? '#f5b301' : '#3b82f6';
    c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = acc; c.font = '800 46px ' + FONT; drawBrand(c, 56, 70, 46);
    c.textAlign = 'right'; c.fillStyle = mu; c.font = '600 28px ' + FONT; c.fillText(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), W - 56, 70);
    var y = 130;
    if (im) { c.save(); rr(c, W / 2 - 210, y, 420, 420, 70); c.clip(); c.drawImage(im, W / 2 - 210, y, 420, 420); c.restore(); }
    y += 420 + 60; c.textAlign = 'center'; c.fillStyle = fg; c.font = '800 64px ' + FONT; c.fillText(fitText(c, info.title, W - 120), W / 2, y);
    if (info.sub) { y += 58; c.fillStyle = mu; c.font = '600 40px ' + FONT; c.fillText(fitText(c, info.sub, W - 120), W / 2, y); }
    if (info.price != null) {
      y += 90; c.fillStyle = fg; c.font = '800 84px ' + FONT; c.fillText('💎 ' + nf(info.price, 2), W / 2, y);
      y += 62; c.fillStyle = mu; c.font = '600 36px ' + FONT; c.fillText('$' + nf(info.price * Gifts.tonUsd, 2), W / 2, y);
    }
    if (info.chg != null) {
      y += 70; var up = info.chg >= 0, txt = (up ? '+' : '') + info.chg.toFixed(2) + '%';
      c.font = '800 36px ' + FONT; var tw = c.measureText(txt).width + 50; c.fillStyle = up ? '#22c55e' : '#ef4444'; rr(c, W / 2 - tw / 2, y - 30, tw, 60, 30); c.fill();
      c.fillStyle = '#fff'; c.fillText(txt, W / 2, y + 2);
    }
    y += 70;
    (info.rows || []).slice(0, 6).forEach(function (r) {
      c.fillStyle = light ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.07)'; rr(c, 80, y - 28, W - 160, 56, 16); c.fill();
      c.textAlign = 'left'; c.fillStyle = mu; c.font = '600 30px ' + FONT; c.fillText(r[0], 104, y + 1);
      c.textAlign = 'right'; c.fillStyle = fg; c.font = '700 30px ' + FONT; c.fillText(r[1], W - 104, y + 1); y += 66;
    });
    c.textAlign = 'center'; c.fillStyle = mu; c.font = '600 28px ' + FONT; c.fillText('t.me/' + CONFIG.BOT_USERNAME, W / 2, H - 50);
    showImage(cv, CONFIG.BRAND + '-card.png');
  });
}
function exportMap() {
  var d = S.tmData; if (!d) return;
  modal('<div class="loading">' + t('generating') + '</div>');
  var tiles = tmTiles(d.items, d.W, d.H);
  var k = Math.min(1600 / d.W, 7600 / d.H), head = Math.round(50 * k * 0.9), gap = Math.max(1.5, k * 0.8), foot = 0;
  var W = Math.round(d.W * k), H = Math.round(d.H * k) + head + foot;
  Promise.all(tiles.map(function (n) { return n.showIcon ? iconFor(n) : Promise.resolve(null); })).then(function (imgs) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var c = cv.getContext('2d'), dark = S.theme !== 'light';
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
          if (q.t === 'p' && n.gem) { var ds = fs * 0.8, tw = c.measureText(txt).width, sx = cx - (tw + ds * 1.2) / 2; if (GEMIMG.complete && GEMIMG.naturalWidth) { c.save(); c.beginPath(); c.arc(sx + ds / 2, cy + q.h / 2, ds / 2, 0, 6.2832); c.clip(); c.drawImage(GEMIMG, sx, cy + q.h / 2 - ds / 2, ds, ds); c.restore(); } else { c.beginPath(); c.moveTo(sx + ds / 2, cy + q.h / 2 - ds / 2); c.lineTo(sx + ds, cy + q.h / 2 - ds * 0.1); c.lineTo(sx + ds / 2, cy + q.h / 2 + ds / 2); c.lineTo(sx, cy + q.h / 2 - ds * 0.1); c.closePath(); c.fill(); } c.textAlign = 'left'; c.fillText(txt, sx + ds * 1.2, cy + q.h / 2); c.textAlign = 'center'; }
          else c.fillText(fitText(c, txt, w * 0.94), cx, cy + q.h / 2);
          c.shadowBlur = 0;
        }
        cy += q.h + g2;
      });
      c.restore();
    });
    var mk = tmMark(tiles), mx = mk ? mk.x * k : 8 * k, my = mk ? head + (mk.y + mk.fs / 2) * k : H - 12 * k;
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = '800 ' + Math.round((mk ? mk.fs : 14) * k) + 'px ' + FONT;
    c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 4 * k; c.fillStyle = 'rgba(255,255,255,.92)';
    drawBrand(c, mx, my, Math.round((mk ? mk.fs : 14) * k)); c.shadowBlur = 0;
    showImage(cv, CONFIG.BRAND + '-map.png');
  });
}
function exportChart() {
  var data = S.lastData, cfg = S.cp, st = S.cpState;
  if (!data || !data.length || !cfg) return;
  modal('<div class="loading">' + t('generating') + '</div>');
  var W = 1280, H = 760, dark = S.theme !== 'light';
  var div = document.createElement('div'); div.style.cssText = 'position:fixed;left:-99999px;top:0;width:' + W + 'px;height:' + H + 'px';
  document.body.appendChild(div);
  var chart = LightweightCharts.createChart(div, {
    width: W, height: H,
    layout: { background: { color: dark ? '#0b0b0d' : '#ffffff' }, textColor: dark ? '#d0d3d8' : '#333', fontSize: 24 },
    grid: { vertLines: { color: dark ? '#26262b' : '#e2e2ea' }, horzLines: { color: dark ? '#26262b' : '#e2e2ea' } },
    rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: true },
    watermark: { visible: false }
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
      c.save(); c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.12)'; c.font = '800 ' + 70 * sc + 'px ' + FONT;
      var bw = 70 * sc * 1.3 + c.measureText('@' + CONFIG.BRAND).width; drawBrand(c, (cv.width - bw) / 2, head + shot.height / 2, 70 * sc, 0.18); c.restore();
      showImage(cv, CONFIG.BRAND + '-' + (cfg.fname || 'chart') + '.png');
    });
  });
}

/* ---------- فيديو افتتاحي (اختياري): ضع الملف intro.mp4 في الريبو. لو مش موجود مش بيظهر حاجة ---------- */
function intro() {
  var src = CONFIG.INTRO; if (!src) return;
  try { if (sessionStorage.getItem('intro_seen')) return; } catch (e) {}
  var box = document.createElement('div'); box.id = 'intro';
  box.innerHTML = '<video muted playsinline webkit-playsinline autoplay preload="auto"></video>';
  var v = box.querySelector('video'), done = false;
  function close() { if (done) return; done = true; try { sessionStorage.setItem('intro_seen', '1'); } catch (e) {} box.classList.add('out'); setTimeout(function () { box.remove(); }, 350); }
  v.addEventListener('error', function () { done = true; box.remove(); });
  v.addEventListener('ended', close);
  v.addEventListener('playing', function () { box.classList.add('on'); });
  setTimeout(function () { if (!box.classList.contains('on')) { done = true; box.remove(); } }, 4000); // ما بدأش في 4 ثواني: نتجاهله
  setTimeout(close, 12000);
  v.src = src; document.body.appendChild(box);
  var p = v.play(); if (p && p.catch) p.catch(function () { done = true; box.remove(); });
}

/* ---------- boot ---------- */
applyTheme();
try { if (tg) { tg.ready(); tg.expand(); tg.BackButton.onClick(back); } } catch (e) {}
render();
intro();
// رابط من إشعار الجروب: startapp=g_<اسم الهدية>
try {
  var sp = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
  if (/^g_/.test(sp)) { var gn = decodeURIComponent(sp.slice(2)); S.tab = 'gifts'; render(); getGifts().then(function () { openGiftByName(gn); }); }
} catch (e) {}
// تحديث تلقائي لقائمة العملات كل دقيقة
setInterval(function () {
  if (document.hidden || S.tab !== 'crypto' || S.view || !$('#list')) return;
  Crypto.markets().then(function (c) { S.cache.coins = c; S.cache.ct = Date.now(); setTon(); if (S.tab === 'crypto' && !S.view && $('#list')) paintCryptoList(); }).catch(function () {});
}, 60000);
// أسعار العملات اللحظية كل 5 ثواني (Binance سبوت من المتصفح). لو مش متاح بنكمّل على تحديث الدقيقة
var liveBusy = false, liveFails = 0;
setInterval(function () {
  if (document.hidden || liveBusy || liveFails > 4 || S.tab !== 'crypto' || S.c.kind === 'stock') return;
  var coins = S.cache.coins; if (!coins || !coins.length) return;
  var cp = S.cp && S.cp.analyze ? S.cp.analyze.symbol.toUpperCase() : null;
  if (S.view && !cp) return; if (!S.view && !$('#list')) return;
  var syms = coins.slice(0, 100).map(function (x) { return x.symbol.toUpperCase() + 'USDT'; });
  if (cp && syms.indexOf(cp + 'USDT') < 0) syms.push(cp + 'USDT');
  liveBusy = true;
  fetch('https://data-api.binance.vision/api/v3/ticker/24hr?symbols=' + encodeURIComponent(JSON.stringify(syms)) + '&type=MINI')
    .then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (arr) {
      liveFails = 0; var by = {}; arr.forEach(function (x) { by[x.symbol] = x; });
      coins.forEach(function (c) { var b = by[c.symbol.toUpperCase() + 'USDT']; if (b && +b.lastPrice > 0) { c.current_price = +b.lastPrice; var o = +b.openPrice; if (o > 0) c.price_change_percentage_24h = (c.current_price - o) / o * 100; } });
      if (S.view) {
        var b = by[cp + 'USDT']; if (!b) return; var p = +b.lastPrice, el = document.querySelector('.dhead .dp'); if (el && p > 0) el.textContent = '$' + fmtPrice(p);
        var d = S.lastData, s = S.series; if (d && d.length && s && p > 0) { var l = d[d.length - 1]; try { if (l.open != null) { l.close = p; l.high = Math.max(l.high, p); l.low = Math.min(l.low, p); s.update({ time: l.time, open: l.open, high: l.high, low: l.low, close: p }); } else s.update({ time: l.time, value: p }); } catch (e) {} }
      } else if (!S.c.map) paintCryptoList();
    }).catch(function () { liveFails++; }).then(function () { liveBusy = false; });
}, 5000);
})();
