'use strict';

/* ---------- Stammdaten ---------- */
const STORE_KEY = 'finanztracker.v1';
const CATS = {
  out: [
    ['lebensmittel', '🛒', 'Lebensmittel'],
    ['restaurant', '🍽️', 'Restaurant & Café'],
    ['mobilitaet', '🚆', 'Mobilität'],
    ['wohnen', '🏠', 'Wohnen'],
    ['einkaeufe', '🛍️', 'Einkäufe'],
    ['drogerie', '💊', 'Drogerie & Gesundheit'],
    ['freizeit', '🎟️', 'Freizeit'],
    ['abos', '🔁', 'Abos & Verträge'],
    ['sonstiges', '📦', 'Sonstiges'],
  ],
  in: [
    ['gehalt', '💼', 'Gehalt'],
    ['einnahme', '➕', 'Sonstige Einnahmen'],
  ],
};
const CAT_INFO = Object.fromEntries([...CATS.out, ...CATS.in].map(([id, icon, name]) => [id, { icon, name }]));
const KEYWORDS = {
  lebensmittel: ['rewe', 'edeka', 'aldi', 'lidl', 'netto', 'penny', 'kaufland', 'tegut', 'denns', 'alnatura', 'bäcker', 'baecker', 'supermarkt'],
  restaurant: ['restaurant', 'cafe', 'café', 'mcdonald', 'burger', 'pizza', 'starbucks', 'lieferando', 'subway', 'kfc', 'imbiss', 'bistro'],
  mobilitaet: ['db ', 'bahn', 'shell', 'aral', 'esso', 'total', 'jet ', 'tankstelle', 'uber', 'bolt', 'tier', 'flixbus', 'parkhaus', 'bvg', 'mvg', 'hvv', 'kvb'],
  wohnen: ['miete', 'stadtwerke', 'strom', 'ikea', 'obi', 'bauhaus', 'hornbach', 'hausverwaltung'],
  einkaeufe: ['amazon', 'zalando', 'h&m', 'zara', 'mediamarkt', 'media markt', 'saturn', 'otto', 'ebay', 'decathlon', 'tk maxx'],
  drogerie: ['dm-', 'dm ', 'rossmann', 'müller', 'apotheke', 'arzt', 'praxis'],
  freizeit: ['kino', 'cinema', 'steam', 'playstation', 'nintendo', 'ticket', 'eventim', 'fitness', 'mcfit', 'museum'],
  abos: ['netflix', 'spotify', 'disney', 'apple.com', 'icloud', 'telekom', 'vodafone', 'o2', 'rundfunk', 'versicherung', 'youtube'],
  gehalt: ['gehalt', 'lohn', 'bezüge', 'bezuege'],
};

/* ---------- Zustand ---------- */
let state = load();
let month = todayISO().slice(0, 7);
let view = 'overview';
let editingId = null;

function emptyState() { return { v: 1, tx: [], budgets: {}, rules: {}, lastBackup: null }; }
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.tx)) return Object.assign(emptyState(), s);
  } catch (e) { /* defekter oder fehlender Speicher: leer starten */ }
  return emptyState();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Speichern fehlgeschlagen – Browserspeicher voll oder gesperrt.'); }
}

/* ---------- Helfer ---------- */
const $ = (id) => document.getElementById(id);
const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const fmt = (cents) => eur.format(cents / 100);
function todayISO() { return isoOf(new Date()); }
function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function shiftMonth(m, by) { const [y, mo] = m.split('-').map(Number); return isoOf(new Date(y, mo - 1 + by, 1)).slice(0, 7); }
function monthName(m, opts) { const [y, mo] = m.split('-').map(Number); return new Date(y, mo - 1, 1).toLocaleDateString('de-DE', opts); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
}

/** "12,34 €", "1.234,56", "€12.34", "-5" → Cent (mit Vorzeichen) oder null */
function parseAmount(raw) {
  let s = String(raw == null ? '' : raw).replace(/[^\d,.\-]/g, '');
  const neg = s.includes('-');
  s = s.replace(/-/g, '');
  if (!/\d/.test(s)) return null;
  const dec = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  let whole = s, frac = '';
  if (dec >= 0 && s.length - dec - 1 <= 2) { whole = s.slice(0, dec); frac = s.slice(dec + 1); }
  const cents = Number(whole.replace(/[.,]/g, '') || '0') * 100 + Number((frac + '00').slice(0, 2));
  return Number.isFinite(cents) ? (neg ? -cents : cents) : null;
}

