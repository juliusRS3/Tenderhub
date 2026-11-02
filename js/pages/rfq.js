import { html, useState, useEffect, useRef, Icon, Btn, toast, errToast, go, CFG, useLoad, Loading, ErrorBox, Empty, StatusBadge, statusOf, Steps, fmtDate, fmtDateTime, fmtMoney, timeLeft, quoteTotal, initials, Modal, confirmBox, xlsx } from "../ui.js";
import { store } from "../store.js";

const toLocalInput = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const SUB = { draft: "Not yet visible to suppliers", open: "Accepting quotes from invited suppliers", closed: "Quoting has closed — compare bids and award", awarded: "Contract awarded" };

export function RfqDetail({ user, id }) {
  const [v, setV] = useState(0);
  const reload = () => setV((x) => x + 1);
  const { data, loading, error } = useLoad(async () => {
    const rfq = await store.getRfq(id);
    if (rfq.owner_id !== user.id) return { supplier: true };
    const [inv, quotes, qs, events] = await Promise.all([store.listInvitations(id), store.listQuotes(id), store.listQuestions(id), store.listEvents(id)]);
    return { rfq, inv, quotes, qs, events };
  }, [id, v]);
  const [extend, setExtend] = useState(false);

  if (loading && !data) return html`<div class="page"><${Loading} /></div>`;
  if (error) return html`<div class="page"><a class="back" href="#/"><${Icon} n="back" cls="sm" /> Back</a><${ErrorBox} error=${error} /></div>`;
  if (data.supplier) { setTimeout(() => go("/quote/" + id)); return null; }

  const { rfq, inv, quotes, qs, events } = data;
  const s = statusOf(rfq);

  const publish = async () => {
    if (new Date(rfq.deadline) <= new Date()) return errToast(new Error("The deadline has passed. Edit the RFQ and set a new deadline first."));
    const ok = await confirmBox({ title: "Publish this RFQ?", body: inv.length ? `${inv.length} invited supplier${inv.length > 1 ? "s" : ""} will be able to view it and submit quotes until ${fmtDateTime(rfq.deadline)}.` : "You haven't invited any suppliers yet. You can still publish and invite them afterwards.", ok: "Publish RFQ" });
    if (!ok) return;
    await store.updateRfq(id, { status: "open" }); toast("RFQ published"); reload();
  };
  const close = async () => {
    if (!(await confirmBox({ title: "Close this RFQ?", body: "Suppliers will no longer be able to submit or change quotes. You can then compare bids and award.", ok: "Close RFQ" }))) return;
    await store.updateRfq(id, { status: "closed" }); toast("RFQ closed"); reload();
  };
  const del = async () => {
    if (!(await confirmBox({ title: "Delete this RFQ?", body: "This permanently deletes the RFQ, its invitations, quotes and questions.", ok: "Delete", danger: true }))) return;
    await store.deleteRfq(id); toast("RFQ deleted"); go("/dashboard");
  };

  return html`<div class="page stack">
    <div>
      <div class="crumbs"><a href="#/dashboard">Dashboard</a><span>/</span><span style="color:var(--ink)">${rfq.title}</span></div>
      <div class="row spread wrap" style="gap:12px;align-items:flex-start">
        <div class="grow">
          <div class="row wrap"><h1>${rfq.title}</h1><${StatusBadge} s=${s} />${rfq.confidentiality === "confidential" && html`<span class="badge b-draft"><${Icon} n="lock" cls="sm" />Confidential</span>`}</div>
          <p class="muted" style="margin-top:4px">${SUB[s]}</p>
          <p class="row small muted" style="margin-top:2px"><${Icon} n="clock" cls="sm" /> Deadline: ${fmtDateTime(rfq.deadline)} ${s === "open" && html`<span class="badge b-open">${timeLeft(rfq.deadline)}</span>`}</p>
        </div>
        <div class="row wrap">
          ${s === "draft" && html`<button class="icon-btn" title="Delete RFQ" aria-label="Delete RFQ" onClick=${() => del().catch(errToast)}><${Icon} n="trash" /></button>
            <a class="btn ghost" href=${"#/rfq/" + id + "/edit"}><${Icon} n="edit" cls="sm" /> Edit</a>
            <${Btn} onClick=${publish}><${Icon} n="send" cls="sm" /> Publish RFQ</${Btn}>`}
          ${s === "open" && html`<button class="btn ghost" onClick=${() => setExtend(true)}><${Icon} n="clock" cls="sm" /> Extend</button><${Btn} cls="ghost" onClick=${close}>Close RFQ</${Btn}>`}
          ${s === "closed" && html`<button class="btn ghost" onClick=${() => setExtend(true)}>Reopen</button>`}
          ${["open", "closed", "awarded"].includes(s) && quotes.length > 0 && html`<a class="btn primary" href=${"#/rfq/" + id + "/compare"}><${Icon} n="chart" cls="sm" /> ${s === "awarded" ? "View comparison" : "Compare & award"}</a>`}
        </div>
      </div>
    </div>
    <${Steps} status=${s} />
    ${s === "awarded" && (() => { const w = quotes.find((q) => q.id === rfq.awarded_quote_id); return w && html`<div class="alert ok"><${Icon} n="trophy" /><div>Awarded to <b>${w.supplier_company || w.supplier_name}</b> for <b>${fmtMoney(quoteTotal(rfq, w), rfq.currency)}</b>.</div></div>`; })()}

    <div class="detail-grid">
      <div class="stack">
        <${RfqInfo} rfq=${rfq} />
        <div class="card">
          <div class="card-head"><h2><${Icon} n="quotes" cls="sm" /> Received Quotes <span class="count">${quotes.length}</span></h2>
            ${quotes.length > 1 && html`<a class="btn ghost sm" href=${"#/rfq/" + id + "/compare"}>Compare</a>`}</div>
          ${quotes.length === 0 ? html`<${Empty} icon="users" title="No quotes received yet.">${s === "draft" ? "Publish the RFQ to start receiving bids." : "Invite suppliers using the panel on the right."}</${Empty}>` : html`
            <div class="scroll-x"><table class="table">
              <thead><tr><th>Supplier</th><th class="r">Total</th><th class="r">Lead time</th><th>Submitted</th><th></th></tr></thead>
              <tbody>${quotes.slice().sort((a, b) => quoteTotal(rfq, a) - quoteTotal(rfq, b)).map((q, i) => html`<tr>
                <td><div style="font-weight:600">${q.supplier_company || q.supplier_name}</div><div class="tiny muted">${q.supplier_email}</div></td>
                <td class="r num" style="font-weight:650">${fmtMoney(quoteTotal(rfq, q), rfq.currency)}${i === 0 && quotes.length > 1 && html`<div class="tiny" style="color:var(--green)">Lowest</div>`}</td>
                <td class="r num">${q.lead_time_days != null ? q.lead_time_days + " days" : "—"}</td>
                <td class="small muted">${fmtDate(q.updated_at || q.created_at)}</td>
                <td>${q.status === "awarded" ? html`<span class="badge b-awarded">Awarded</span>` : q.status === "not_awarded" ? html`<span class="badge b-draft">Not awarded</span>` : ""}</td>
              </tr>`)}</tbody></table></div>`}
        </div>
        <${Activity} events=${events} />
      </div>
      <div class="stack">
        <${Bidders} rfq=${rfq} inv=${inv} quotes=${quotes} user=${user} onChange=${reload} />
        <${QA} rfq=${rfq} qs=${qs} isBuyer=${true} onChange=${reload} />
      </div>
    </div>
    ${extend && html`<${ExtendModal} rfq=${rfq} onClose=${() => setExtend(false)} onDone=${() => { setExtend(false); reload(); }} />`}
  </div>`;
}

