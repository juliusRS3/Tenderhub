// LIVE data store — uses your Supabase project (set the keys in config.js).
const CFG = window.TENDERHUB_CONFIG;
const lc = (s) => (s || "").trim().toLowerCase();

let sb = null;
let profile = null;
let listeners = [];

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Could not load " + src)); document.head.appendChild(s); });
}
const ok = ({ data, error }) => { if (error) throw new Error(friendly(error.message)); return data; };
function friendly(msg) {
  if (/row-level security/i.test(msg)) return "You don't have permission to do that (or the RFQ is closed).";
  if (/duplicate key.*invitations/i.test(msg)) return "This supplier is already invited.";
  if (/Invalid login credentials/i.test(msg)) return "Wrong email or password.";
  return msg;
}
function requireMe() { if (!profile) throw new Error("Please sign in again."); return profile; }

async function loadProfile(user) {
  if (!user) { profile = null; return null; }
  let p = ok(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
  if (!p) { // trigger may take a moment right after sign-up
    await new Promise((r) => setTimeout(r, 800));
    p = ok(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
  }
  if (!p) throw new Error("Your profile could not be loaded. Please check the database setup (schema.sql).");
  const adm = ok(await sb.from("admins").select("email").maybeSingle());
  profile = { ...p, is_admin: !!adm };
  return profile;
}
const emit = () => listeners.forEach((f) => f(profile));
async function log(rfq_id, action) {
  const m = requireMe();
  await sb.from("events").insert({ rfq_id, actor: m.company || m.name, action });
}

export const store = {
  mode: "live",
  demoAccounts: [],

  async init() {
    if (!window.supabase) await loadScript("js/vendor/supabase.js");
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await sb.auth.getSession();
    await loadProfile(data.session?.user);
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED") return;
      const same = profile && session?.user?.id === profile.id;
      if (!same) { await loadProfile(session?.user).catch(() => (profile = null)); emit(); }
    });
    return profile;
  },
  onAuth(fn) { listeners.push(fn); return () => (listeners = listeners.filter((f) => f !== fn)); },

  async signUp({ email, password, name }) {
    const data = ok(await sb.auth.signUp({ email: lc(email), password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } }));
    if (!data.session) return { needsConfirmation: true };
    await loadProfile(data.user); emit(); return { needsConfirmation: false };
  },
  async signIn({ email, password }) {
    const data = ok(await sb.auth.signInWithPassword({ email: lc(email), password }));
    await loadProfile(data.user); emit();
  },
  async resetPassword(email) {
    ok(await sb.auth.resetPasswordForEmail(lc(email), { redirectTo: location.origin + location.pathname + "#/settings" }));
  },
  async signOut() { await sb.auth.signOut(); profile = null; emit(); },

  // ---- profile
  async updateProfile(patch) {
    const m = requireMe(); const clean = {};
    ["name", "company", "role"].forEach((k) => { if (k in patch) clean[k] = patch[k]; });
    const p = ok(await sb.from("profiles").update(clean).eq("id", m.id).select().single());
    profile = { ...p, is_admin: m.is_admin }; emit(); return profile;
  },
  async searchSuppliers(q) {
    const m = requireMe(); q = (q || "").trim().replace(/[%,()]/g, ""); if (q.length < 2) return [];
    return ok(await sb.from("profiles").select("id,name,company,email").neq("id", m.id)
      .or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`).limit(8));
  },
  async adminListProfiles() { return ok(await sb.rpc("admin_profiles")); },
  async adminSetPlan(userId, plan) { ok(await sb.rpc("admin_set_plan", { u: userId, p: plan })); },

  // ---- RFQs
  async listMyRfqs() {
    const m = requireMe();
    const rows = ok(await sb.from("rfqs").select("*, quotes(count), invitations(count)").eq("owner_id", m.id).order("created_at", { ascending: false }));
    return rows.map((r) => ({ ...r, quote_count: r.quotes?.[0]?.count || 0, invite_count: r.invitations?.[0]?.count || 0 }));
  },
  async getRfq(id) {
    const r = ok(await sb.from("rfqs").select("*").eq("id", id).maybeSingle());
    if (!r) throw new Error("RFQ not found, or you don't have access to it.");
    return r;
  },
  async createRfq(data) {
    const m = requireMe();
    const r = ok(await sb.from("rfqs").insert({ ...data, owner_id: m.id, owner_name: m.name, owner_company: m.company }).select().single());
    await log(r.id, "Created RFQ (draft)"); return r;
  },
  async updateRfq(id, patch) {
    const r = ok(await sb.from("rfqs").update(patch).eq("id", id).select().single());
    const action = patch.status === "open" ? "Published / reopened RFQ" : patch.status === "closed" ? "Closed RFQ" : "Edited RFQ";
    await log(id, action); return r;
  },
  async deleteRfq(id) { ok(await sb.from("rfqs").delete().eq("id", id)); },

  // ---- invitations
  async listInvitations(rfqId) {
    const inv = ok(await sb.from("invitations").select("*").eq("rfq_id", rfqId).order("created_at"));
    if (!inv.length) return [];
    const profs = ok(await sb.from("profiles").select("email,name,company").in("email", inv.map((i) => lc(i.email))));
    return inv.map((i) => { const p = profs.find((x) => lc(x.email) === lc(i.email)); return { ...i, name: p?.name || null, company: p?.company || null, registered: !!p }; });
  },
  async invite(rfqId, email) {
    const m = requireMe(); email = lc(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Please enter a valid email address.");
    if (email === lc(m.email)) throw new Error("You can't invite yourself.");
    const i = ok(await sb.from("invitations").insert({ rfq_id: rfqId, email }).select().single());
    await log(rfqId, `Invited ${email}`); return i;
  },
  async removeInvitation(id) { ok(await sb.from("invitations").delete().eq("id", id)); },
  async listMyInvitations() {
    const m = requireMe();
    const inv = ok(await sb.from("invitations").select("*, rfq:rfqs(*)").eq("email", lc(m.email)));
    const visible = inv.filter((i) => i.rfq && i.rfq.status !== "draft");
    const quotes = visible.length ? ok(await sb.from("quotes").select("*").eq("supplier_id", m.id)) : [];
    return visible.map((i) => ({ invitation: i, rfq: i.rfq, myQuote: quotes.find((q) => q.rfq_id === i.rfq_id) || null }));
  },
  async acknowledge(rfqId) { ok(await sb.rpc("acknowledge_rfq", { r: rfqId })); await log(rfqId, "Acknowledged confidentiality"); },
  async myInvitation(rfqId) {
    const m = requireMe();
    return ok(await sb.from("invitations").select("*").eq("rfq_id", rfqId).eq("email", lc(m.email)).maybeSingle());
  },

  // ---- quotes
  async listQuotes(rfqId) { return ok(await sb.from("quotes").select("*").eq("rfq_id", rfqId)); },
  async getMyQuote(rfqId) {
    const m = requireMe();
    return ok(await sb.from("quotes").select("*").eq("rfq_id", rfqId).eq("supplier_id", m.id).maybeSingle());
  },
  async submitQuote(rfqId, d) {
    const m = requireMe();
    const fields = { items: d.items, lead_time_days: d.lead_time_days, validity_days: d.validity_days, notes: d.notes || "", terms_accepted: !!d.terms_accepted, updated_at: new Date().toISOString() };
    const existing = await this.getMyQuote(rfqId);
    let q;
    if (existing) { q = ok(await sb.from("quotes").update(fields).eq("id", existing.id).select().single()); await log(rfqId, "Updated their quote"); }
    else { q = ok(await sb.from("quotes").insert({ rfq_id: rfqId, supplier_id: m.id, ...fields }).select().single()); await log(rfqId, "Submitted a quote"); }
    return q;
  },
  async award(rfqId, quoteId) { ok(await sb.rpc("award_quote", { r: rfqId, q: quoteId })); await log(rfqId, "Awarded the RFQ"); },

  // ---- Q&A
  async listQuestions(rfqId) { return ok(await sb.from("questions").select("*").eq("rfq_id", rfqId).order("created_at")); },
  async ask(rfqId, question) { const m = requireMe(); ok(await sb.from("questions").insert({ rfq_id: rfqId, asker_id: m.id, question })); await log(rfqId, "Asked a clarification question"); },
  async answer(questionId, answer) {
    const q = ok(await sb.from("questions").update({ answer, answered_at: new Date().toISOString() }).eq("id", questionId).select().single());
    await log(q.rfq_id, "Answered a clarification question");
  },

  async listEvents(rfqId) { return ok(await sb.from("events").select("*").eq("rfq_id", rfqId).order("created_at", { ascending: false })); },

  // ---- files
  async uploadFile(file) {
    const m = requireMe();
    if (file.size > 10 * 1024 * 1024) throw new Error("PDF must be under 10 MB.");
    const path = `${m.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    ok(await sb.storage.from("rfq-files").upload(path, file, { contentType: file.type || "application/pdf" }));
    return { name: file.name, path };
  },
  async fileUrl(f) {
    if (!f?.path) return null;
    const d = ok(await sb.storage.from("rfq-files").createSignedUrl(f.path, 3600));
    return d.signedUrl;
  },

  // ---- support
  async listMySupport() { const m = requireMe(); return ok(await sb.from("support_messages").select("*").eq("user_id", m.id).order("created_at")); },
  async sendSupport(body) { const m = requireMe(); ok(await sb.from("support_messages").insert({ user_id: m.id, user_email: m.email, user_name: m.name, body })); },
  async adminThreads() {
    const rows = ok(await sb.from("support_messages").select("*").order("created_at"));
    const by = {}; rows.forEach((s) => { (by[s.user_id] ||= []).push(s); });
    return Object.values(by).map((msgs) => ({ user_id: msgs[0].user_id, user_email: msgs[0].user_email, user_name: msgs[0].user_name, last: msgs[msgs.length - 1] }))
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  },
  async adminThread(userId) { return ok(await sb.from("support_messages").select("*").eq("user_id", userId).order("created_at")); },
  async adminReply(userId, body) {
    const u = ok(await sb.from("profiles").select("email,name").eq("id", userId).single());
    ok(await sb.from("support_messages").insert({ user_id: userId, user_email: u.email, user_name: u.name, from_admin: true, body }));
  }
};