function guessCat(note, type) {
  const n = (note || '').toLowerCase().trim();
  const learned = state.rules[n];
  if (learned && CATS[type].some((c) => c[0] === learned)) return learned;
  for (const [id] of CATS[type]) {
    if ((KEYWORDS[id] || []).some((k) => (n + ' ').includes(k))) return id;
  }
  return type === 'out' ? 'sonstiges' : 'einnahme';
}

let toastTimer;
function toast(text, actionLabel, action) {
  const t = $('toast');
  t.replaceChildren(text);
  if (actionLabel) t.append(h('button', { type: 'button', onclick: () => { t.hidden = true; action(); } }, actionLabel));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, actionLabel ? 8000 : 4000);
}

/* ---------- Darstellung ---------- */
function render() {
  for (const v of ['overview', 'list', 'settings']) $('view-' + v).hidden = v !== view;
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $('monthNav').hidden = view === 'settings';
  $('fab').hidden = view === 'settings';
  $('monthLabel').textContent = monthName(month, { month: 'long', year: 'numeric' });
  if (view === 'overview') renderOverview();
  if (view === 'list') renderList();
  if (view === 'settings') renderSettings();
}

function sums(m) {
  let out = 0, inc = 0; const byCat = {};
  for (const t of state.tx) {
    if (!t.date.startsWith(m)) continue;
    if (t.type === 'out') { out += t.amount; byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; } else inc += t.amount;
  }
  return { out, inc, byCat };
}

function renderOverview() {
  const s = sums(month);
  $('sumOut').textContent = fmt(s.out);
  $('sumIn').textContent = fmt(s.inc);
  const bal = $('sumBal');
  bal.textContent = fmt(s.inc - s.out);
  bal.className = s.inc - s.out < 0 ? 'neg' : 'pos';

  const rows = CATS.out
    .map(([id]) => ({ id, spent: s.byCat[id] || 0, budget: state.budgets[id] || 0 }))
    .filter((r) => r.spent || r.budget)
    .sort((a, b) => b.spent - a.spent);
  const max = Math.max(1, ...rows.map((r) => r.spent));
  $('catList').replaceChildren(...(rows.length ? rows.map((r) => {
    const over = r.budget && r.spent > r.budget;
    const share = r.budget ? Math.min(1, r.spent / r.budget) : r.spent / max;
    return h('div', { class: 'cat' },
      h('div', { class: 'cat-head' },
        h('span', {}, `${CAT_INFO[r.id].icon} ${CAT_INFO[r.id].name}`),
        h('span', { class: over ? 'neg' : '' }, fmt(r.spent), r.budget ? h('small', {}, ` von ${fmt(r.budget)}`) : null)),
      h('div', { class: 'bar' }, h('i', { class: over ? 'over' : '', style: null, 'data-w': String(Math.round(share * 100)) })));
  }) : [h('p', { class: 'empty' }, 'Noch keine Ausgaben in diesem Monat.')]));
  // Breiten per CSSOM setzen (Inline-style-Attribute sind durch die CSP gesperrt)
  $('catList').querySelectorAll('.bar i').forEach((i) => { i.style.width = i.dataset.w + '%'; });

  const months = [-5, -4, -3, -2, -1, 0].map((d) => shiftMonth(month, d));
  const vals = months.map((m) => sums(m).out);
  const top = Math.max(1, ...vals);
  $('trend').replaceChildren(...months.map((m, i) => {
    const stick = h('span', { class: 'stick' });
    stick.style.height = Math.round((vals[i] / top) * 100) + '%';
    return h('button', { type: 'button', class: 'col' + (m === month ? ' current' : ''), 'aria-label': `${monthName(m, { month: 'long', year: 'numeric' })}: ${fmt(vals[i])}`, onclick: () => { month = m; render(); } },
      h('span', { class: 'val' }, vals[i] ? Math.round(vals[i] / 100) + ' €' : ''),
      stick,
      h('span', { class: 'lbl' }, monthName(m, { month: 'short' })));
  }));
}

