// LIVE data store — uses your Supabase project (set the keys in config.js).
// RFQ content, quotes, Q&A, activity and attachments are encrypted in this
// browser (see crypto.js) before anything is sent to the database.
import * as K from "./crypto.js";

const CFG = window.TENDERHUB_CONFIG;
const lc = (s) => (s || "").trim().toLowerCase();

let sb = null;
let profile = null;
let listeners = [];
let priv = null;              // my unlocked private key (memory only)
let pendingPassword = null;   // password just typed at sign-in, used once to unlock
let recovering = false;       // arrived from a "reset password" email
let signingIn = false;
const keys = new Map();       // rfq id -> RFQ key

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
function requireKey() { if (!priv) throw new Error("Your data is locked on this device. Please sign in again."); return priv; }

// Which RFQ content is encrypted. Everything else (status, deadline, confidentiality) stays readable for the access rules.
const OPEN_FIELDS = ["status", "deadline", "confidentiality"];
const LOCKED_RFQ = { title: "Locked RFQ — open the buyer's invitation link", description: "", requirements: "", incoterm: "", delivery_place: "", currency: "USD",
  terms_mode: "template", terms_text: "", terms_file: null, items: [], _locked: true };

// ------------------------------------------------------------------ profile & keys
async function loadProfile(user) {
  if (!user) { profile = null; priv = null; keys.clear(); return null; }
  let p = ok(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
  if (!p) { // trigger may take a moment right after sign-up
    await new Promise((r) => setTimeout(r, 800));
    p = ok(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
  }
  if (!p) throw new Error("Your profile could not be loaded. Please check the database setup (supabase/schema.sql).");
  const adm = ok(await sb.from("admins").select("email").maybeSingle());

  let key_status = "ok";
  if (recovering) key_status = "reset";
  else if (!p.public_key) key_status = "setup";
  else {
    if (!priv || profile?.id !== p.id) priv = await K.deviceLoad(p.id);
    if (!priv && pendingPassword && p.key_pw) {
      try { priv = await K.unlockPrivate(p.key_pw, pendingPassword); await K.deviceSave(p.id, priv); } catch { priv = null; }
    }
    if (!priv) key_status = "locked";
  }
  pendingPassword = null;
  profile = { ...p, is_admin: !!adm, key_status };
  return profile;
}
const emit = () => listeners.forEach((f) => f(profile));
const setStatus = (s) => { profile = { ...profile, key_status: s }; emit(); };

async function saveKeys(patch) {
  const m = requireMe();
  const p = ok(await sb.from("profiles").update(patch).eq("id", m.id).select().single());
  profile = { ...p, is_admin: m.is_admin, key_status: m.key_status };
}

// ------------------------------------------------------------------ RFQ keys
function linkSecretFor(rfqId) {
  const [path, qs] = location.hash.replace(/^#/, "").split("?");
  if (!qs || !path.includes(rfqId)) return null;
  return new URLSearchParams(qs).get("k");
}
async function loadKeys(ids) {
  const m = requireMe(); const need = [...new Set(ids)].filter((id) => !keys.has(id));
  if (!need.length) return;
  const rows = ok(await sb.from("rfq_keys").select("rfq_id,wrapped").eq("user_id", m.id).in("rfq_id", need));
  await Promise.all(rows.map(async (r) => { try { keys.set(r.rfq_id, await K.openKey(r.wrapped, requireKey())); } catch {} }));
}
async function rfqKey(rfqId) {
  await loadKeys([rfqId]);
  if (keys.has(rfqId)) return keys.get(rfqId);
  // A supplier arriving through the buyer's invitation link: the link carries the secret.
  const secret = linkSecretFor(rfqId);
  if (secret) {
    const m = requireMe();
    const inv = ok(await sb.from("invitations").select("link_key").eq("rfq_id", rfqId).eq("email", lc(m.email)).maybeSingle());
    if (inv?.link_key) {
      const k = await K.openLinkKey(inv.link_key, secret).catch(() => null);
      if (k) {
        await sb.from("rfq_keys").upsert({ rfq_id: rfqId, user_id: m.id, wrapped: await K.keyFor(k, m.public_key) }, { ignoreDuplicates: true });
        keys.set(rfqId, k); return k;
      }
    }
  }
  return null;
}
// Buyer side: give the RFQ key to every invited supplier who has an account but no key yet.
async function shareKeys(rfqIds) {
  if (!rfqIds.length) return;
  await loadKeys(rfqIds);
  const inv = ok(await sb.from("invitations").select("rfq_id,email").in("rfq_id", rfqIds));
  if (!inv.length) return;
  const have = ok(await sb.from("rfq_keys").select("rfq_id,user_id").in("rfq_id", rfqIds));
  const users = ok(await sb.rpc("directory_lookup", { emails: [...new Set(inv.map((i) => i.email))] }));
  const rows = [];
  for (const i of inv) {
    const u = users.find((x) => lc(x.email) === lc(i.email)); const k = keys.get(i.rfq_id);
    if (!u?.public_key || !k || have.some((h) => h.rfq_id === i.rfq_id && h.user_id === u.id)) continue;
    rows.push({ rfq_id: i.rfq_id, user_id: u.id, wrapped: await K.keyFor(k, u.public_key) });
  }
  if (rows.length) ok(await sb.from("rfq_keys").upsert(rows, { ignoreDuplicates: true }));
}
const quiet = (p) => p.catch((e) => console.warn("TenderHub:", e.message));

async function readRfq(row) {
  if (!row) return row;
  const { enc, quotes, invitations, ...meta } = row;
  const k = keys.get(row.id);
  if (!k) return { ...meta, ...LOCKED_RFQ };
  try { return { ...meta, ...(await K.open(k, enc)) }; } catch { return { ...meta, ...LOCKED_RFQ }; }
}
async function readQuote(q) {
  if (!q) return q;
  const m = requireMe(); const { enc, key_supplier, key_buyer, ...meta } = q;
  try {
    const k = await K.openKey(q.supplier_id === m.id ? key_supplier : key_buyer, requireKey());
    return { ...meta, ...(await K.open(k, enc)) };
  } catch { return { ...meta, items: [], notes: "(This quote could not be unlocked.)", _locked: true }; }
}

async function log(rfq_id, action) {
  const m = requireMe(); const k = keys.get(rfq_id); if (!k) return;
  await sb.from("events").insert({ rfq_id, enc: await K.seal(k, { actor: m.company || m.name, action }) });
}

// ------------------------------------------------------------------ API
export const store = {
  mode: "live",
  demoAccounts: [],

  async init() {
    if (/type=recovery/.test(location.hash)) recovering = true;
    if (!window.supabase) await loadScript("js/vendor/supabase.js");
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") { recovering = true; if (profile) { setStatus("reset"); return; } }
      if (event === "TOKEN_REFRESHED" || (event === "SIGNED_IN" && signingIn)) return;
      const same = profile && session?.user?.id === profile.id;
      if (!same) { await loadProfile(session?.user).catch(() => (profile = null)); emit(); }
    });
    const { data } = await sb.auth.getSession();
    await loadProfile(data.session?.user);
    return profile;
  },
  onAuth(fn) { listeners.push(fn); return () => (listeners = listeners.filter((f) => f !== fn)); },

  async signUp({ email, password, name }) {
    signingIn = true;
    const data = await sb.auth.signUp({ email: lc(email), password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } }).finally(() => (signingIn = false));
    const d = ok(data);
    if (!d.session) return { needsConfirmation: true };
    pendingPassword = password; await loadProfile(d.user); emit(); return { needsConfirmation: false };
  },
  async signIn({ email, password }) {
    signingIn = true;
    try {
      const data = ok(await sb.auth.signInWithPassword({ email: lc(email), password }));
      if (profile?.id !== data.user.id || profile.key_status === "locked") { pendingPassword = password; await loadProfile(data.user); }
    } finally { signingIn = false; }
    emit();
  },
  async resetPassword(email) {
    ok(await sb.auth.resetPasswordForEmail(lc(email), { redirectTo: location.origin + location.pathname }));
  },
  async signOut() { await sb.auth.signOut(); await K.deviceClear(); profile = null; priv = null; keys.clear(); recovering = false; emit(); },

  // ---- encryption keys (account security)
  /** First time: create my key pair. Returns the recovery code to show once. */
  async setupKeys(password) {
    const m = requireMe();
    signingIn = true;
    try { ok(await sb.auth.signInWithPassword({ email: m.email, password })); }   // confirm it's really you
    finally { signingIn = false; }
    const pair = await K.newKeyPair(); const code = K.newRecoveryCode();
    await saveKeys({
      public_key: await K.exportPublic(pair.publicKey),
      key_pw: await K.lockPrivate(pair.privateKey, password),
      key_rec: await K.lockPrivate(pair.privateKey, K.codeSecret(code))
    });
    priv = await K.deviceCopy(pair.privateKey); await K.deviceSave(m.id, priv);
    return code;
  },
  finishSetup() { setStatus("ok"); },
  async unlock(password) {
    const m = requireMe();
    try { priv = await K.unlockPrivate(m.key_pw, password); }
    catch { throw new Error("That password doesn't match. Use the password you last signed in with."); }
    await K.deviceSave(m.id, priv); setStatus("ok");
  },
  /** Unlock with the recovery code and set a new password (forgotten password). */
  async recover(code, newPassword) {
    const m = requireMe();
    if (!newPassword || newPassword.length < 6) throw new Error("New password must be at least 6 characters.");
    let full;
    try { full = await K.unlockPrivate(m.key_rec, K.codeSecret(code), true); }
    catch { throw new Error("That recovery code doesn't match. Check it and try again."); }
    ok(await sb.auth.updateUser({ password: newPassword }));
    await saveKeys({ key_pw: await K.lockPrivate(full, newPassword) });
    priv = await K.deviceCopy(full); await K.deviceSave(m.id, priv);
    recovering = false; if (/type=recovery/.test(location.hash)) location.hash = "#/";
    setStatus("ok");
  },
  async changePassword(current, next) {
    const m = requireMe();
    if (!next || next.length < 6) throw new Error("New password must be at least 6 characters.");
    let full;
    try { full = await K.unlockPrivate(m.key_pw, current, true); }
    catch { throw new Error("Your current password is not correct."); }
    ok(await sb.auth.updateUser({ password: next }));
    await saveKeys({ key_pw: await K.lockPrivate(full, next) });
  },

  // ---- profile
  async updateProfile(patch) {
    const m = requireMe(); const clean = {};
    ["name", "company", "role"].forEach((k) => { if (k in patch) clean[k] = patch[k]; });
    const p = ok(await sb.from("profiles").update(clean).eq("id", m.id).select().single());
    profile = { ...p, is_admin: m.is_admin, key_status: m.key_status }; emit(); return profile;
  },
  async searchSuppliers(q) {
    q = (q || "").trim(); if (q.length < 2) return [];
    return ok(await sb.rpc("directory_search", { q }));
  },
  async adminListProfiles() { return ok(await sb.rpc("admin_profiles")); },
  async adminSetPlan(userId, plan) { ok(await sb.rpc("admin_set_plan", { u: userId, p: plan })); },

  // ---- RFQs
  async listMyRfqs() {
    const m = requireMe();
    const rows = ok(await sb.from("rfqs").select("*, quotes(count), invitations(count)").eq("owner_id", m.id).order("created_at", { ascending: false }));
    await loadKeys(rows.map((r) => r.id));
    quiet(shareKeys(rows.filter((r) => ["draft", "open"].includes(r.status)).map((r) => r.id)));
    return Promise.all(rows.map(async (r) => ({ ...(await readRfq(r)), quote_count: r.quotes?.[0]?.count || 0, invite_count: r.invitations?.[0]?.count || 0 })));
  },
  async getRfq(id) {
    const m = requireMe();
    const r = ok(await sb.from("rfqs").select("*").eq("id", id).maybeSingle());
    if (!r) throw new Error("RFQ not found, or you don't have access to it.");
    await rfqKey(id);
    if (r.owner_id === m.id) quiet(shareKeys([id]));
    return readRfq(r);
  },
  async createRfq(data) {
    const m = requireMe(); const k = await K.newKey();
    const open = {}, secret = {};
    Object.entries(data).forEach(([key, v]) => ((OPEN_FIELDS.includes(key) ? open : secret)[key] = v));
    const r = ok(await sb.from("rfqs").insert({ ...open, enc: await K.seal(k, secret) }).select().single());
    const saved = await sb.from("rfq_keys").insert({ rfq_id: r.id, user_id: m.id, wrapped: await K.keyFor(k, m.public_key) });
    if (saved.error) { await sb.from("rfqs").delete().eq("id", r.id); throw new Error(friendly(saved.error.message)); }
    keys.set(r.id, k);
    await log(r.id, "Created RFQ (draft)"); return readRfq(r);
  },
  async updateRfq(id, patch) {
    const open = {}, secret = {};
    Object.entries(patch).forEach(([key, v]) => ((OPEN_FIELDS.includes(key) ? open : secret)[key] = v));
    if (Object.keys(secret).length) {
      const k = await rfqKey(id); if (!k) throw new Error("This RFQ is locked on this device.");
      const cur = ok(await sb.from("rfqs").select("enc").eq("id", id).single());
      open.enc = await K.seal(k, { ...(await K.open(k, cur.enc)), ...secret });
    }
    const r = ok(await sb.from("rfqs").update(open).eq("id", id).select().single());
    if (patch.status === "open") await shareKeys([id]);
    const action = patch.status === "open" ? "Published / reopened RFQ" : patch.status === "closed" ? "Closed RFQ" : "Edited RFQ";
    await log(id, action); return readRfq(r);
  },
  async deleteRfq(id) { ok(await sb.from("rfqs").delete().eq("id", id)); keys.delete(id); },

  // ---- invitations
  async listInvitations(rfqId) {
    const inv = ok(await sb.from("invitations").select("*").eq("rfq_id", rfqId).order("created_at"));
    if (!inv.length) return [];
    const k = await rfqKey(rfqId);
    const profs = ok(await sb.rpc("directory_lookup", { emails: inv.map((i) => i.email) }));
    const base = CFG.appUrl.replace(/\/$/, "");
    return Promise.all(inv.map(async ({ link_key, link_secret, ...i }) => {
      const p = profs.find((x) => lc(x.email) === lc(i.email));
      let link = `${base}/#/quote/${rfqId}`;
      if (k && link_secret) { try { link += "?k=" + (await K.open(k, link_secret)); } catch {} }
      return { ...i, name: p?.name || null, company: p?.company || null, registered: !!p, link };
    }));
  },
  async invite(rfqId, email) {
    const m = requireMe(); email = lc(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Please enter a valid email address.");
    if (email === lc(m.email)) throw new Error("You can't invite yourself.");
    const k = await rfqKey(rfqId); if (!k) throw new Error("This RFQ is locked on this device.");
    const secret = K.newLinkSecret();
    const i = ok(await sb.from("invitations").insert({ rfq_id: rfqId, email, link_key: await K.keyForLink(k, secret), link_secret: await K.seal(k, secret) }).select().single());
    await quiet(shareKeys([rfqId]));
    await log(rfqId, `Invited ${email}`); return i;
  },
  async removeInvitation(id) {
    const i = ok(await sb.from("invitations").select("rfq_id,email").eq("id", id).maybeSingle());
    ok(await sb.from("invitations").delete().eq("id", id));
    if (i) {
      const u = ok(await sb.rpc("directory_lookup", { emails: [i.email] }))[0];
      if (u) await sb.from("rfq_keys").delete().eq("rfq_id", i.rfq_id).eq("user_id", u.id);
      await log(i.rfq_id, `Removed invitation for ${i.email}`);
    }
  },
  async listMyInvitations() {
    const m = requireMe();
    const inv = ok(await sb.from("invitations").select("id,rfq_id,email,acknowledged,created_at, rfq:rfqs(*)").eq("email", lc(m.email)));
    const visible = inv.filter((i) => i.rfq && i.rfq.status !== "draft");
    await loadKeys(visible.map((i) => i.rfq_id));
    const quotes = visible.length ? await Promise.all(ok(await sb.from("quotes").select("*").eq("supplier_id", m.id)).map(readQuote)) : [];
    return Promise.all(visible.map(async ({ rfq, ...i }) => ({ invitation: i, rfq: await readRfq(rfq), myQuote: quotes.find((q) => q.rfq_id === i.rfq_id) || null })));
  },
  async acknowledge(rfqId) { ok(await sb.rpc("acknowledge_rfq", { r: rfqId })); await rfqKey(rfqId); await log(rfqId, "Acknowledged confidentiality"); },
  async myInvitation(rfqId) {
    const m = requireMe();
    return ok(await sb.from("invitations").select("id,rfq_id,email,acknowledged,created_at").eq("rfq_id", rfqId).eq("email", lc(m.email)).maybeSingle());
  },

  // ---- quotes
  async listQuotes(rfqId) { return Promise.all(ok(await sb.from("quotes").select("*").eq("rfq_id", rfqId)).map(readQuote)); },
  async getMyQuote(rfqId) {
    const m = requireMe();
    return readQuote(ok(await sb.from("quotes").select("*").eq("rfq_id", rfqId).eq("supplier_id", m.id).maybeSingle()));
  },
  async submitQuote(rfqId, d) {
    const m = requireMe();
    const content = { items: d.items, lead_time_days: d.lead_time_days, validity_days: d.validity_days, notes: d.notes || "", terms_accepted: !!d.terms_accepted };
    const buyerKey = ok(await sb.rpc("rfq_owner_key", { r: rfqId }));
    if (!buyerKey) throw new Error("The buyer's account isn't ready to receive encrypted quotes yet.");
    const existing = ok(await sb.from("quotes").select("id,key_supplier").eq("rfq_id", rfqId).eq("supplier_id", m.id).maybeSingle());
    const k = existing ? await K.openKey(existing.key_supplier, requireKey()) : await K.newKey();
    const fields = { enc: await K.seal(k, content), key_supplier: await K.keyFor(k, m.public_key), key_buyer: await K.keyFor(k, buyerKey) };
    let q;
    if (existing) { q = ok(await sb.from("quotes").update(fields).eq("id", existing.id).select().single()); await log(rfqId, "Updated their quote"); }
    else { q = ok(await sb.from("quotes").insert({ rfq_id: rfqId, ...fields }).select().single()); await log(rfqId, "Submitted a quote"); }
    return readQuote(q);
  },
  async award(rfqId, quoteId) { ok(await sb.rpc("award_quote", { r: rfqId, q: quoteId })); await log(rfqId, "Awarded the RFQ"); },

  // ---- Q&A
  async listQuestions(rfqId) {
    const rows = ok(await sb.from("questions").select("id,rfq_id,asker_label,enc_question,enc_answer,created_at,answered_at").eq("rfq_id", rfqId).order("created_at"));
    const k = await rfqKey(rfqId);
    return Promise.all(rows.map(async ({ enc_question, enc_answer, ...q }) => {
      if (!k) return { ...q, question: "(locked)", answer: null };
      return { ...q, question: await K.open(k, enc_question).catch(() => "(unreadable)"), answer: enc_answer ? await K.open(k, enc_answer).catch(() => "(unreadable)") : null };
    }));
  },
  async ask(rfqId, question) {
    const k = await rfqKey(rfqId); if (!k) throw new Error("This RFQ is locked on this device.");
    ok(await sb.from("questions").insert({ rfq_id: rfqId, enc_question: await K.seal(k, question) }));
    await log(rfqId, "Asked a clarification question");
  },
  async answer(questionId, answer) {
    const q0 = ok(await sb.from("questions").select("rfq_id").eq("id", questionId).single());
    const k = await rfqKey(q0.rfq_id); if (!k) throw new Error("This RFQ is locked on this device.");
    ok(await sb.from("questions").update({ enc_answer: await K.seal(k, answer) }).eq("id", questionId));
    await log(q0.rfq_id, "Answered a clarification question");
  },

  async listEvents(rfqId) {
    const rows = ok(await sb.from("events").select("*").eq("rfq_id", rfqId).order("created_at", { ascending: false }));
    const k = await rfqKey(rfqId);
    return Promise.all(rows.map(async ({ enc, ...e }) => ({ ...e, ...(k ? await K.open(k, enc).catch(() => ({ actor: "", action: "(unreadable)" })) : { actor: "", action: "(locked)" }) })));
  },

  // ---- files (encrypted before upload; the file's key lives inside the encrypted RFQ)
  async uploadFile(file) {
    const m = requireMe();
    if (file.size > 10 * 1024 * 1024) throw new Error("PDF must be under 10 MB.");
    const k = await K.newKey();
    const body = await K.sealBytes(k, await file.arrayBuffer());
    const path = `${m.id}/${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.bin`;
    ok(await sb.storage.from("rfq-files").upload(path, new Blob([body]), { contentType: "application/octet-stream" }));
    return { name: file.name, path, key: await K.exportKeyB64(k) };
  },
  async fileUrl(f) {
    if (!f?.path || !f.key) return null;
    const blob = ok(await sb.storage.from("rfq-files").download(f.path));
    const plain = await K.openBytes(await K.importKeyB64(f.key), await blob.arrayBuffer());
    return URL.createObjectURL(new Blob([plain], { type: "application/pdf" }));
  },

  // ---- support (not encrypted, so the admin can help)
  async listMySupport() { const m = requireMe(); return ok(await sb.from("support_messages").select("*").eq("user_id", m.id).order("created_at")); },
  async sendSupport(body) { const m = requireMe(); ok(await sb.from("support_messages").insert({ user_id: m.id, body })); },
  async adminThreads() {
    const rows = ok(await sb.from("support_messages").select("*").order("created_at"));
    const by = {}; rows.forEach((s) => { (by[s.user_id] ||= []).push(s); });
    return Object.values(by).map((msgs) => ({ user_id: msgs[0].user_id, user_email: msgs[0].user_email, user_name: msgs[0].user_name, last: msgs[msgs.length - 1] }))
      .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
  },
  async adminThread(userId) { return ok(await sb.from("support_messages").select("*").eq("user_id", userId).order("created_at")); },
  async adminReply(userId, body) { ok(await sb.from("support_messages").insert({ user_id: userId, from_admin: true, body })); }
};
