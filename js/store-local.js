// DEMO MODE data store — everything is kept in this browser (localStorage).
// It follows the same rules as the Supabase backend so the app behaves the same.
const KEY = "tenderhub_demo_db_v1";
const SESSION = "tenderhub_demo_session";
const CFG = window.TENDERHUB_CONFIG;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const now = () => new Date().toISOString();
const lc = (s) => (s || "").trim().toLowerCase();
const clone = (o) => JSON.parse(JSON.stringify(o));

let db = null;
let listeners = [];

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { console.warn("Storage unavailable", e); } }
function safeDel(k) { try { localStorage.removeItem(k); } catch {} }

function load() {
  if (db) return db;
  const raw = safeGet(KEY);
  db = raw ? JSON.parse(raw) : seed();
  if (!raw) save();
  return db;
}
function save() { safeSet(KEY, JSON.stringify(db)); }

function seed() {
  const d = { profiles: [], rfqs: [], invitations: [], quotes: [], questions: [], support: [], events: [], passwords: {} };
  const mk = (email, name, company, role) => {
    const p = { id: uid(), email, name, company, role, plan: "free", created_at: now() };
    d.profiles.push(p); d.passwords[email] = "demo1234"; return p;
  };
  const buyer = mk("buyer@demo.tenderhub", "Julius T", "Pacific Edge Trading Sdn Bhd", "buyer");
  const s1 = mk("sales@gulfoffice.demo", "Aisha Rahman", "Gulf Office Supplies LLC", "supplier");
  const s2 = mk("quotes@klpaper.demo", "Daniel Lim", "KL Paper Trading Sdn Bhd", "supplier");
  mk("bids@musandam.demo", "Omar Al Balushi", "Musandam Industrial Co.", "supplier");
  const day = 864e5;
  const items = [
    { id: uid(), description: "A4 photocopy paper 80gsm, 500 sheets/ream", qty: 200, unit: "ream" },
    { id: uid(), description: "A3 photocopy paper 80gsm, 500 sheets/ream", qty: 40, unit: "ream" },
    { id: uid(), description: "Box files, PVC, foolscap", qty: 120, unit: "pcs" }
  ];
  const r = {
    id: uid(), owner_id: buyer.id, owner_name: buyer.name, owner_company: buyer.company,
    title: "Supply of A4 & A3 Photocopy Paper", description: "Quarterly supply of photocopy paper and box files for the Muscat office.",
    requirements: "Original brand only. Delivery within 14 days of PO.", deadline: new Date(Date.now() + 5 * day).toISOString(),
    incoterm: "DDP", delivery_place: "Muscat, Oman", currency: "USD", confidentiality: "standard",
    terms_mode: "template", terms_text: CFG.termsTemplate, terms_file: null, items, status: "open",
    awarded_quote_id: null, created_at: new Date(Date.now() - 2 * day).toISOString(), published_at: new Date(Date.now() - 2 * day).toISOString()
  };
  d.rfqs.push(r);
  [s1, s2].forEach((s) => d.invitations.push({ id: uid(), rfq_id: r.id, email: s.email, acknowledged: false, created_at: r.published_at }));
  d.quotes.push({
    id: uid(), rfq_id: r.id, supplier_id: s1.id, supplier_name: s1.name, supplier_company: s1.company, supplier_email: s1.email,
    items: [{ item_id: items[0].id, unit_price: 4.6 }, { item_id: items[1].id, unit_price: 9.2 }, { item_id: items[2].id, unit_price: 2.1 }],
    lead_time_days: 10, validity_days: 30, notes: "Brand: Double A. Free delivery to site.", terms_accepted: true,
    status: "submitted", created_at: new Date(Date.now() - day).toISOString(), updated_at: new Date(Date.now() - day).toISOString()
  });
  d.questions.push({ id: uid(), rfq_id: r.id, asker_id: s2.id, asker_label: "Supplier B", question: "Is an equivalent brand acceptable if it meets 80gsm?", answer: null, created_at: now(), answered_at: null });
  d.events.push({ id: uid(), rfq_id: r.id, actor: buyer.name, action: "Created RFQ", created_at: r.created_at });
  d.events.push({ id: uid(), rfq_id: r.id, actor: buyer.name, action: "Published RFQ and invited 2 suppliers", created_at: r.published_at });
  d.events.push({ id: uid(), rfq_id: r.id, actor: s1.company, action: "Submitted a quote", created_at: d.quotes[0].created_at });
  return d;
}