function ExtendModal({ rfq, onClose, onDone }) {
  const base = new Date(Math.max(Date.now(), new Date(rfq.deadline).getTime()) + 3 * 864e5);
  const [d, setD] = useState(toLocalInput(base.toISOString()));
  const save = async () => {
    if (!d || new Date(d) <= new Date()) throw new Error("Pick a date and time in the future.");
    await store.updateRfq(rfq.id, { deadline: new Date(d).toISOString(), status: "open" }); toast("Deadline updated — RFQ is open"); onDone();
  };
  return html`<${Modal} title="Set a new deadline" onClose=${onClose} foot=${html`<button class="btn ghost" onClick=${onClose}>Cancel</button><${Btn} onClick=${save}>Save deadline</${Btn}>`}>
    <div class="field"><label>New submission deadline</label><input class="input" type="datetime-local" value=${d} onInput=${(e) => setD(e.target.value)} /><span class="hint">Invited suppliers can quote (or revise quotes) until this time.</span></div></${Modal}>`;
}

// Shared read-only block: description, commercial terms, T&C, line items.
export function RfqInfo({ rfq, showTerms = true }) {
  const [open, setOpen] = useState(false);
  const [pdf, setPdf] = useState(null);
  useEffect(() => { if (rfq.terms_file) store.fileUrl(rfq.terms_file).then(setPdf).catch(() => {}); }, [rfq.id]);
  const inc = CFG.incoterms.find(([c]) => c === rfq.incoterm);
  return html`
    <div class="card card-pad stack">
      <div><h2 class="row"><${Icon} n="file" cls="sm" /> Description</h2><p class="pre muted" style="margin-top:6px">${rfq.description}</p></div>
      ${rfq.requirements && html`<div style="border-top:1px solid var(--line-2);padding-top:14px"><h3>Requirements</h3><p class="pre muted" style="margin-top:4px">${rfq.requirements}</p></div>`}
      <div class="kv" style="border-top:1px solid var(--line-2);padding-top:14px">
        <div><div class="k">Incoterm</div><div class="v">${rfq.incoterm || "—"}${inc && html`<span class="muted" style="font-weight:400"> · ${inc[1]}</span>`}</div></div>
        <div><div class="k">Delivery place</div><div class="v">${rfq.delivery_place || "—"}</div></div>
        <div><div class="k">Currency</div><div class="v">${rfq.currency}</div></div>
      </div>
      ${showTerms && html`<div style="border-top:1px solid var(--line-2);padding-top:14px">
        <button class="row spread" style="width:100%;border:0;background:none;padding:0;cursor:pointer" onClick=${() => setOpen(!open)}>
          <h3 class="row"><${Icon} n="book" cls="sm" /> Terms & Conditions</h3><${Icon} n=${open ? "up" : "down"} cls="sm" /></button>
        ${open && html`<div style="margin-top:10px">${rfq.terms_mode === "pdf" ? html`<a class="btn ghost sm" href=${pdf} target="_blank" rel="noopener" download=${rfq.terms_file?.name}><${Icon} n="file" cls="sm" /> ${rfq.terms_file?.name || "Open PDF"}</a>` : html`<div class="terms-box">${rfq.terms_text}</div>`}</div>`}
      </div>`}
    </div>
    <div class="card">
      <div class="card-head"><h2>Line Items <span class="count">${rfq.items.length}</span></h2></div>
      <div class="scroll-x" style="padding:6px 10px 10px"><table class="table">
        <thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th>Unit</th></tr></thead>
        <tbody>${rfq.items.map((it, i) => html`<tr><td class="muted">${i + 1}</td><td>${it.description}</td><td class="r num">${it.qty}</td><td class="muted">${it.unit}</td></tr>`)}</tbody>
      </table></div>
    </div>`;
}

