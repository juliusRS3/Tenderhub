import { html, useState, Icon, Btn, toast, go, CFG, planOf } from "../ui.js";
import { store } from "../store.js";

const Shell = ({ title, sub, children }) => html`<div class="auth"><div class="card">
  <a href="#/"><img class="logo" src="icons/icon-192.png" alt=${CFG.appName} /></a>
  <h1 style="text-align:center;font-size:22px">${title}</h1>
  ${sub && html`<p class="muted" style="text-align:center;margin-top:4px">${sub}</p>`}
  <div style="margin-top:22px">${children}</div></div></div>`;

export function Login({ note }) {
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e?.preventDefault(); setErr(null);
    try { await store.signIn(f); } catch (x) { setErr(x.message); }
  };
  const demo = async (email) => { setErr(null); try { await store.signIn({ email, password: "demo1234" }); } catch (x) { setErr(x.message); } };
  return html`<${Shell} title="Welcome back" sub=${note || "Sign in to your TenderHub account"}>
    <form class="stack" onSubmit=${submit}>
      ${err && html`<div class="alert err">${err}</div>`}
      <div class="field"><label for="em">Email</label><input id="em" class="input" type="email" autocomplete="email" required value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} /></div>
      <div class="field"><div class="row spread"><label for="pw" class="lbl">Password</label><a class="small" href="#/forgot">Forgot password?</a></div>
        <input id="pw" class="input" type="password" autocomplete="current-password" required value=${f.password} onInput=${(e) => setF({ ...f, password: e.target.value })} /></div>
      <${Btn} type="submit" cls="primary block" onClick=${submit}>Sign in</${Btn}>
      <p class="small muted" style="text-align:center">New to TenderHub? <a href="#/signup">Create an account</a></p>
    </form>
    ${store.mode === "demo" && html`<div class="demo-accts stack-sm" style="margin-top:22px;padding-top:18px;border-top:1px solid var(--line)">
      <div class="lbl">Try a demo account <span class="muted" style="font-weight:400">(password demo1234)</span></div>
      ${store.demoAccounts.map((a) => html`<button class="btn ghost sm" onClick=${() => demo(a.email)}><span>${a.label}</span><${Icon} n="right" cls="sm" /></button>`)}
    </div>`}
  </${Shell}>`;
}

export function Signup() {
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState(null);
  const [sent, setSent] = useState(false);
  const submit = async (e) => {
    e?.preventDefault(); setErr(null);
    try { const r = await store.signUp(f); if (r.needsConfirmation) setSent(true); } catch (x) { setErr(x.message); }
  };
  if (sent) return html`<${Shell} title="Check your email" sub=${"We sent a confirmation link to " + f.email + ". Click it, then sign in."}>
    <a class="btn primary block" href="#/login">Go to sign in</a></${Shell}>`;
  return html`<${Shell} title="Create your account" sub="Free to get started — no credit card needed">
    <form class="stack" onSubmit=${submit}>
      ${err && html`<div class="alert err">${err}</div>`}
      <div class="field"><label for="nm">Full name</label><input id="nm" class="input" required autocomplete="name" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></div>
      <div class="field"><label for="em2">Work email</label><input id="em2" class="input" type="email" required autocomplete="email" value=${f.email} onInput=${(e) => setF({ ...f, email: e.target.value })} />
        <span class="hint">Suppliers: use the same email the buyer invited, so their RFQs appear automatically.</span></div>
      <div class="field"><label for="pw2">Password</label><input id="pw2" class="input" type="password" minlength="6" required autocomplete="new-password" value=${f.password} onInput=${(e) => setF({ ...f, password: e.target.value })} /><span class="hint">At least 6 characters.</span></div>
      <p class="tiny muted">By creating an account you agree to the <a href="#/terms" target="_blank">Terms of Use</a> and acknowledge the <a href="#/privacy" target="_blank">Privacy Policy</a>.</p>
      <${Btn} type="submit" cls="primary block" onClick=${submit}>Create account</${Btn}>
      <p class="small muted" style="text-align:center">Already have an account? <a href="#/login">Sign in</a></p>
    </form></${Shell}>`;
}

export function Forgot() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async (e) => { e?.preventDefault(); setErr(null); try { await store.resetPassword(email); setDone(true); } catch (x) { setErr(x.message); } };
  return html`<${Shell} title="Reset password" sub="We'll email you a link to set a new password">
    ${done ? html`<div class="alert ok">If an account exists for ${email}, a reset link is on its way.</div>` : html`
    <form class="stack" onSubmit=${submit}>
      ${err && html`<div class="alert err">${err}</div>`}
      <div class="field"><label for="fe">Email</label><input id="fe" class="input" type="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} /></div>
      <${Btn} type="submit" cls="primary block" onClick=${submit}>Send reset link</${Btn}>
    </form>`}
    <p class="small" style="text-align:center;margin-top:16px"><a href="#/login">Back to sign in</a></p></${Shell}>`;
}