// ------------------------------------------------------------- helpers
function me() {
  const id = safeGet(SESSION);
  return id ? load().profiles.find((p) => p.id === id) || null : null;
}
function requireMe() { const m = me(); if (!m) throw new Error("Please sign in again."); return m; }
// In demo mode the demo buyer is also an admin, so you can try the admin pages.
const isAdmin = (p) => !!p && [...CFG.adminEmails, "buyer@demo.tenderhub"].map(lc).includes(lc(p.email));
function withAdmin(p) { return p ? { ...clone(p), is_admin: isAdmin(p) } : null; }
function rfqById(id) { const r = load().rfqs.find((x) => x.id === id); if (!r) throw new Error("RFQ not found"); return r; }
function invitedTo(rfq, p) { return load().invitations.find((i) => i.rfq_id === rfq.id && lc(i.email) === lc(p.email)); }
function canSee(rfq, p) { return rfq.owner_id === p.id || (rfq.status !== "draft" && !!invitedTo(rfq, p)); }
function log(rfq_id, actor, action) { load().events.push({ id: uid(), rfq_id, actor, action, created_at: now() }); }
function emit() { const s = withAdmin(me()); listeners.forEach((f) => f(s)); }
const tick = (v) => new Promise((res) => setTimeout(() => res(clone(v)), 60));