function Bidders({ rfq, inv, quotes, user, onChange }) {
  const [mode, setMode] = useState("search");
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [email, setEmail] = useState("");
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    if (mode !== "search" || q.trim().length < 2) { setRes([]); return; }
    t.current = setTimeout(() => store.searchSuppliers(q).then(setRes).catch(() => setRes([])), 250);
  }, [q, mode]);
  const locked = ["closed", "awarded"].includes(statusOf(rfq));
  const add = async (em) => { await store.invite(rfq.id, em); setQ(""); setEmail(""); setRes([]); toast("Supplier invited"); onChange(); };
  const quoted = (em) => quotes.some((x) => (x.supplier_email || "").toLowerCase() === em.toLowerCase());
  const mailto = (em) => {
    const link = `${CFG.appUrl.replace(/\/$/, "")}/#/quote/${rfq.id}`;
    const body = `Hello,\n\n${user.company || user.name} invites you to submit a quotation for:\n\n${rfq.title}\nDeadline: ${fmtDateTime(rfq.deadline)}\n\nView the RFQ and submit your quote here:\n${link}\n\nIf you are new to TenderHub, please sign up with this email address (${em}) so the RFQ appears in your account.\n\nRegards,\n${user.name}`;
    return `mailto:${em}?subject=${encodeURIComponent("Invitation to quote: " + rfq.title)}&body=${encodeURIComponent(body)}`;
  };
  return html`<div class="card">
    <div class="card-head"><div><h2><${Icon} n="users" cls="sm" /> Bidders List</h2><div class="tiny muted">${inv.length} supplier${inv.length === 1 ? "" : "s"} invited</div></div></div>
    <div class="card-pad stack-sm">
      ${!locked && html`
        <div class="seg" style="width:100%"><button style="flex:1" class=${mode === "search" ? "on" : ""} onClick=${() => setMode("search")}><${Icon} n="search" cls="sm" /> Search users</button>
          <button style="flex:1" class=${mode === "email" ? "on" : ""} onClick=${() => setMode("email")}><${Icon} n="mail" cls="sm" /> Invite by email</button></div>
        ${mode === "search" ? html`<div style="position:relative">
            <input class="input" placeholder="Search by name or company..." value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Search suppliers" />
            ${res.length > 0 && html`<div class="drop">${res.map((p) => html`<button onClick=${() => add(p.email).catch(errToast)}><div style="font-weight:600;font-size:14px">${p.company || p.name}</div><div class="tiny muted">${p.name} · ${p.email}</div></button>`)}</div>`}
            ${q.trim().length >= 2 && res.length === 0 && html`<div class="hint" style="margin-top:6px">No registered users match. Try “Invite by email”.</div>`}
          </div>`
        : html`<form class="row" onSubmit=${(e) => { e.preventDefault(); add(email).catch(errToast); }}>
            <input class="input" type="email" placeholder="supplier@company.com" value=${email} onInput=${(e) => setEmail(e.target.value)} aria-label="Supplier email" />
            <button class="btn primary" type="submit" aria-label="Invite"><${Icon} n="plus" cls="sm" /></button></form>`}`}
      ${inv.length === 0 ? html`<div class="empty" style="padding:18px 0"><${Icon} n="users" /><div class="small">No suppliers invited yet</div></div>` :
        html`<div>${inv.map((i) => html`<div class="person">
          <span class="avatar" style="width:30px;height:30px;font-size:11px;background:${i.registered ? "" : "#cbd5e1"}">${initials(i.company || i.name || i.email)}</span>
          <div class="grow"><div class="small" style="font-weight:600;overflow:hidden;text-overflow:ellipsis">${i.company || i.name || i.email}</div>
            <div class="tiny" style="color:${quoted(i.email) ? "var(--green)" : i.registered ? "var(--muted)" : "var(--amber)"}">${quoted(i.email) ? "Quote received" : i.acknowledged ? "Acknowledged" : i.registered ? "Registered · " + i.email : "Awaiting signup · " + i.email}</div></div>
          <a class="icon-btn" href=${mailto(i.email)} title="Send email invitation" aria-label="Send email invitation"><${Icon} n="mail" cls="sm" /></a>
          ${!quoted(i.email) && !locked && html`<button class="icon-btn" title="Remove" aria-label="Remove supplier" onClick=${() => store.removeInvitation(i.id).then(onChange).catch(errToast)}><${Icon} n="x" cls="sm" /></button>`}
        </div>`)}</div>`}
      ${inv.length > 0 && rfq.status === "draft" && html`<div class="hint">Suppliers can see the RFQ once you publish it. Use the <${Icon} n="mail" cls="sm" /> button to email them the link.</div>`}
    </div></div>`;
}

