import { html, useState, useEffect, Icon, Btn, toast, errToast, go, CFG, useLoad, Loading, ErrorBox, Empty, StatusBadge, statusOf, fmtDate, planOf, xlsx } from "../ui.js";
import { store } from "../store.js";

export const activeCount = (rfqs) => rfqs.filter((r) => ["draft", "open"].includes(statusOf(r))).length;

export function BuyerDashboard({ user }) {
  const { data, loading, error } = useLoad(() => store.listMyRfqs(), []);
  const [tab, setTab] = useState("all");
  if (loading) return html`<div class="page"><${Loading} /></div>`;
  if (error) return html`<div class="page"><${ErrorBox} error=${error} /></div>`;
  const rows = data.map((r) => ({ ...r, s: statusOf(r) }));
  const n = (s) => rows.filter((r) => r.s === s).length;
  const shown = tab === "all" ? rows : rows.filter((r) => r.s === tab);
  const plan = planOf(user.plan);
  const active = activeCount(rows);
  const colors = { draft: "#94a3b8", open: "#1d5fd6", closed: "#d97706", awarded: "#16a34a" };
  return html`<div class="page stack">
    <div class="row spread wrap" style="gap:12px">
      <div><h1>RFQ Dashboard</h1><p class="muted">Manage your requests for quotation</p></div>
      <a class="btn primary" href="#/rfq/new"><${Icon} n="plus" cls="sm" /> New RFQ</a>
    </div>
    <div class="row wrap small muted" style="gap:6px">
      <${Icon} n="card" cls="sm" /> <span><b style="color:var(--ink)">${plan.name}</b> plan · ${active} of ${plan.limit === Infinity ? "unlimited" : plan.limit} active RFQs used</span>
      ${plan.limit !== Infinity && active >= plan.limit && html`<a href="#/billing" style="font-weight:600">Upgrade</a>`}
    </div>
    <div class="stats">${["draft", "open", "closed", "awarded"].map((s) => html`
      <div class="card stat"><div class="row small muted" style="font-weight:600"><span class="dot" style=${"background:" + colors[s]}></span>${s[0].toUpperCase() + s.slice(1)}</div>
      <div class="v num">${n(s)}</div><div class="tiny muted">RFQ${n(s) === 1 ? "" : "s"}</div></div>`)}
    </div>
    <div class="tabs">${["all", "open", "draft", "closed", "awarded"].map((t) => html`
      <button class=${tab === t ? "on" : ""} onClick=${() => setTab(t)}>${t[0].toUpperCase() + t.slice(1)}${t !== "all" && n(t) > 0 ? html`<span class="count">${n(t)}</span>` : ""}</button>`)}
    </div>
    ${shown.length === 0 ? html`<div class="card"><${Empty} title=${tab === "all" ? "No RFQs yet" : "Nothing here"}>
        ${tab === "all" && html`<div style="margin-top:12px"><a class="btn primary sm" href="#/rfq/new"><${Icon} n="plus" cls="sm" /> Create your first RFQ</a></div>`}</${Empty}></div>`
      : html`<div class="stack-sm">${shown.map((r) => html`
        <a class="list-item" href=${"#/rfq/" + r.id}>
          <span class="tile"><${Icon} n="file" /></span>
          <div class="grow"><div style="font-weight:650">${r.title}</div>
            <div class="meta"><span><${Icon} n="clock" cls="sm" />Due ${fmtDate(r.deadline)}</span><span><${Icon} n="users" cls="sm" />${r.invite_count} invited</span><span><${Icon} n="quotes" cls="sm" />${r.quote_count} quote${r.quote_count === 1 ? "" : "s"}</span></div></div>
          <${StatusBadge} s=${r.s} /><${Icon} n="right" cls="sm" />
        </a>`)}</div>`}
  </div>`;
}

// ---------------------------------------------------------------- RFQ form
const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const newItem = () => ({ id: crypto.randomUUID ? crypto.randomUUID() : String(Math.random()), description: "", qty: 1, unit: "pcs" });

