import { html, useState, useEffect, Icon, Btn, toast, go, useLoad, Loading, ErrorBox, Empty, StatusBadge, statusOf, fmtDate, fmtDateTime, fmtMoney, timeLeft, quoteTotal } from "../ui.js";
import { store } from "../store.js";
import { RfqInfo, QA } from "./rfq.js";

export function Invitations({ user }) {
  const { data, loading, error } = useLoad(() => store.listMyInvitations(), []);
  if (loading) return html`<div class="page"><${Loading} /></div>`;
  if (error) return html`<div class="page"><${ErrorBox} error=${error} /></div>`;
  const rows = data.map((x) => ({ ...x, s: statusOf(x.rfq) })).sort((a, b) => new Date(a.rfq.deadline) - new Date(b.rfq.deadline));
  const action = rows.filter((x) => x.s === "open" && !x.myQuote);
  const submitted = rows.filter((x) => x.myQuote);
  const missed = rows.filter((x) => x.s !== "open" && !x.myQuote);

  const Item = ({ x, tone }) => {
    const q = x.myQuote;
    let right;
    if (!q && x.s === "open") right = html`<span class="small" style="color:var(--amber);font-weight:600">Quote now</span>`;
    else if (q?.status === "awarded") right = html`<span class="badge b-awarded"><${Icon} n="trophy" cls="sm" />Awarded to you</span>`;
    else if (q?.status === "not_awarded") right = html`<span class="badge b-draft">Not awarded</span>`;
    else if (q && x.s === "open") right = html`<span class="badge b-open">Submitted · can revise</span>`;
    else if (q) right = html`<span class="badge b-closed">Awaiting decision</span>`;
    else right = html`<${StatusBadge} s=${x.s} />`;
    return html`<a class="list-item" href=${"#/quote/" + x.rfq.id} style=${tone === "warn" ? "border-color:#fcd9a8;background:#fffcf7" : tone === "dim" ? "opacity:.7" : ""}>
      <span class="tile" style=${tone === "warn" ? "background:var(--amber-bg);color:var(--amber)" : tone === "ok" ? "background:var(--green-bg);color:var(--green)" : ""}><${Icon} n="file" /></span>
      <div class="grow"><div style="font-weight:650">${x.rfq.title}</div>
        <div class="meta">
          <span style=${tone === "warn" ? "color:var(--amber)" : ""}><${Icon} n="clock" cls="sm" />${x.s === "open" ? `Due ${fmtDate(x.rfq.deadline)} · ${timeLeft(x.rfq.deadline)}` : `Due ${fmtDate(x.rfq.deadline)}`}</span>
          <span><${Icon} n="building" cls="sm" />${x.rfq.owner_company || x.rfq.owner_name}</span>
          ${x.rfq.confidentiality === "confidential" && html`<span><${Icon} n="lock" cls="sm" />Confidential</span>`}
        </div></div>
      ${right}<${Icon} n="right" cls="sm" /></a>`;
  };
  const Section = ({ icon, color, title, list, tone }) => list.length > 0 && html`<div class="stack-sm">
    <h3 class="row" style="font-size:14.5px"><span style=${"color:" + color}><${Icon} n=${icon} cls="sm" /></span>${title}<span class="count">${list.length}</span></h3>
    ${list.map((x) => html`<${Item} x=${x} tone=${tone} />`)}</div>`;

  return html`<div class="page stack" style="max-width:860px">
    <div><h1>My Invitations</h1><p class="muted">RFQs you have been invited to quote on</p></div>
    ${rows.length === 0 ? html`<div class="card"><${Empty} icon="mail" title="No invitations yet">
        When a buyer invites <b>${user.email}</b> to an RFQ, it will appear here. Share this email address with your buyers.</${Empty}></div>` : html`
      <${Section} icon="alert" color="var(--amber)" title="Action required" list=${action} tone="warn" />
      <${Section} icon="checkc" color="var(--green)" title="Quotes submitted" list=${submitted} tone="ok" />
      <${Section} icon="xc" color="var(--faint)" title="Closed / not quoted" list=${missed} tone="dim" />`}
  </div>`;
}

