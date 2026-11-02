import { html, render, useState, useEffect, useCallback, useRef } from "./vendor/preact-htm.js";
export { html, render, useState, useEffect, useCallback, useRef };
export const CFG = window.TENDERHUB_CONFIG;

// ---------------------------------------------------------------- icons
const P = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  help: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="M4.93 4.93l4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  checkc: '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  xc: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
  right: '<path d="M9 18l6-6-6-6"/>', down: '<path d="M6 9l6 6 6-6"/>', up: '<path d="M18 15l-6-6-6 6"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>', arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  sparkles: '<path d="M12 3l1.9 5.8L20 10.5l-6.1 1.7L12 18l-1.9-5.8L4 10.5l6.1-1.7z"/><path d="M19 3v4M17 5h4"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  edit: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  quotes: '<path d="M22 17l-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>',
  sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h2M14 13h2M8 17h2M14 17h2"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  swap: '<path d="M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3"/>',
};
export const Icon = ({ n, cls = "" }) => html`<svg class=${"ico " + cls} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: P[n] || "" }}></svg>`;

// ---------------------------------------------------------------- formatting
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtDateTime = (d) => d ? new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
export const fmtMoney = (n, cur) => {
  if (n == null || n === "" || isNaN(n)) return "—";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD", maximumFractionDigits: 2 }).format(n); }
  catch { return (cur || "") + " " + Number(n).toFixed(2); }
};
export function timeLeft(d) {
  const ms = new Date(d) - Date.now();
  if (ms <= 0) return "Deadline passed";
  const h = Math.floor(ms / 36e5), dd = Math.floor(h / 24);
  if (dd >= 2) return `${dd} days left`;
  if (h >= 1) return `${h} hour${h > 1 ? "s" : ""} left`;
  return `${Math.max(1, Math.floor(ms / 6e4))} min left`;
}
export const initials = (s) => (s || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
export const planOf = (id) => CFG.plans.find((p) => p.id === id) || CFG.plans[0];

// Status shown to users: an "open" RFQ whose deadline passed counts as closed.
export function statusOf(r) {
  if (r.status === "open" && new Date(r.deadline) < new Date()) return "closed";
  return r.status;
}
const SL = { draft: "Draft", open: "Open", closed: "Closed", awarded: "Awarded" };
export const StatusBadge = ({ s }) => html`<span class=${"badge b-" + s}>${SL[s] || s}</span>`;
export const quoteTotal = (rfq, q) => (rfq.items || []).reduce((sum, it) => {
  const line = (q.items || []).find((x) => x.item_id === it.id); const p = Number(line?.unit_price);
  return sum + (isNaN(p) ? 0 : p * Number(it.qty || 0));
}, 0);

// ---------------------------------------------------------------- routing
export const go = (path) => { location.hash = "#" + path; };

// ---------------------------------------------------------------- toasts
let pushToast = () => {};
export const toast = (msg, kind = "ok") => pushToast({ msg, kind, id: Math.random() });
export function Toasts() {
  const [list, setList] = useState([]);
  pushToast = (t) => { setList((l) => [...l.slice(-2), t]); setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 3000); };
  return html`<div class="toasts" role="status">${list.map((t) => html`<div class=${"toast " + (t.kind === "err" ? "err" : "")}>${t.msg}</div>`)}</div>`;
}
export const errToast = (e) => toast(e?.message || String(e), "err");

// ---------------------------------------------------------------- data hook
export function useLoad(fn, deps = []) {
  const [state, set] = useState({ loading: true, data: null, error: null });
  const reload = useCallback(async () => {
    try { const data = await fn(); set({ loading: false, data, error: null }); }
    catch (e) { set({ loading: false, data: null, error: e }); }
  }, deps);
  useEffect(() => { set((s) => ({ ...s, loading: true })); reload(); }, [reload]);
  return { ...state, reload };
}
export const Loading = () => html`<div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`;
export const ErrorBox = ({ error }) => html`<div class="alert err"><${Icon} n="alert" /><div>${error?.message || "Something went wrong."}</div></div>`;

// ---------------------------------------------------------------- small components
export function Modal({ title, onClose, children, foot, wide }) {
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []);
  return html`<div class="modal-bg" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="modal" style=${wide ? "max-width:720px" : ""} role="dialog" aria-modal="true">
      <div class="card-head"><h2>${title}</h2><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
      <div class="card-pad">${children}</div>
      ${foot && html`<div class="modal-foot">${foot}</div>`}
    </div></div>`;
}

let confirmOpen = () => {};
export const confirmBox = (opts) => new Promise((resolve) => confirmOpen({ ...opts, resolve }));
export function ConfirmHost() {
  const [c, setC] = useState(null);
  confirmOpen = setC;
  if (!c) return null;
  const done = (v) => { c.resolve(v); setC(null); };
  return html`<${Modal} title=${c.title} onClose=${() => done(false)}
    foot=${html`<button class="btn ghost" onClick=${() => done(false)}>Cancel</button><button class=${"btn " + (c.danger ? "danger" : "primary")} onClick=${() => done(true)}>${c.ok || "Confirm"}</button>`}>
    <p class="muted">${c.body}</p></${Modal}>`;
}

export function Btn({ onClick, children, cls = "primary", disabled, type = "button", title }) {
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    if (!onClick) return;
    if (type === "submit") e.preventDefault(); // Enter key and clicks both arrive here
    const form = e.currentTarget && e.currentTarget.form;
    if (type === "submit" && form && !form.reportValidity()) return;
    setBusy(true);
    try { await onClick(e); } catch (err) { errToast(err); } finally { setBusy(false); }
  };
  return html`<button type=${type} class=${"btn " + cls} disabled=${disabled || busy} onClick=${run} title=${title}>${busy ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>` : null}${children}</button>`;
}

export const Empty = ({ icon = "file", title, children }) => html`<div class="empty"><${Icon} n=${icon} /><div style="font-weight:600;color:var(--ink-2)">${title}</div>${children && html`<div class="small" style="margin-top:4px">${children}</div>`}</div>`;

export function Steps({ status }) {
  const order = ["draft", "open", "closed", "awarded"];
  const idx = order.indexOf(status);
  return html`<div class="card steps">${order.map((s, i) => html`
    <div class=${"step " + (i < idx || status === "awarded" ? "done" : i === idx ? "cur" : "")}>
      <div class="c">${i < idx || status === "awarded" ? html`<${Icon} n="check" cls="sm" />` : i + 1}</div>${SL[s]}
    </div>`)}</div>`;
}

// Lazy-load SheetJS only when someone uploads/downloads Excel.
export async function xlsx() {
  if (window.XLSX) return window.XLSX;
  await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "js/vendor/xlsx.mini.min.js"; s.onload = res; s.onerror = () => rej(new Error("Could not load the Excel reader.")); document.head.appendChild(s); });
  return window.XLSX;
}