export function RfqForm({ user, id }) {
  const editing = !!id;
  const [f, setF] = useState(null);
  const [active, setActive] = useState(0);
  const [loadErr, setLoadErr] = useState(null);
  const [errors, setErrors] = useState({});
  const plan = planOf(user.plan);

  useEffect(() => {
    (async () => {
      try {
        const mine = await store.listMyRfqs(); setActive(activeCount(mine));
        if (editing) {
          const r = await store.getRfq(id);
          if (r.status !== "draft") throw new Error("Only draft RFQs can be edited. You can extend the deadline from the RFQ page.");
          setF({ ...r, deadline: toLocalInput(r.deadline) });
        } else {
          setF({ title: "", description: "", requirements: "", deadline: "", incoterm: "", delivery_place: "", currency: "USD", confidentiality: "standard", terms_mode: "template", terms_text: CFG.termsTemplate, terms_file: null, items: [newItem()] });
        }
      } catch (e) { setLoadErr(e); }
    })();
  }, [id]);

  if (loadErr) return html`<div class="page narrow"><a class="back" href="#/dashboard"><${Icon} n="back" cls="sm" /> Back to dashboard</a><${ErrorBox} error=${loadErr} /></div>`;
  if (!f) return html`<div class="page"><${Loading} /></div>`;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const atLimit = !editing && plan.limit !== Infinity && active >= plan.limit;
  const setItem = (i, k, v) => { const items = f.items.slice(); items[i] = { ...items[i], [k]: v }; setF({ ...f, items }); };

  const importExcel = async (e) => {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    try {
      const X = await xlsx();
      const wb = X.read(await file.arrayBuffer());
      const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      let h = rows.findIndex((r) => r.some((c) => /desc|item|material|product|service/i.test(String(c))));
      let ci = { d: 0, q: 1, u: 2 };
      if (h >= 0) {
        const hr = rows[h].map((c) => String(c));
        const find = (re) => hr.findIndex((c) => re.test(c));
        ci = { d: find(/desc|item|material|product|service/i), q: find(/qty|quant/i), u: find(/unit|uom/i) };
        if (ci.d < 0) ci.d = 0;
      }
      const items = rows.slice(h + 1).map((r) => ({
        ...newItem(), description: String(r[ci.d] ?? "").trim(),
        qty: ci.q >= 0 ? Number(String(r[ci.q]).replace(/,/g, "")) || 1 : 1,
        unit: ci.u >= 0 && String(r[ci.u]).trim() ? String(r[ci.u]).trim() : "pcs"
      })).filter((x) => x.description);
      if (!items.length) throw new Error("No line items found. Use columns: Description, Qty, Unit.");
      const keep = f.items.filter((x) => x.description.trim());
      setF({ ...f, items: [...keep, ...items] });
      toast(`Imported ${items.length} line item${items.length > 1 ? "s" : ""} from ${file.name}`);
    } catch (x) { errToast(x); }
  };
  const template = async () => {
    const X = await xlsx();
    const ws = X.utils.aoa_to_sheet([["Description", "Qty", "Unit"], ["A4 photocopy paper 80gsm, 500 sheets/ream", 100, "ream"], ["Box file, PVC, foolscap", 50, "pcs"]]);
    ws["!cols"] = [{ wch: 50 }, { wch: 8 }, { wch: 8 }];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, "Line items"); X.writeFile(wb, "TenderHub-line-items-template.xlsx");
  };
  const uploadPdf = async (e) => {
    const file = e.target.files[0]; e.target.value = ""; if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return errToast(new Error("Please choose a PDF file."));
    try { const tf = await store.uploadFile(file); setF((x) => ({ ...x, terms_file: tf })); toast("PDF attached"); } catch (x) { errToast(x); }
  };

  const validate = () => {
    const er = {};
    if (!f.title.trim()) er.title = "Required";
    if (!f.description.trim()) er.description = "Required";
    if (!f.deadline) er.deadline = "Required"; else if (new Date(f.deadline) <= new Date()) er.deadline = "Must be in the future";
    if (!f.incoterm) er.incoterm = "Required";
    if (!f.delivery_place.trim()) er.delivery_place = "Required";
    if (!f.currency) er.currency = "Required";
    const items = f.items.filter((x) => x.description.trim());
    if (!items.length) er.items = "Add at least one line item";
    else if (items.some((x) => !(Number(x.qty) > 0))) er.items = "Every line item needs a quantity above 0";
    if (f.terms_mode === "pdf" ? !f.terms_file : !f.terms_text.trim()) er.terms = f.terms_mode === "pdf" ? "Upload a PDF" : "Terms are required";
    setErrors(er);
    if (Object.keys(er).length) { toast("Please fix the highlighted fields", "err"); return false; }
    return true;
  };
  const save = async () => {
    if (!validate()) return;
    const data = {
      title: f.title.trim(), description: f.description.trim(), requirements: f.requirements.trim(), deadline: new Date(f.deadline).toISOString(),
      incoterm: f.incoterm, delivery_place: f.delivery_place.trim(), currency: f.currency, confidentiality: f.confidentiality,
      terms_mode: f.terms_mode, terms_text: f.terms_mode === "pdf" ? "" : f.terms_text, terms_file: f.terms_mode === "pdf" ? f.terms_file : null,
      items: f.items.filter((x) => x.description.trim()).map((x) => ({ id: x.id, description: x.description.trim(), qty: Number(x.qty), unit: x.unit || "pcs" }))
    };
    const r = editing ? await store.updateRfq(id, data) : await store.createRfq(data);
    toast(editing ? "RFQ updated" : "RFQ created as draft — now invite suppliers and publish");
    go("/rfq/" + r.id);
  };
  const Err = ({ k }) => errors[k] ? html`<span class="hint" style="color:var(--red)">${errors[k]}</span>` : null;
  const minDate = toLocalInput(new Date(Date.now() + 36e5).toISOString());

  return html`<div class="page narrow stack">
    <div><a class="back" href=${editing ? "#/rfq/" + id : "#/dashboard"}><${Icon} n="back" cls="sm" /> ${editing ? "Back to RFQ" : "Back to dashboard"}</a>
      <h1>${editing ? "Edit RFQ" : "New Request for Quotation"}</h1><p class="muted">Fill in the details to ${editing ? "update your" : "create a new"} RFQ</p></div>

    ${atLimit && html`<div class="alert warn"><${Icon} n="rocket" /><div class="grow"><b>RFQ limit reached</b>
      <div class="small">Your ${plan.name} plan allows ${plan.limit} active RFQ${plan.limit > 1 ? "s" : ""} at a time (draft or open). Close or award existing RFQs to free up space, or upgrade your plan for more.</div>
      <div class="row" style="margin-top:10px"><a class="btn primary sm" href="#/billing">Upgrade plan</a><a class="btn ghost sm" href="#/dashboard">Go to dashboard</a></div></div></div>`}

    <div class="card card-pad stack">
      <h2>RFQ Details</h2>
      <div class="field"><label for="t">Title *</label><input id="t" class="input" placeholder="Office Supplies Q3 2026" value=${f.title} onInput=${set("title")} /><${Err} k="title" /></div>
      <div class="field"><label for="d">Description *</label><textarea id="d" class="textarea" placeholder="Describe what you need..." value=${f.description} onInput=${set("description")}></textarea><${Err} k="description" /></div>
      <div class="field"><label for="rq">Requirements <span class="muted" style="font-weight:400">(optional)</span></label><textarea id="rq" class="textarea" placeholder="Any specific requirements, certifications, brand, warranty, etc." value=${f.requirements} onInput=${set("requirements")}></textarea></div>
      <div class="field"><label for="dl">Submission Deadline *</label><input id="dl" class="input" type="datetime-local" min=${minDate} value=${f.deadline} onInput=${set("deadline")} /><${Err} k="deadline" /></div>
    </div>

    <div class="card card-pad stack">
      <h2>Commercial Terms</h2>
      <div class="grid2">
        <div class="field"><label for="inc">Delivery Term (Incoterm) *</label>
          <select id="inc" class="select" value=${f.incoterm} onChange=${set("incoterm")}><option value="">Select Incoterm</option>${CFG.incoterms.map(([c, n]) => html`<option value=${c}>${c} — ${n}</option>`)}</select>
          <span class="hint">Published by the International Chamber of Commerce (ICC)</span><${Err} k="incoterm" /></div>
        <div class="field"><label for="dp">Delivery Place *</label><input id="dp" class="input" placeholder="e.g. Muscat, Oman" value=${f.delivery_place} onInput=${set("delivery_place")} />
          <span class="hint">Where the goods/services will be delivered</span><${Err} k="delivery_place" /></div>
      </div>
      <div class="field" style="max-width:280px"><label for="cur">Quotation Currency *</label>
        <select id="cur" class="select" value=${f.currency} onChange=${set("currency")}>${CFG.currencies.map((c) => html`<option value=${c}>${c}</option>`)}</select>
        <span class="hint">Suppliers will quote prices in this currency</span></div>
    </div>

    <div class="card card-pad stack">
      <div><h2 class="row"><${Icon} n="shield" cls="sm" /> Confidentiality</h2><p class="muted small" style="margin-top:4px">Choose how suppliers interact with this RFQ's contents.</p></div>
      <div class="choice">
        <button class=${"opt " + (f.confidentiality === "standard" ? "on" : "")} onClick=${() => setF({ ...f, confidentiality: "standard" })}>
          <span class="tile"><${Icon} n="globe" cls="sm" /></span><span><b>Standard</b><div class="small muted">Invited suppliers can view and quote without any additional acknowledgement.</div></span></button>
        <button class=${"opt " + (f.confidentiality === "confidential" ? "on" : "") + (plan.confidential ? "" : " locked")}
          onClick=${() => plan.confidential ? setF({ ...f, confidentiality: "confidential" }) : toast("Confidential RFQs are available on Starter Plus and above.", "err")}>
          <span class="tile"><${Icon} n="lock" cls="sm" /></span><span><b>Confidential</b> ${!plan.confidential && html`<span class="badge b-draft">Starter Plus+</span>`}<div class="small muted">Suppliers must acknowledge they will keep all RFQ details strictly confidential before they can view or quote.</div></span></button>
      </div>
    </div>

    <div class="card card-pad stack">
      <div><h2 class="row"><${Icon} n="book" cls="sm" /> Terms & Conditions *</h2><p class="muted small" style="margin-top:4px">Attach your purchase or contract terms. Suppliers must agree to them before submitting a quote.</p></div>
      <div class="choice three">${[["template", "book", "Use Template"], ["text", "edit", "Type / Paste"], ["pdf", "file", "Upload PDF"]].map(([m, ic, l]) => html`
        <button class=${"opt compact " + (f.terms_mode === m ? "on" : "")} onClick=${() => setF({ ...f, terms_mode: m, terms_text: m === "template" ? CFG.termsTemplate : m === "text" && f.terms_mode === "template" ? "" : f.terms_text })}>
          <span class="tile"><${Icon} n=${ic} cls="sm" /></span><b class="small">${l}</b></button>`)}</div>
      ${f.terms_mode === "pdf" ? html`<div class="row wrap">
          <label class="btn ghost"><${Icon} n="upload" cls="sm" /> ${f.terms_file ? "Replace PDF" : "Choose PDF"}<input type="file" accept="application/pdf,.pdf" hidden onChange=${uploadPdf} /></label>
          ${f.terms_file && html`<span class="row small"><${Icon} n="file" cls="sm" />${f.terms_file.name}</span>`}</div>`
        : html`<div class="field"><label for="tt">${f.terms_mode === "template" ? "Template (you can edit it)" : "Terms & Conditions text"}</label>
          <textarea id="tt" class="textarea" style="min-height:200px;font-size:13.5px" placeholder="Paste or type your purchase terms, contract conditions, delivery requirements..." value=${f.terms_text} onInput=${set("terms_text")}></textarea></div>`}
      <${Err} k="terms" />
    </div>

    <div class="card">
      <div class="card-head"><h2>Line Items</h2>
        <div class="row wrap" style="justify-content:flex-end">
          <button class="btn soft sm" onClick=${template} title="Download an Excel template"><${Icon} n="download" cls="sm" /> Template</button>
          <label class="btn ghost sm"><${Icon} n="sheet" cls="sm" /> Upload Excel<input type="file" accept=".xlsx,.xls,.csv" hidden onChange=${importExcel} /></label>
        </div></div>
      <div class="card-pad">
        <div class="scroll-x"><table class="table">
          <thead><tr><th style="width:30px">#</th><th>Description</th><th style="width:100px">Qty</th><th style="width:120px">Unit</th><th style="width:40px"></th></tr></thead>
          <tbody>${f.items.map((it, i) => html`<tr>
            <td class="muted" style="padding-top:18px">${i + 1}</td>
            <td><input class="input" placeholder="Item description" value=${it.description} onInput=${(e) => setItem(i, "description", e.target.value)} aria-label=${"Item " + (i + 1) + " description"} /></td>
            <td><input class="input num" type="number" min="0" step="any" value=${it.qty} onInput=${(e) => setItem(i, "qty", e.target.value)} aria-label="Quantity" /></td>
            <td><input class="input" list="units" value=${it.unit} onInput=${(e) => setItem(i, "unit", e.target.value)} aria-label="Unit" /></td>
            <td><button class="icon-btn" style="margin-top:4px" aria-label="Remove item" onClick=${() => setF({ ...f, items: f.items.length > 1 ? f.items.filter((_, j) => j !== i) : [newItem()] })}><${Icon} n="trash" cls="sm" /></button></td>
          </tr>`)}</tbody></table></div>
        <datalist id="units">${CFG.units.map((u) => html`<option value=${u} />`)}</datalist>
        <div class="row spread wrap" style="margin-top:12px">
          <button class="btn ghost sm" onClick=${() => setF({ ...f, items: [...f.items, newItem()] })}><${Icon} n="plus" cls="sm" /> Add item</button>
          <span class="hint">Excel columns: Description, Qty, Unit</span>
        </div>
        <${Err} k="items" />
      </div>
    </div>

    <div class="row" style="justify-content:flex-end">
      <a class="btn ghost" href=${editing ? "#/rfq/" + id : "#/dashboard"}>Cancel</a>
      <${Btn} onClick=${save} disabled=${atLimit}>${editing ? "Save changes" : "Create RFQ"}</${Btn}>
    </div>
  </div>`;
}