// ------------------------------------------------------------- API
export const store = {
  mode: "demo",
  demoAccounts: [
    { email: "buyer@demo.tenderhub", label: "Buyer — Pacific Edge Trading" },
    { email: "sales@gulfoffice.demo", label: "Supplier — Gulf Office Supplies" },
    { email: "quotes@klpaper.demo", label: "Supplier — KL Paper Trading" }
  ],

  // ---- auth
  async init() { load(); return withAdmin(me()); },
  onAuth(fn) { listeners.push(fn); return () => (listeners = listeners.filter((f) => f !== fn)); },
  async signUp({ email, password, name }) {
    load(); email = lc(email);
    if (!email || !password) throw new Error("Email and password are required.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    if (db.profiles.some((p) => lc(p.email) === email)) throw new Error("An account with this email already exists. Please sign in.");
    const p = { id: uid(), email, name: name || email.split("@")[0], company: "", role: null, plan: "free", created_at: now() };
    db.profiles.push(p); db.passwords[email] = password; save();
    safeSet(SESSION, p.id); emit(); return { needsConfirmation: false };
  },
  async signIn({ email, password }) {
    load(); email = lc(email);
    const p = db.profiles.find((x) => lc(x.email) === email);
    if (!p || db.passwords[email] !== password) throw new Error("Wrong email or password.");
    safeSet(SESSION, p.id); emit();
  },
  async resetPassword() { throw new Error("Password reset emails work once Supabase is connected. Demo password is demo1234."); },
  async signOut() { safeDel(SESSION); emit(); },
  resetDemo() { safeDel(KEY); safeDel(SESSION); db = null; load(); emit(); },

  // ---- profile
  async updateProfile(patch) {
    const m = requireMe(); const allowed = ["name", "company", "role"];
    allowed.forEach((k) => { if (k in patch) m[k] = patch[k]; }); save(); emit(); return tick(withAdmin(m));
  },
  async searchSuppliers(q) {
    const m = requireMe(); q = lc(q); if (q.length < 2) return [];
    return tick(load().profiles.filter((p) => p.id !== m.id && (lc(p.name).includes(q) || lc(p.company).includes(q) || lc(p.email).includes(q)))
      .slice(0, 8).map((p) => ({ id: p.id, name: p.name, company: p.company, email: p.email })));
  },
  async adminListProfiles() {
    if (!isAdmin(requireMe())) throw new Error("Admins only");
    return tick(load().profiles.map((p) => {
      const active = db.rfqs.filter((r) => r.owner_id === p.id && ["draft", "open"].includes(r.status)).length;
      return { ...p, active_rfqs: active };
    }));
  },
  async demoSetPlan(plan) { const m = requireMe(); m.plan = plan; save(); emit(); },
  async adminSetPlan(userId, plan) {
    if (!isAdmin(requireMe())) throw new Error("Admins only");
    const p = load().profiles.find((x) => x.id === userId); p.plan = plan; save(); emit(); return tick(p);
  },

  // ---- RFQs (buyer)
  async listMyRfqs() {
    const m = requireMe(); load();
    return tick(db.rfqs.filter((r) => r.owner_id === m.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => ({
      ...r, quote_count: db.quotes.filter((q) => q.rfq_id === r.id).length, invite_count: db.invitations.filter((i) => i.rfq_id === r.id).length
    })));
  },
  async getRfq(id) {
    const m = requireMe(); const r = rfqById(id);
    if (!canSee(r, m)) throw new Error("You don't have access to this RFQ.");
    return tick(r);
  },
  async createRfq(data) {
    const m = requireMe(); load();
    const r = { ...data, id: uid(), owner_id: m.id, owner_name: m.name, owner_company: m.company, status: "draft", awarded_quote_id: null, created_at: now(), published_at: null };
    db.rfqs.push(r); log(r.id, m.name, "Created RFQ (draft)"); save(); return tick(r);
  },
  async updateRfq(id, patch) {
    const m = requireMe(); const r = rfqById(id);
    if (r.owner_id !== m.id) throw new Error("Only the RFQ owner can change it.");
    Object.assign(r, patch);
    if (patch.status === "open" && !r.published_at) { r.published_at = now(); log(id, m.name, "Published RFQ"); }
    else if (patch.status === "closed") log(id, m.name, "Closed RFQ");
    else if (patch.status === "open") log(id, m.name, "Reopened RFQ / extended deadline");
    else log(id, m.name, "Edited RFQ");
    save(); return tick(r);
  },
  async deleteRfq(id) {
    const m = requireMe(); const r = rfqById(id);
    if (r.owner_id !== m.id) throw new Error("Only the RFQ owner can delete it.");
    ["invitations", "quotes", "questions", "events"].forEach((t) => (db[t] = db[t].filter((x) => x.rfq_id !== id)));
    db.rfqs = db.rfqs.filter((x) => x.id !== id); save();
  },

  // ---- invitations
  async listInvitations(rfqId) {
    const m = requireMe(); const r = rfqById(rfqId); if (r.owner_id !== m.id) return [];
    return tick(db.invitations.filter((i) => i.rfq_id === rfqId).map((i) => {
      const p = db.profiles.find((x) => lc(x.email) === lc(i.email));
      return { ...i, name: p?.name || null, company: p?.company || null, registered: !!p };
    }));
  },
  async invite(rfqId, email) {
    const m = requireMe(); const r = rfqById(rfqId); email = lc(email);
    if (r.owner_id !== m.id) throw new Error("Only the RFQ owner can invite suppliers.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Please enter a valid email address.");
    if (email === lc(m.email)) throw new Error("You can't invite yourself.");
    if (db.invitations.some((i) => i.rfq_id === rfqId && lc(i.email) === email)) throw new Error("This supplier is already invited.");
    const i = { id: uid(), rfq_id: rfqId, email, acknowledged: false, created_at: now() };
    db.invitations.push(i); log(rfqId, m.name, `Invited ${email}`); save(); return tick(i);
  },
  async removeInvitation(id) {
    const m = requireMe(); const i = load().invitations.find((x) => x.id === id); if (!i) return;
    const r = rfqById(i.rfq_id); if (r.owner_id !== m.id) throw new Error("Not allowed");
    db.invitations = db.invitations.filter((x) => x.id !== id); log(r.id, m.name, `Removed invitation for ${i.email}`); save();
  },
  async listMyInvitations() {
    const m = requireMe(); load();
    return tick(db.invitations.filter((i) => lc(i.email) === lc(m.email)).map((i) => {
      const rfq = db.rfqs.find((r) => r.id === i.rfq_id);
      if (!rfq || rfq.status === "draft") return null;
      const myQuote = db.quotes.find((q) => q.rfq_id === rfq.id && q.supplier_id === m.id) || null;
      return { invitation: i, rfq, myQuote };
    }).filter(Boolean));
  },
  async acknowledge(rfqId) {
    const m = requireMe(); const r = rfqById(rfqId); const i = invitedTo(r, m);
    if (!i) throw new Error("You are not invited to this RFQ.");
    i.acknowledged = true; log(rfqId, m.company || m.name, "Acknowledged confidentiality"); save();
  },
  async myInvitation(rfqId) { const m = requireMe(); return tick(invitedTo(rfqById(rfqId), m) || null); },

  // ---- quotes
  async listQuotes(rfqId) {
    const m = requireMe(); const r = rfqById(rfqId);
    if (r.owner_id !== m.id) throw new Error("Only the buyer can see all quotes.");
    return tick(db.quotes.filter((q) => q.rfq_id === rfqId));
  },
  async getMyQuote(rfqId) { const m = requireMe(); return tick(load().quotes.find((q) => q.rfq_id === rfqId && q.supplier_id === m.id) || null); },
  async submitQuote(rfqId, data) {
    const m = requireMe(); const r = rfqById(rfqId); const inv = invitedTo(r, m);
    if (!inv) throw new Error("You are not invited to this RFQ.");
    if (r.status !== "open" || new Date(r.deadline) < new Date()) throw new Error("This RFQ is no longer accepting quotes.");
    if (r.confidentiality === "confidential" && !inv.acknowledged) throw new Error("Please acknowledge confidentiality first.");
    let q = db.quotes.find((x) => x.rfq_id === rfqId && x.supplier_id === m.id);
    const fields = { items: data.items, lead_time_days: data.lead_time_days, validity_days: data.validity_days, notes: data.notes, terms_accepted: !!data.terms_accepted, updated_at: now() };
    if (q) { Object.assign(q, fields); log(rfqId, m.company || m.name, "Updated their quote"); }
    else {
      q = { id: uid(), rfq_id: rfqId, supplier_id: m.id, supplier_name: m.name, supplier_company: m.company, supplier_email: m.email, status: "submitted", created_at: now(), ...fields };
      db.quotes.push(q); log(rfqId, m.company || m.name, "Submitted a quote");
    }
    save(); return tick(q);
  },
  async award(rfqId, quoteId) {
    const m = requireMe(); const r = rfqById(rfqId);
    if (r.owner_id !== m.id) throw new Error("Only the buyer can award.");
    db.quotes.filter((q) => q.rfq_id === rfqId).forEach((q) => (q.status = q.id === quoteId ? "awarded" : "not_awarded"));
    const w = db.quotes.find((q) => q.id === quoteId);
    r.status = "awarded"; r.awarded_quote_id = quoteId; log(rfqId, m.name, `Awarded to ${w.supplier_company || w.supplier_name}`); save();
  },

  // ---- clarification Q&A
  async listQuestions(rfqId) {
    const m = requireMe(); const r = rfqById(rfqId); if (!canSee(r, m)) return [];
    return tick(db.questions.filter((q) => q.rfq_id === rfqId).sort((a, b) => a.created_at.localeCompare(b.created_at)));
  },
  async ask(rfqId, question) {
    const m = requireMe(); const r = rfqById(rfqId); if (!invitedTo(r, m)) throw new Error("Only invited suppliers can ask questions.");
    const n = db.invitations.filter((i) => i.rfq_id === rfqId).findIndex((i) => lc(i.email) === lc(m.email));
    db.questions.push({ id: uid(), rfq_id: rfqId, asker_id: m.id, asker_label: "Supplier " + String.fromCharCode(65 + Math.max(0, n)), question, answer: null, created_at: now(), answered_at: null });
    log(rfqId, m.company || m.name, "Asked a clarification question"); save();
  },
  async answer(questionId, answer) {
    const m = requireMe(); const q = load().questions.find((x) => x.id === questionId); const r = rfqById(q.rfq_id);
    if (r.owner_id !== m.id) throw new Error("Only the buyer can answer.");
    q.answer = answer; q.answered_at = now(); log(r.id, m.name, "Answered a clarification question"); save();
  },

  // ---- activity log
  async listEvents(rfqId) {
    const m = requireMe(); const r = rfqById(rfqId); if (r.owner_id !== m.id) return [];
    return tick(db.events.filter((e) => e.rfq_id === rfqId).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  },

  // ---- files (T&C PDF) — demo keeps the file inside the browser
  async uploadFile(file) {
    if (file.size > 3 * 1024 * 1024) throw new Error("In demo mode PDFs must be under 3 MB.");
    const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
    return { name: file.name, path: dataUrl };
  },
  async fileUrl(f) { return f?.path || null; },

  // ---- support chat
  async listMySupport() { const m = requireMe(); return tick(load().support.filter((s) => s.user_id === m.id)); },
  async sendSupport(body) {
    const m = requireMe(); load().support.push({ id: uid(), user_id: m.id, user_email: m.email, user_name: m.name, from_admin: false, body, created_at: now() }); save();
  },
  async adminThreads() {
    if (!isAdmin(requireMe())) throw new Error("Admins only");
    const by = {}; load().support.forEach((s) => { (by[s.user_id] ||= []).push(s); });
    return tick(Object.values(by).map((msgs) => ({ user_id: msgs[0].user_id, user_email: msgs[0].user_email, user_name: msgs[0].user_name, last: msgs[msgs.length - 1] }))
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at)));
  },
  async adminThread(userId) { if (!isAdmin(requireMe())) throw new Error("Admins only"); return tick(load().support.filter((s) => s.user_id === userId)); },
  async adminReply(userId, body) {
    const m = requireMe(); if (!isAdmin(m)) throw new Error("Admins only");
    const u = db.profiles.find((p) => p.id === userId);
    db.support.push({ id: uid(), user_id: userId, user_email: u?.email, user_name: u?.name, from_admin: true, body, created_at: now() }); save();
  }
};