export function Welcome({ user }) {
  const [role, setRole] = useState(null);
  const [company, setCompany] = useState(user.company || "");
  const go2 = async () => {
    await store.updateProfile({ role, company: company.trim() });
    go(role === "buyer" ? "/dashboard" : "/invitations");
  };
  return html`<${Shell} title="Welcome to TenderHub" sub="Tell us how you'll be using the platform">
    <div class="stack">
      <div class="lbl">I am a…</div>
      <div class="choice">
        <button class=${"opt " + (role === "buyer" ? "on" : "")} onClick=${() => setRole("buyer")} style="flex-direction:column">
          <span class="tile"><${Icon} n="cart" /></span><span><b>Buyer</b><div class="tiny muted">I create RFQs and manage procurement</div></span></button>
        <button class=${"opt " + (role === "supplier" ? "on" : "")} onClick=${() => setRole("supplier")} style="flex-direction:column">
          <span class="tile"><${Icon} n="box" /></span><span><b>Supplier</b><div class="tiny muted">I receive RFQs and submit quotes</div></span></button>
      </div>
      <div class="field"><label for="co">Company name <span class="muted" style="font-weight:400">(optional)</span></label>
        <input id="co" class="input" placeholder="Acme Corporation" value=${company} onInput=${(e) => setCompany(e.target.value)} /></div>
      <${Btn} cls="primary block" disabled=${!role} onClick=${go2}>Continue</${Btn}>
      <p class="tiny muted" style="text-align:center">You can switch between Buyer and Supplier views at any time.</p>
    </div></${Shell}>`;
}

export function Settings({ user }) {
  const [f, setF] = useState({ name: user.name || "", company: user.company || "" });
  const save = async () => { await store.updateProfile(f); toast("Profile saved"); };
  const plan = planOf(user.plan);
  return html`<div class="page narrow stack">
    <h1>Account settings</h1>
    <div class="card card-pad stack">
      <h2>Profile</h2>
      <div class="grid2">
        <div class="field"><label>Full name</label><input class="input" value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></div>
        <div class="field"><label>Company</label><input class="input" value=${f.company} onInput=${(e) => setF({ ...f, company: e.target.value })} /></div>
      </div>
      <div class="field"><label>Email</label><input class="input" value=${user.email} disabled /></div>
      <div><${Btn} onClick=${save}>Save changes</${Btn}></div>
    </div>
    <div class="card card-pad row spread wrap">
      <div><h2>Plan</h2><p class="muted small">${plan.name} — ${plan.limit === Infinity ? "unlimited" : plan.limit} active RFQs</p></div>
      <a class="btn ghost" href="#/billing">Manage plan</a>
    </div>
    ${store.mode === "live" && html`<${ChangePassword} />`}
    <div class="card card-pad row spread wrap">
      <div><h2>Sign out</h2><p class="muted small">Sign out of TenderHub on this device.</p></div>
      <${Btn} cls="ghost" onClick=${() => store.signOut().then(() => go("/"))}><${Icon} n="logout" cls="sm" /> Sign out</${Btn}>
    </div>
  </div>`;
}

function ChangePassword() {
  const [f, setF] = useState({ cur: "", pw: "", pw2: "" });
  const save = async () => {
    if (f.pw !== f.pw2) throw new Error("The two new passwords don't match.");
    await store.changePassword(f.cur, f.pw); setF({ cur: "", pw: "", pw2: "" }); toast("Password changed");
  };
  return html`<div class="card card-pad stack">
    <div><h2>Password & encryption</h2><p class="muted small">Your RFQs and quotes are encrypted on your device. Your password unlocks them; keep your recovery code safe in case you forget it.</p></div>
    <div class="grid3">
      <div class="field"><label>Current password</label><input class="input" type="password" autocomplete="current-password" value=${f.cur} onInput=${(e) => setF({ ...f, cur: e.target.value })} /></div>
      <div class="field"><label>New password</label><input class="input" type="password" minlength="6" autocomplete="new-password" value=${f.pw} onInput=${(e) => setF({ ...f, pw: e.target.value })} /></div>
      <div class="field"><label>Repeat new password</label><input class="input" type="password" minlength="6" autocomplete="new-password" value=${f.pw2} onInput=${(e) => setF({ ...f, pw2: e.target.value })} /></div>
    </div>
    <div><${Btn} cls="ghost" disabled=${!f.cur || !f.pw} onClick=${save}><${Icon} n="key" cls="sm" /> Change password</${Btn}></div>
  </div>`;
}