export function QuotePage({ user, id }) {
  const [v, setV] = useState(0);
  const { data, loading, error } = useLoad(async () => {
    const rfq = await store.getRfq(id);
    if (rfq.owner_id === user.id) return { owner: true };
    const [inv, quote, qs] = await Promise.all([store.myInvitation(id), store.getMyQuote(id), store.listQuestions(id)]);
    return { rfq, inv, quote, qs };
  }, [id, v]);
  const reload = () => setV((x) => x + 1);

  if (loading && !data) return html`<div class="page"><${Loading} /></div>`;
  if (error) return html`<div class="page narrow"><a class="back" href="#/invitations"><${Icon} n="back" cls="sm" /> My invitations</a>
    <${ErrorBox} error=${error} /><p class="muted small" style="margin-top:12px">If a buyer emailed you this link, make sure you're signed in with the same email address they invited.</p></div>`;
  if (data.owner) { setTimeout(() => go("/rfq/" + id)); return null; }

  const { rfq, inv, quote, qs } = data;
  const s = statusOf(rfq);
  const gated = rfq.confidentiality === "confidential" && !inv?.acknowledged;

  return html`<div class="page stack">
    <div>
      <a class="back" href="#/invitations"><${Icon} n="back" cls="sm" /> My invitations</a>
      <div class="row wrap"><h1>${rfq.title}</h1><${StatusBadge} s=${s} />${rfq.confidentiality === "confidential" && html`<span class="badge b-draft"><${Icon} n="lock" cls="sm" />Confidential</span>`}</div>
      <div class="meta" style="margin-top:6px;font-size:14px">
        <span><${Icon} n="building" cls="sm" />${rfq.owner_company || rfq.owner_name}</span>
        <span><${Icon} n="clock" cls="sm" />Deadline ${fmtDateTime(rfq.deadline)}</span>
        ${s === "open" && html`<span class="badge b-open">${timeLeft(rfq.deadline)}</span>`}
      </div>
    </div>
    ${quote?.status === "awarded" && html`<div class="alert ok"><${Icon} n="trophy" /><div><b>Congratulations — you won this RFQ.</b> The buyer will contact you with a purchase order.</div></div>`}
    ${quote?.status === "not_awarded" && html`<div class="alert info"><${Icon} n="alert" /><div>This RFQ was awarded to another supplier. Thank you for quoting.</div></div>`}
    ${s === "closed" && !quote && html`<div class="alert warn"><${Icon} n="clock" /><div>This RFQ is closed and no longer accepting quotes.</div></div>`}

    ${gated ? html`<${Gate} rfq=${rfq} onDone=${reload} />` : html`
      <div class="detail-grid">
        <div class="stack">
          <${RfqInfo} rfq=${rfq} />
          <${QuoteForm} rfq=${rfq} quote=${quote} open=${s === "open"} onSaved=${reload} />
        </div>
        <div class="stack"><${QA} rfq=${rfq} qs=${qs} isBuyer=${false} onChange=${reload} /></div>
      </div>`}
  </div>`;
}

function Gate({ rfq, onDone }) {
  const [ok, setOk] = useState(false);
  return html`<div class="card card-pad stack" style="max-width:620px">
    <div class="row"><span class="ic-tile" style="margin:0"><${Icon} n="lock" /></span><h2>Confidentiality acknowledgement</h2></div>
    <p class="muted">${rfq.owner_company || "The buyer"} has marked this RFQ as confidential. Before you can view the details or submit a quote, please confirm:</p>
    <div class="terms-box" style="max-height:none">I will keep all information in this RFQ — including specifications, quantities, commercial terms and attachments — strictly confidential. I will use it only to prepare my quotation and will not share it with any third party without the buyer's written consent.</div>
    <label class="row small" style="cursor:pointer"><input type="checkbox" checked=${ok} onChange=${(e) => setOk(e.target.checked)} /> I acknowledge and agree to keep this RFQ confidential.</label>
    <div><${Btn} disabled=${!ok} onClick=${async () => { await store.acknowledge(rfq.id); toast("Thank you — RFQ unlocked"); onDone(); }}>Acknowledge & view RFQ</${Btn}></div>
  </div>`;
}