function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const items = state.tx
    .filter((t) => q ? ((t.note || '') + ' ' + CAT_INFO[t.cat].name).toLowerCase().includes(q) : t.date.startsWith(month))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
  const out = [];
  let day = '';
  for (const t of items) {
    if (t.date !== day) {
      day = t.date;
      const [y, m, d] = day.split('-').map(Number);
      out.push(h('div', { class: 'day' }, new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: q ? 'numeric' : undefined })));
    }
    out.push(h('button', { type: 'button', class: 'tx', onclick: () => openDialog(t) },
      h('span', { class: 'ico' }, CAT_INFO[t.cat].icon),
      h('span', { class: 'mid' }, h('b', {}, t.note || CAT_INFO[t.cat].name), h('small', {}, CAT_INFO[t.cat].name + (t.src === 'applepay' ? ' · Apple Pay' : ''))),
      h('span', { class: 'amt ' + (t.type === 'in' ? 'pos' : '') }, (t.type === 'in' ? '+' : '−') + fmt(t.amount))));
  }
  $('txList').replaceChildren(...(out.length ? out : [h('p', { class: 'empty' }, q ? 'Keine Treffer.' : 'Keine Buchungen in diesem Monat. Tippe auf +, um eine anzulegen.')]));
}

function renderSettings() {
  const base = location.origin + location.pathname;
  $('quickUrl').textContent = `${base}?betrag=[Betrag]&haendler=[Händler]`;
  $('budgets').replaceChildren(...CATS.out.map(([id, icon, name]) => h('label', { class: 'budget' },
    h('span', {}, `${icon} ${name}`),
    h('input', {
      inputmode: 'decimal', placeholder: '— €', 'aria-label': `Budget ${name}`,
      value: state.budgets[id] ? String(state.budgets[id] / 100).replace('.', ',') : null,
      onchange: (e) => {
        const c = parseAmount(e.target.value);
        if (c && c > 0) state.budgets[id] = c; else { delete state.budgets[id]; e.target.value = ''; }
        save();
      },
    }))));
  $('backupInfo').textContent = `${state.tx.length} Buchungen gespeichert. ` +
    (state.lastBackup ? `Letztes Backup: ${new Date(state.lastBackup).toLocaleDateString('de-DE')}.` : 'Noch kein Backup erstellt.');
}

/* ---------- Buchung anlegen / bearbeiten ---------- */
const form = $('txForm');
function fillCats(type, selected) {
  form.cat.replaceChildren(...CATS[type].map(([id, icon, name]) => h('option', { value: id }, `${icon} ${name}`)));
  if (selected && CATS[type].some((c) => c[0] === selected)) form.cat.value = selected;
}
function openDialog(t) {
  editingId = t ? t.id : null;
  $('dlgTitle').textContent = t ? 'Buchung bearbeiten' : 'Neue Buchung';
  $('dlgDelete').hidden = !t;
  form.type.value = t ? t.type : 'out';
  form.amount.value = t ? (t.amount / 100).toFixed(2).replace('.', ',') : '';
  form.note.value = t ? t.note || '' : '';
  form.date.value = t ? t.date : (month === todayISO().slice(0, 7) ? todayISO() : month + '-01');
  fillCats(form.type.value, t && t.cat);
  form.dataset.catTouched = t ? '1' : '';
  $('dlg').showModal();
  if (!t) form.amount.focus();
}
form.addEventListener('change', (e) => {
  if (e.target.name === 'type') { fillCats(form.type.value); form.cat.value = guessCat(form.note.value, form.type.value); }
  if (e.target.name === 'cat') form.dataset.catTouched = '1';
});
form.note.addEventListener('input', () => { if (!form.dataset.catTouched) form.cat.value = guessCat(form.note.value, form.type.value); });
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const cents = parseAmount(form.amount.value);
  if (!cents || cents <= 0) { form.amount.setCustomValidity('Bitte einen Betrag größer 0 eingeben.'); form.amount.reportValidity(); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.value)) return;
  const data = { type: form.type.value, amount: cents, cat: form.cat.value, note: form.note.value.trim(), date: form.date.value };
  const existing = state.tx.find((t) => t.id === editingId);
  if (existing) Object.assign(existing, data); else state.tx.push({ id: uid(), src: 'manual', ...data });
  if (data.note) state.rules[data.note.toLowerCase()] = data.cat; // Händler → Kategorie merken
  save();
  month = data.date.slice(0, 7);
  $('dlg').close();
  render();
});
form.amount.addEventListener('input', () => form.amount.setCustomValidity(''));
$('dlgCancel').addEventListener('click', () => $('dlg').close());
$('dlgDelete').addEventListener('click', () => {
  const idx = state.tx.findIndex((t) => t.id === editingId);
  if (idx < 0) return;
  const [removed] = state.tx.splice(idx, 1);
  save(); $('dlg').close(); render();
  toast('Buchung gelöscht.', 'Rückgängig', () => { state.tx.push(removed); save(); render(); });
});