export function QA({ rfq, qs, isBuyer, onChange }) {
  const [open, setOpen] = useState(true);
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState({});
  const canAsk = !isBuyer && statusOf(rfq) === "open";
  return html`<div class="card">
    <button class="card-head" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line-2);cursor:pointer" onClick=${() => setOpen(!open)}>
      <h2><${Icon} n="msg" cls="sm" /> Clarification Q&A ${qs.length > 0 && html`<span class="count">${qs.length}</span>`}</h2><${Icon} n=${open ? "up" : "down"} cls="sm" /></button>
    ${open && html`<div class="card-pad" style="padding-top:6px">
      ${qs.length === 0 && html`<p class="muted small" style="text-align:center;padding:14px 0">No questions yet.</p>`}
      ${qs.map((q) => html`<div class="qa">
        <div class="tiny muted">${q.asker_label || "Supplier"} · ${fmtDate(q.created_at)}</div>
        <div class="small" style="font-weight:600;margin-top:2px">Q: ${q.question}</div>
        ${q.answer ? html`<div class="small" style="margin-top:6px;padding-left:10px;border-left:3px solid var(--teal)"><b>A:</b> ${q.answer}</div>`
          : isBuyer ? html`<form class="row" style="margin-top:8px" onSubmit=${async (e) => { e.preventDefault(); const a = (answers[q.id] || "").trim(); if (!a) return; try { await store.answer(q.id, a); toast("Answer published to all invited suppliers"); onChange(); } catch (x) { errToast(x); } }}>
              <input class="input" style="padding:7px 10px;font-size:13.5px" placeholder="Type your answer…" value=${answers[q.id] || ""} onInput=${(e) => setAnswers({ ...answers, [q.id]: e.target.value })} aria-label="Answer" />
              <button class="btn primary sm" type="submit">Reply</button></form>`
          : html`<div class="tiny" style="color:var(--amber);margin-top:4px">Awaiting buyer's answer</div>`}
      </div>`)}
      ${canAsk && html`<form class="stack-sm" style="margin-top:10px" onSubmit=${async (e) => { e.preventDefault(); if (!text.trim()) return; try { await store.ask(rfq.id, text.trim()); setText(""); toast("Question sent to the buyer"); onChange(); } catch (x) { errToast(x); } }}>
        <textarea class="textarea" style="min-height:64px" placeholder="Ask the buyer a question… (answers are shared with all invited suppliers; your name stays hidden)" value=${text} onInput=${(e) => setText(e.target.value)} aria-label="Your question"></textarea>
        <button class="btn ghost sm" type="submit"><${Icon} n="send" cls="sm" /> Ask question</button></form>`}
      ${isBuyer && qs.length > 0 && html`<p class="hint" style="margin-top:8px">Answers are visible to all invited suppliers. Askers are shown anonymously.</p>`}
    </div>`}
  </div>`;
}

function Activity({ events }) {
  const [all, setAll] = useState(false);
  if (!events.length) return null;
  const list = all ? events : events.slice(0, 6);
  return html`<div class="card"><div class="card-head"><h2><${Icon} n="activity" cls="sm" /> Activity log</h2></div>
    <div class="card-pad" style="padding-top:8px"><ul class="timeline">${list.map((e) => html`<li><span class="dot"></span><div><span style="font-weight:600">${e.actor}</span> <span class="muted">${e.action.charAt(0).toLowerCase() + e.action.slice(1)}</span><div class="tiny faint">${fmtDateTime(e.created_at)}</div></div></li>`)}</ul>
    ${events.length > 6 && html`<button class="btn soft sm" onClick=${() => setAll(!all)}>${all ? "Show less" : `Show all ${events.length}`}</button>`}</div></div>`;
}

// ---------------------------------------------------------------- comparison
export function Compare({ user, id }) {
  const [v, setV] = useState(0);
  const { data, loading, error } = useLoad(async () => {
    const rfq = await store.getRfq(id);
    if (rfq.owner_id !== user.id) throw new Error("Only the buyer can compare quotes.");
    return { rfq, quotes: await store.listQuotes(id) };
  }, [id, v]);
  if (loading && !data) return html`<div class="page"><${Loading} /></div>`;
  if (error) return html`<div class="page"><${ErrorBox} error=${error} /></div>`;
  const { rfq } = data;
  const s = statusOf(rfq);
  const quotes = data.quotes.slice().sort((a, b) => quoteTotal(rfq, a) - quoteTotal(rfq, b));
  const price = (q, it) => {
    const v = (q.items || []).find((x) => x.item_id === it.id)?.unit_price;
    if (v === undefined || v === null || v === "") return null;
    const p = Number(v); return isNaN(p) ? null : p;
  };
  const lowest = (it) => { const ps = quotes.map((q) => price(q, it)).filter((p) => p != null && p > 0); return ps.length ? Math.min(...ps) : null; };
  const totals = quotes.map((q) => quoteTotal(rfq, q));
  const minTotal = Math.min(...totals);
  const name = (q) => q.supplier_company || q.supplier_name;

  const award = async (q) => {
    const ok = await confirmBox({ title: `Award to ${name(q)}?`, body: `This awards the RFQ for ${fmtMoney(quoteTotal(rfq, q), rfq.currency)}, closes it, and notifies all suppliers of the outcome in their dashboard. This can't be undone.`, ok: "Award contract" });
    if (!ok) return;
    await store.award(rfq.id, q.id); toast("Contract awarded"); setV((x) => x + 1);
  };
  const exportXlsx = async () => {
    const X = await xlsx();
    const head = ["#", "Description", "Qty", "Unit", ...quotes.flatMap((q) => [name(q) + " unit price", name(q) + " line total"])];
    const rows = rfq.items.map((it, i) => [i + 1, it.description, Number(it.qty), it.unit, ...quotes.flatMap((q) => { const p = price(q, it); return [p ?? "", p != null ? p * it.qty : ""]; })]);
    rows.push(["", "TOTAL (" + rfq.currency + ")", "", "", ...quotes.flatMap((q, i) => ["", totals[i]])]);
    rows.push(["", "Lead time (days)", "", "", ...quotes.flatMap((q) => ["", q.lead_time_days ?? ""])]);
    rows.push(["", "Validity (days)", "", "", ...quotes.flatMap((q) => ["", q.validity_days ?? ""])]);
    rows.push(["", "Notes", "", "", ...quotes.flatMap((q) => ["", q.notes || ""])]);
    const ws = X.utils.aoa_to_sheet([[rfq.title], ["Deadline: " + fmtDateTime(rfq.deadline) + " · Incoterm: " + (rfq.incoterm || "") + " " + (rfq.delivery_place || "")], [], head, ...rows]);
    ws["!cols"] = [{ wch: 4 }, { wch: 45 }, { wch: 8 }, { wch: 8 }, ...quotes.flatMap(() => [{ wch: 18 }, { wch: 18 }])];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Bid comparison");
    X.writeFile(wb, `Bid comparison - ${rfq.title.replace(/[\\/:*?"<>|]/g, "")}.xlsx`);
  };

  return html`<div class="page stack" style="max-width:1280px">
    <div>
      <div class="crumbs no-print"><a href="#/dashboard">Dashboard</a><span>/</span><a href=${"#/rfq/" + id}>${rfq.title}</a><span>/</span><span style="color:var(--ink)">Comparison</span></div>
      <div class="row spread wrap" style="gap:12px">
        <div><h1>Bid comparison</h1><p class="muted">${rfq.title} · ${quotes.length} quote${quotes.length === 1 ? "" : "s"} · prices in ${rfq.currency}</p></div>
        <div class="row no-print"><button class="btn ghost" onClick=${() => exportXlsx().catch(errToast)}><${Icon} n="download" cls="sm" /> Excel</button><button class="btn ghost" onClick=${() => print()}><${Icon} n="printer" cls="sm" /> Print</button></div>
      </div>
    </div>
    ${s === "open" && html`<div class="alert info no-print"><${Icon} n="clock" /><div>This RFQ is still open (${timeLeft(rfq.deadline)}). Suppliers may still revise their quotes. Awarding now will close it.</div></div>`}
    ${quotes.length === 0 ? html`<div class="card"><${Empty} icon="quotes" title="No quotes to compare yet" /></div>` : html`
    <div class="card scroll-x">
      <table class="table cmp">
        <thead><tr><th>#</th><th>Description</th><th class="r">Qty</th>
          ${quotes.map((q) => html`<th class=${"r " + (q.status === "awarded" ? "winner-col" : "")} style="min-width:150px">
            <div style="color:var(--ink);font-size:13px">${name(q)}</div>${q.status === "awarded" && html`<span class="badge b-awarded"><${Icon} n="trophy" cls="sm" />Awarded</span>`}</th>`)}</tr></thead>
        <tbody>${rfq.items.map((it, i) => { const lo = lowest(it); return html`<tr>
          <td class="muted">${i + 1}</td><td class="desc">${it.description}</td><td class="r num">${it.qty} <span class="muted">${it.unit}</span></td>
          ${quotes.map((q) => { const p = price(q, it); return html`<td class=${"r num " + (p != null && p === lo && quotes.length > 1 ? "cheapest" : "") + (q.status === "awarded" ? " winner-col" : "")}>
            ${p != null ? html`${fmtMoney(p * it.qty, rfq.currency)}<div class="tiny muted" style="font-weight:400">${fmtMoney(p, rfq.currency)} / ${it.unit}</div>` : html`<span class="faint">No bid</span>`}</td>`; })}
        </tr>`; })}</tbody>
        <tfoot>
          <tr><td></td><td>Total</td><td></td>${quotes.map((q, i) => html`<td class=${"r num " + (totals[i] === minTotal && quotes.length > 1 ? "cheapest" : "") + (q.status === "awarded" ? " winner-col" : "")} style="font-size:15px">${fmtMoney(totals[i], rfq.currency)}</td>`)}</tr>
          <tr><td></td><td class="muted" style="font-weight:500">Difference vs lowest</td><td></td>${quotes.map((q, i) => html`<td class="r num muted" style="font-weight:500">${totals[i] === minTotal ? "—" : "+" + ((totals[i] / minTotal - 1) * 100).toFixed(1) + "%"}</td>`)}</tr>
          <tr><td></td><td class="muted" style="font-weight:500">Lead time</td><td></td>${quotes.map((q) => html`<td class="r" style="font-weight:500">${q.lead_time_days != null ? q.lead_time_days + " days" : "—"}</td>`)}</tr>
          <tr><td></td><td class="muted" style="font-weight:500">Quote validity</td><td></td>${quotes.map((q) => html`<td class="r" style="font-weight:500">${q.validity_days != null ? q.validity_days + " days" : "—"}</td>`)}</tr>
          <tr><td></td><td class="muted" style="font-weight:500">Notes</td><td></td>${quotes.map((q) => html`<td class="small" style="font-weight:400;white-space:normal;min-width:150px">${q.notes || "—"}</td>`)}</tr>
          <tr><td></td><td class="muted" style="font-weight:500">Accepted T&C</td><td></td>${quotes.map((q) => html`<td class="r" style="font-weight:500">${q.terms_accepted ? html`<span style="color:var(--green)">Yes</span>` : "No"}</td>`)}</tr>
          ${s !== "awarded" && html`<tr class="no-print"><td></td><td></td><td></td>${quotes.map((q) => html`<td class="r"><${Btn} cls="success sm" onClick=${() => award(q)}><${Icon} n="trophy" cls="sm" /> Award</${Btn}></td>`)}</tr>`}
        </tfoot>
      </table>
    </div>
    <p class="hint">Green cells show the lowest price for each line and the lowest total. Suppliers are sorted from lowest to highest total.</p>`}
  </div>`;
}