function QuoteForm({ rfq, quote, open, onSaved }) {
  const init = () => ({
    prices: Object.fromEntries(rfq.items.map((it) => [it.id, quote?.items?.find((x) => x.item_id === it.id)?.unit_price ?? ""])),
    lead: quote?.lead_time_days ?? "", validity: quote?.validity_days ?? 30, notes: quote?.notes || "", terms: !!quote?.terms_accepted
  });
  const [f, setF] = useState(init);
  const [edit, setEdit] = useState(!quote);
  useEffect(() => { setF(init()); setEdit(!quote); }, [quote?.updated_at]);
  const draft = { items: rfq.items.map((it) => ({ item_id: it.id, unit_price: f.prices[it.id] === "" ? "" : Number(f.prices[it.id]) })) };
  const total = quoteTotal(rfq, draft);
  const readOnly = !open || !edit;

  const submit = async () => {
    const missing = rfq.items.filter((it) => f.prices[it.id] === "" || isNaN(Number(f.prices[it.id])) || Number(f.prices[it.id]) < 0);
    if (missing.length === rfq.items.length) throw new Error("Enter a unit price for at least one line item.");
    if (!(Number(f.lead) >= 0) || f.lead === "") throw new Error("Please enter your delivery lead time in days.");
    if (!f.terms) throw new Error("Please accept the buyer's Terms & Conditions to submit.");
    await store.submitQuote(rfq.id, { items: draft.items.filter((x) => x.unit_price !== ""), lead_time_days: Number(f.lead), validity_days: Number(f.validity) || null, notes: f.notes.trim(), terms_accepted: true });
    toast(quote ? "Quote updated" : "Quote submitted to the buyer"); onSaved();
  };

  return html`<div class="card">
    <div class="card-head"><h2><${Icon} n="quotes" cls="sm" /> ${quote ? "Your quote" : "Submit your quote"}</h2>
      ${quote && html`<span class="tiny muted">Last updated ${fmtDateTime(quote.updated_at || quote.created_at)}</span>`}</div>
    <div class="card-pad stack">
      ${!open && !quote && html`<p class="muted">Quoting is closed for this RFQ.</p>`}
      ${(open || quote) && html`
      <div class="scroll-x"><table class="table">
        <thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r" style="min-width:130px">Unit price (${rfq.currency})</th><th class="r">Line total</th></tr></thead>
        <tbody>${rfq.items.map((it, i) => { const p = f.prices[it.id]; return html`<tr>
          <td class="muted">${i + 1}</td><td>${it.description}</td><td class="r num">${it.qty} <span class="muted">${it.unit}</span></td>
          <td class="r">${readOnly ? html`<span class="num">${p === "" ? "No bid" : fmtMoney(p, rfq.currency)}</span>` :
            html`<input class="input num" style="text-align:right;max-width:140px;margin-left:auto" type="number" min="0" step="any" placeholder="0.00" value=${p}
              onInput=${(e) => setF({ ...f, prices: { ...f.prices, [it.id]: e.target.value } })} aria-label=${"Unit price for " + it.description} />`}</td>
          <td class="r num" style="font-weight:600">${p === "" ? "—" : fmtMoney(Number(p) * it.qty, rfq.currency)}</td></tr>`; })}</tbody>
        <tfoot><tr><td></td><td colspan="3" style="font-weight:700">Total</td><td class="r num" style="font-weight:750;font-size:16px">${fmtMoney(total, rfq.currency)}</td></tr></tfoot>
      </table></div>
      <div class="grid3">
        <div class="field"><label>Delivery lead time (days) *</label><input class="input num" type="number" min="0" value=${f.lead} disabled=${readOnly} onInput=${(e) => setF({ ...f, lead: e.target.value })} /></div>
        <div class="field"><label>Quote valid for (days)</label><input class="input num" type="number" min="1" value=${f.validity} disabled=${readOnly} onInput=${(e) => setF({ ...f, validity: e.target.value })} /></div>
        <div class="field"><label>Incoterm</label><input class="input" value=${(rfq.incoterm || "") + " " + (rfq.delivery_place || "")} disabled /></div>
      </div>
      <div class="field"><label>Notes to buyer <span class="muted" style="font-weight:400">(brand, origin, exceptions…)</span></label>
        <textarea class="textarea" value=${f.notes} disabled=${readOnly} onInput=${(e) => setF({ ...f, notes: e.target.value })}></textarea></div>
      <label class="row small" style="cursor:pointer;align-items:flex-start"><input type="checkbox" style="margin-top:3px" checked=${f.terms} disabled=${readOnly} onChange=${(e) => setF({ ...f, terms: e.target.checked })} />
        <span>I have read and accept the buyer's <b>Terms & Conditions</b> (see above), and confirm this quotation is a firm offer for the validity period stated.</span></label>
      ${open && html`<div class="row" style="justify-content:flex-end">
        ${quote && !edit ? html`<button class="btn ghost" onClick=${() => setEdit(true)}><${Icon} n="edit" cls="sm" /> Revise quote</button>` : html`
          ${quote && html`<button class="btn ghost" onClick=${() => { setF(init()); setEdit(false); }}>Cancel</button>`}
          <${Btn} onClick=${submit}><${Icon} n="send" cls="sm" /> ${quote ? "Update quote" : "Submit quote"}</${Btn}>`}
      </div>`}
      ${open && quote && html`<p class="hint">You can revise your quote until the deadline (${fmtDateTime(rfq.deadline)}).</p>`}`}
    </div></div>`;
}
