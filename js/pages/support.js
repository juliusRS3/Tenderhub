import { html, useState, useEffect, useRef, Icon, Btn, toast, errToast, CFG, useLoad, Loading, ErrorBox, Empty, fmtDate, fmtDateTime, planOf } from "../ui.js";
import { store } from "../store.js";

function Messages({ msgs, mineIsAdmin }) {
  const end = useRef();
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  return html`<div class="msgs">${msgs.map((m) => html`<div class=${"bubble " + (m.from_admin === mineIsAdmin ? "mine" : "theirs")}>${m.body}<div class="t">${m.from_admin ? "Support" : m.user_name} · ${fmtDateTime(m.created_at)}</div></div>`)}<div ref=${end}></div></div>`;
}
function Composer({ onSend, placeholder }) {
  const [t, setT] = useState("");
  const send = async () => { const v = t.trim(); if (!v) return; await onSend(v); setT(""); };
  return html`<div class="composer">
    <textarea class="textarea" style="min-height:44px;height:44px" placeholder=${placeholder} value=${t} onInput=${(e) => setT(e.target.value)}
      onKeyDown=${(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send().catch(errToast); } }} aria-label="Message"></textarea>
    <${Btn} onClick=${send} title="Send"><${Icon} n="send" cls="sm" /></${Btn}></div>`;
}
function usePoll(reload, ms = 15000) { useEffect(() => { const t = setInterval(reload, ms); return () => clearInterval(t); }, [reload]); }

export function Support({ user }) {
  const { data, loading, error, reload } = useLoad(() => store.listMySupport(), []);
  usePoll(reload);
  return html`<div class="page stack" style="max-width:820px">
    <div class="row"><span class="ic-tile" style="margin:0"><${Icon} n="help" /></span><div><h1 style="font-size:20px">Technical Support</h1><p class="muted small">Send a message and our team will respond as soon as possible. You can also email <a href=${"mailto:" + CFG.supportEmail}>${CFG.supportEmail}</a>.</p></div></div>
    <div class="card chat">
      ${loading ? html`<${Loading} />` : error ? html`<div class="card-pad"><${ErrorBox} error=${error} /></div>` :
        data.length === 0 ? html`<div class="msgs" style="justify-content:center"><${Empty} icon="help" title="No messages yet">Describe your issue below and our support team will get back to you.</${Empty}></div>` :
        html`<${Messages} msgs=${data} mineIsAdmin=${false} />`}
      <${Composer} placeholder="Describe your issue or question… (Enter to send, Shift+Enter for new line)" onSend=${async (v) => { await store.sendSupport(v); reload(); }} />
    </div></div>`;
}

export function AdminInbox() {
  const threads = useLoad(() => store.adminThreads(), []);
  const [sel, setSel] = useState(null);
  const thread = useLoad(() => (sel ? store.adminThread(sel) : Promise.resolve([])), [sel]);
  usePoll(threads.reload); usePoll(thread.reload);
  const cur = threads.data?.find((t) => t.user_id === sel);
  return html`<div class="page stack" style="max-width:1100px">
    <div><h1 class="row" style="font-size:22px"><${Icon} n="shield" /> Support Inbox</h1><p class="muted small">Manage technical assistance requests from users</p></div>
    <div class="card inbox">
      <div class="threads">${threads.loading ? html`<${Loading} />` : threads.error ? html`<div class="card-pad"><${ErrorBox} error=${threads.error} /></div>` :
        threads.data.length === 0 ? html`<${Empty} icon="msg" title="No support messages">When users send support requests, they'll appear here.</${Empty}>` :
        threads.data.map((t) => html`<button class=${"thread " + (t.user_id === sel ? "on" : "")} onClick=${() => setSel(t.user_id)}>
          <div class="row spread"><b class="small">${t.user_name || t.user_email}</b><span class="tiny faint">${fmtDate(t.last.created_at)}</span></div>
          <div class="tiny muted">${t.user_email}</div>
          <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${t.last.from_admin ? "You: " : ""}${t.last.body}</div>
          ${!t.last.from_admin && html`<span class="badge b-closed" style="margin-top:4px">Needs reply</span>`}</button>`)}</div>
      <div class="chat" style="height:auto;min-height:480px">${!sel ? html`<div class="msgs" style="justify-content:center"><${Empty} icon="msg" title="Select a conversation">Choose a thread from the list to view and reply</${Empty}></div>` : html`
        <div class="card-head"><div><b>${cur?.user_name}</b><div class="tiny muted">${cur?.user_email}</div></div></div>
        ${thread.loading && !thread.data ? html`<${Loading} />` : html`<${Messages} msgs=${thread.data || []} mineIsAdmin=${true} />`}
        <${Composer} placeholder="Type your reply…" onSend=${async (v) => { await store.adminReply(sel, v); thread.reload(); threads.reload(); }} />`}</div>
    </div></div>`;
}

export function AdminUsers() {
  const { data, loading, error, reload } = useLoad(() => store.adminListProfiles(), []);
  const [q, setQ] = useState("");
  const setPlan = async (u, plan) => { try { await store.adminSetPlan(u.id, plan); toast(`${u.email} moved to ${planOf(plan).name}`); reload(); } catch (e) { errToast(e); } };
  const rows = (data || []).filter((u) => !q || [u.email, u.name, u.company].join(" ").toLowerCase().includes(q.toLowerCase()));
  return html`<div class="page stack" style="max-width:1100px">
    <div class="row spread wrap"><div><h1 class="row" style="font-size:22px"><${Icon} n="users" /> Users & Plans</h1><p class="muted small">Activate a plan after a customer's PayPal payment arrives.</p></div>
      <input class="input" style="max-width:260px" placeholder="Search users…" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Search users" /></div>
    <div class="card scroll-x">${loading ? html`<${Loading} />` : error ? html`<div class="card-pad"><${ErrorBox} error=${error} /></div>` : html`
      <table class="table"><thead><tr><th>User</th><th>Company</th><th>View</th><th class="r">Active RFQs</th><th>Plan</th><th>Joined</th></tr></thead>
      <tbody>${rows.map((u) => html`<tr>
        <td><div style="font-weight:600">${u.name}</div><div class="tiny muted">${u.email}</div></td>
        <td class="small">${u.company || "—"}</td><td class="small">${u.role ? u.role[0].toUpperCase() + u.role.slice(1) : "—"}</td>
        <td class="r num">${u.active_rfqs}</td>
        <td><select class="select" style="padding:6px 30px 6px 10px;font-size:13.5px;min-width:140px" value=${u.plan} onChange=${(e) => setPlan(u, e.target.value)} aria-label=${"Plan for " + u.email}>
          ${CFG.plans.map((p) => html`<option value=${p.id}>${p.name}</option>`)}</select></td>
        <td class="small muted">${fmtDate(u.created_at)}</td></tr>`)}</tbody></table>`}
    </div></div>`;
}