/* ---------- Schnellerfassung per Adresse (Apple-Pay-Automation) ---------- */
function quickCapture() {
  const p = new URLSearchParams(location.search);
  const rawAmount = p.get('betrag') || p.get('amount');
  if (rawAmount == null) return;
  history.replaceState(null, '', location.pathname); // verhindert Doppelbuchung beim Neuladen
  const cents = parseAmount(rawAmount);
  if (!cents) { toast('Betrag aus der Automation nicht lesbar.'); return; }
  const note = (p.get('haendler') || p.get('merchant') || '').trim().slice(0, 120);
  const type = cents < 0 ? 'in' : 'out';
  const t = { id: uid(), src: 'applepay', type, amount: Math.abs(cents), cat: guessCat(note, type), note, date: todayISO() };
  state.tx.push(t);
  save();
  month = t.date.slice(0, 7);
  view = 'list';
  toast(`${fmt(t.amount)}${note ? ' bei ' + note : ''} erfasst.`, 'Ändern', () => openDialog(t));
}

/* ---------- Export / Import ---------- */
function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
$('exportJson').addEventListener('click', () => {
  state.lastBackup = new Date().toISOString(); save();
  download(`finanztracker-backup-${todayISO()}.json`, JSON.stringify(state, null, 1), 'application/json');
  renderSettings();
});
$('exportCsv').addEventListener('click', () => {
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  const lines = ['Datum;Art;Betrag;Kategorie;Notiz', ...[...state.tx].sort((a, b) => a.date.localeCompare(b.date)).map((t) =>
    [t.date, t.type === 'in' ? 'Einnahme' : 'Ausgabe', ((t.type === 'in' ? 1 : -1) * t.amount / 100).toFixed(2).replace('.', ','), q(CAT_INFO[t.cat].name), q(t.note || '')].join(';'))];
  download(`finanztracker-${todayISO()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv');
});
$('importJsonBtn').addEventListener('click', () => $('importJson').click());
$('importCsvBtn').addEventListener('click', () => $('importCsv').click());

function validTx(t) {
  return t && typeof t.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number.isInteger(t.amount) && t.amount > 0 &&
    (t.type === 'in' || t.type === 'out') && CATS[t.type].some((c) => c[0] === t.cat);
}
$('importJson').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!s || !Array.isArray(s.tx) || !s.tx.every(validTx)) throw new Error('format');
    if (!confirm(`Backup mit ${s.tx.length} Buchungen einspielen? Die aktuellen ${state.tx.length} Buchungen werden ersetzt.`)) return;
    state = Object.assign(emptyState(), { tx: s.tx, budgets: s.budgets || {}, rules: s.rules || {}, lastBackup: s.lastBackup || null });
    save(); render(); toast('Backup eingespielt.');
  } catch (err) { toast('Diese Datei ist kein gültiges Finanztracker-Backup.'); }
});

function parseCsv(text) {
  const head = text.split(/\r?\n/).slice(0, 40).join('\n');
  const delim = [';', '\t', ','].map((d) => [d, head.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function parseDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})$/);
  if (!m) return null;
  const y = m[3].length === 2 ? '20' + m[3] : m[3];
  if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null;
  return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
function daysBetween(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }

function csvToTx(text) {
  const rows = parseCsv(text);
  const isDate = (c) => /buchungstag|buchungsdatum|datum|date|valuta|wertstellung/i.test(c);
  const isAmount = (c) => /betrag|umsatz|amount/i.test(c) && !/währung|waehrung|currency/i.test(c);
  const hi = rows.findIndex((r) => r.some(isDate) && r.some(isAmount));
  if (hi < 0) return null;
  const head = rows[hi].map((c) => c.trim());
  const col = (...res) => { for (const re of res) { const i = head.findIndex((c) => re.test(c)); if (i >= 0) return i; } return -1; };
  const cDate = col(/buchungstag|buchungsdatum/i, /datum|date/i, /valuta|wertstellung/i);
  const cAmt = head.findIndex(isAmount);
  const cName = col(/empf[äa]nger|beg[üu]nstigter|zahlungspflichtiger|zahlungsempf|auftraggeber|h[äa]ndler|merchant/i, /^name/i, /beschreibung|description/i);
  const cText = col(/verwendungszweck|purpose/i, /buchungstext/i);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const date = parseDate(r[cDate]); const cents = parseAmount(r[cAmt]);
    if (!date || !cents) continue;
    const note = ((cName >= 0 && r[cName]) || (cText >= 0 && r[cText]) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const type = cents < 0 ? 'out' : 'in';
    out.push({ id: uid(), src: 'csv', type, amount: Math.abs(cents), cat: guessCat(note, type), note, date });
  }
  return out;
}

$('importCsv').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  const buf = await file.arrayBuffer();
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (err) { text = new TextDecoder('windows-1252').decode(buf); }
  const found = csvToTx(text);
  if (!found) { toast('Keine Spalten für Datum und Betrag gefunden.'); return; }
  // Duplikate: gleiche CSV-Zeile schon importiert, oder dieselbe Zahlung bereits von Hand / per Apple Pay erfasst
  // (gleicher Betrag, bis zu 4 Tage vor dem Buchungsdatum der Bank).
  const pool = state.tx.map((t) => ({ t, used: false }));
  const fresh = [];
  for (const n of found) {
    const hit = pool.find((p) => !p.used && p.t.type === n.type && p.t.amount === n.amount &&
      (p.t.src === 'csv' ? p.t.date === n.date && p.t.note === n.note : daysBetween(p.t.date, n.date) >= 0 && daysBetween(p.t.date, n.date) <= 4));
    if (hit) hit.used = true; else fresh.push(n);
  }
  const dupes = found.length - fresh.length;
  if (!fresh.length) { toast(`Nichts Neues: alle ${found.length} Buchungen sind bereits vorhanden.`); return; }
  if (!confirm(`${fresh.length} neue Buchungen importieren?` + (dupes ? ` (${dupes} bereits vorhandene werden übersprungen.)` : ''))) return;
  state.tx.push(...fresh); save();
  month = fresh.map((t) => t.date).sort().pop().slice(0, 7);
  view = 'list'; render();
  toast(`${fresh.length} Buchungen importiert.`);
});

$('wipe').addEventListener('click', () => {
  if (!confirm('Wirklich alle Buchungen, Budgets und gelernten Kategorien auf diesem Gerät löschen?')) return;
  state = emptyState(); save(); render(); toast('Alle Daten gelöscht.');
});
$('copyUrl').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('quickUrl').textContent); toast('Adresse kopiert.'); }
  catch (e) { toast('Kopieren nicht möglich – bitte die Adresse markieren.'); }
});

/* ---------- Navigation & Start ---------- */
document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; render(); }));
$('prevMonth').addEventListener('click', () => { month = shiftMonth(month, -1); render(); });
$('nextMonth').addEventListener('click', () => { month = shiftMonth(month, 1); render(); });
$('fab').addEventListener('click', () => openDialog(null));
$('search').addEventListener('input', renderList);

quickCapture();
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
