// Account security screens for encrypted (live) mode:
// create keys + show the recovery code, unlock on a new device, and reset a forgotten password.
import { html, useState, Icon, Btn, toast, go, CFG } from "../ui.js";
import { store } from "../store.js";

const Shell = ({ title, sub, children }) => html`<div class="auth"><div class="card">
  <img class="logo" src="icons/icon-192.png" alt=${CFG.appName} />
  <h1 style="text-align:center;font-size:22px">${title}</h1>
  ${sub && html`<p class="muted" style="text-align:center;margin-top:4px">${sub}</p>`}
  <div style="margin-top:22px">${children}</div></div></div>`;

const SignOut = () => html`<p class="small" style="text-align:center;margin-top:16px">
  <a href="#/" onClick=${(e) => { e.preventDefault(); store.signOut().then(() => go("/")); }}>Sign out</a></p>`;

export function KeyGate({ user }) {
  if (user.key_status === "setup") return html`<${Setup} user=${user} />`;
  if (user.key_status === "reset") return html`<${Recover} user=${user} reset=${true} />`;
  return html`<${Unlock} user=${user} />`;
}

function Setup({ user }) {
  const [pw, setPw] = useState("");
  const [code, setCode] = useState(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const create = async (e) => {
    e?.preventDefault(); setErr(null);
    try { setCode(await store.setupKeys(pw)); setPw(""); } catch (x) { setErr(x.message); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(code); toast("Recovery code copied"); } catch { toast("Select the code and copy it manually", "err"); } };
  const download = () => {
    const text = `TenderHub recovery code\n\nAccount: ${user.email}\nRecovery code: ${code}\n\nKeep this somewhere safe. You need it to open your RFQs and quotes if you forget your password.\nTenderHub cannot recover it for you.\n`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = "TenderHub-recovery-code.txt"; a.click();
  };

  if (code) return html`<${Shell} title="Save your recovery code" sub="This is the only time it will be shown">
    <div class="stack">
      <div class="alert warn"><${Icon} n="alert" /><div class="small">If you forget your password, this code is the <b>only</b> way to open your RFQs and quotes again. TenderHub cannot see your data, so we cannot recover it for you.</div></div>
      <div class="num" style="font-size:20px;font-weight:700;letter-spacing:1px;text-align:center;padding:14px;border:2px dashed var(--line);border-radius:10px;user-select:all;word-break:break-all">${code}</div>
      <div class="row" style="gap:8px"><button class="btn ghost block" onClick=${copy}><${Icon} n="copy" cls="sm" /> Copy</button>
        <button class="btn ghost block" onClick=${download}><${Icon} n="download" cls="sm" /> Download</button></div>
      <label class="row small" style="cursor:pointer;align-items:flex-start"><input type="checkbox" style="margin-top:3px" checked=${saved} onChange=${(e) => setSaved(e.target.checked)} />
        <span>I have saved my recovery code somewhere safe (password manager, printed copy, or a secure note).</span></label>
      <${Btn} cls="primary block" disabled=${!saved} onClick=${() => store.finishSetup()}>Continue to TenderHub</${Btn}>
    </div></${Shell}>`;

  return html`<${Shell} title="Protect your data" sub="One-time setup for this account">
    <form class="stack" onSubmit=${create}>
      ${err && html`<div class="alert err">${err}</div>`}
      <div class="alert info"><${Icon} n="lock" /><div class="small">Your RFQs, item lists, prices and quotes are <b>encrypted on your device</b> before they are saved. Only you and the people you invite can read them — not other companies, and not TenderHub.</div></div>
      <div class="field"><label for="kpw">Confirm your password</label>
        <input id="kpw" class="input" type="password" autocomplete="current-password" required value=${pw} onInput=${(e) => setPw(e.target.value)} />
        <span class="hint">We'll create your personal encryption keys and give you a recovery code.</span></div>
      <${Btn} type="submit" cls="primary block" onClick=${create}>Create my keys</${Btn}>
    </form><${SignOut} /></${Shell}>`;
}

function Unlock({ user }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(null);
  const [forgot, setForgot] = useState(false);
  if (forgot) return html`<${Recover} user=${user} onBack=${() => setForgot(false)} />`;
  const submit = async (e) => { e?.preventDefault(); setErr(null); try { await store.unlock(pw); } catch (x) { setErr(x.message); } };
  return html`<${Shell} title="Unlock your data" sub=${"Enter your password to open your RFQs and quotes on this device"}>
    <form class="stack" onSubmit=${submit}>
      ${err && html`<div class="alert err">${err}</div>`}
      <div class="field"><label>Account</label><input class="input" value=${user.email} disabled /></div>
      <div class="field"><label for="upw">Password</label><input id="upw" class="input" type="password" autocomplete="current-password" required value=${pw} onInput=${(e) => setPw(e.target.value)} /></div>
      <${Btn} type="submit" cls="primary block" onClick=${submit}>Unlock</${Btn}>
      <p class="small" style="text-align:center"><a href="#" onClick=${(e) => { e.preventDefault(); setForgot(true); }}>Forgot your password? Use your recovery code</a></p>
    </form><${SignOut} /></${Shell}>`;
}

function Recover({ user, reset, onBack }) {
  const [f, setF] = useState({ code: "", pw: "", pw2: "" });
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e?.preventDefault(); setErr(null);
    if (f.pw !== f.pw2) return setErr("The two new passwords don't match.");
    try { await store.recover(f.code, f.pw); toast("New password set — your data is unlocked"); } catch (x) { setErr(x.message); }
  };
  return html`<${Shell} title=${reset ? "Set a new password" : "Use your recovery code"} sub="Your recovery code unlocks your encrypted data">
    <form class="stack" onSubmit=${submit}>
      ${err && html`<div class="alert err">${err}</div>`}
      <div class="field"><label for="rc">Recovery code</label>
        <input id="rc" class="input num" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" required value=${f.code} onInput=${(e) => setF({ ...f, code: e.target.value })} />
        <span class="hint">The code you saved when you first set up your account.</span></div>
      <div class="field"><label for="np">New password</label><input id="np" class="input" type="password" minlength="6" autocomplete="new-password" required value=${f.pw} onInput=${(e) => setF({ ...f, pw: e.target.value })} /></div>
      <div class="field"><label for="np2">Repeat new password</label><input id="np2" class="input" type="password" minlength="6" autocomplete="new-password" required value=${f.pw2} onInput=${(e) => setF({ ...f, pw2: e.target.value })} /></div>
      <${Btn} type="submit" cls="primary block" onClick=${submit}>Set password & unlock</${Btn}>
      <p class="tiny muted" style="text-align:center">Lost your recovery code too? Your encrypted RFQs and quotes cannot be recovered — not even by TenderHub. Contact support to reset your account and start fresh.</p>
      ${onBack && html`<p class="small" style="text-align:center"><a href="#" onClick=${(e) => { e.preventDefault(); onBack(); }}>Back</a></p>`}
    </form><${SignOut} /></${Shell}>`;
}
