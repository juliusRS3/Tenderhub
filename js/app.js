import { html, render, useState, useEffect, useRef, Icon, Toasts, ConfirmHost, go, initials, CFG, errToast } from "./ui.js";
import { store } from "./store.js";
import { Landing } from "./pages/landing.js";
import { Login, Signup, Forgot, Welcome, Settings } from "./pages/auth.js";
import { BuyerDashboard, RfqForm } from "./pages/buyer.js";
import { RfqDetail, Compare } from "./pages/rfq.js";
import { Invitations, QuotePage } from "./pages/supplier.js";
import { Billing } from "./pages/billing.js";
import { Support, AdminInbox, AdminUsers } from "./pages/support.js";
import { KeyGate } from "./pages/keys.js";
import { Terms, Privacy } from "./pages/legal.js";

function useHash() {
  const get = () => (location.hash.replace(/^#/, "") || "/");
  const [h, set] = useState(get());
  useEffect(() => { const f = () => { set(get()); window.scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
}

function match(path) {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  const [a, b, c] = parts;
  if (!a) return { page: "home" };
  if (a === "rfq" && b === "new") return { page: "new" };
  if (a === "rfq" && b && c === "edit") return { page: "edit", id: b };
  if (a === "rfq" && b && c === "compare") return { page: "compare", id: b };
  if (a === "rfq" && b) return { page: "rfq", id: b };
  if (a === "quote" && b) return { page: "quote", id: b };
  if (a === "admin" && b) return { page: "admin-" + b };
  return { page: a };
}

const PUBLIC = ["home", "login", "signup", "forgot"];

function App() {
  const [user, setUser] = useState(undefined);
  const [bootErr, setBootErr] = useState(null);
  const path = useHash();
  const route = match(path);
  const hadUser = useRef(false);
  if (user) hadUser.current = true;

  useEffect(() => {
    store.init().then(setUser).catch((e) => { setBootErr(e); setUser(null); });
    return store.onAuth((u) => {
      setUser((prev) => {
        // Signing out: go to the home page instead of remembering this page for the next person.
        if (prev && !u) { sessionStorageSafe("del"); if (!/^#\/(login|signup)?$/.test(location.hash)) location.hash = "#/"; }
        return u;
      });
    });
  }, []);

  if (user === undefined) return html`<div class="boot"><div class="spinner"></div></div>`;

  // Legal pages are open to everyone, signed in or not.
  if (route.page === "terms") return html`<${Terms} />`;
  if (route.page === "privacy") return html`<${Privacy} />`;

  // ---- signed out
  if (!user) {
    let page;
    if (route.page === "login") page = html`<${Login} />`;
    else if (route.page === "signup") page = html`<${Signup} />`;
    else if (route.page === "forgot") page = html`<${Forgot} />`;
    else if (route.page === "home") page = html`<${Landing} />`;
    else { if (!hadUser.current) sessionStorageSafe("set", path); page = html`<${Login} note="Please sign in to continue." />`; }
    return html`${bootErr && html`<div class="demo-bar" style="background:#991b1b">Could not connect to the server: ${bootErr.message}</div>`}${page}`;
  }

  // ---- signed in, but encryption keys need setting up / unlocking on this device
  if (user.key_status && user.key_status !== "ok") return html`<${KeyGate} user=${user} />`;

  // ---- signed in, first time: pick buyer / supplier
  if (!user.role) return html`<${Welcome} user=${user} />`;

  if (PUBLIC.includes(route.page)) {
    const back = sessionStorageSafe("get");
    if (back && route.page !== "home") { sessionStorageSafe("del"); setTimeout(() => go(back)); }
    else setTimeout(() => go(user.role === "buyer" ? "/dashboard" : "/invitations"));
    return html`<div class="boot"><div class="spinner"></div></div>`;
  }

  let page;
  switch (route.page) {
    case "dashboard": page = html`<${BuyerDashboard} user=${user} />`; break;
    case "new": page = html`<${RfqForm} user=${user} />`; break;
    case "edit": page = html`<${RfqForm} user=${user} id=${route.id} />`; break;
    case "rfq": page = html`<${RfqDetail} user=${user} id=${route.id} />`; break;
    case "compare": page = html`<${Compare} user=${user} id=${route.id} />`; break;
    case "invitations": page = html`<${Invitations} user=${user} />`; break;
    case "quote": page = html`<${QuotePage} user=${user} id=${route.id} />`; break;
    case "billing": page = html`<${Billing} user=${user} />`; break;
    case "support": page = html`<${Support} user=${user} />`; break;
    case "settings": page = html`<${Settings} user=${user} />`; break;
    case "admin-support": page = user.is_admin ? html`<${AdminInbox} />` : null; break;
    case "admin-users": page = user.is_admin ? html`<${AdminUsers} />` : null; break;
  }
  if (!page) page = html`<div class="page"><div class="empty" style="padding:80px 0"><div style="font-size:48px;font-weight:800;color:var(--ink-2)">404</div><p>This page does not exist.</p><a class="btn primary" style="margin-top:14px" href="#/">Return to home</a></div></div>`;
  return html`<${Shell} user=${user} route=${route}>${page}</${Shell}>`;
}

function sessionStorageSafe(op, v) {
  try { if (op === "set") sessionStorage.setItem("th_next", v); else if (op === "get") return sessionStorage.getItem("th_next"); else sessionStorage.removeItem("th_next"); } catch { return null; }
}

function Shell({ user, route, children }) {
  const [menu, setMenu] = useState(false);
  const buyer = user.role === "buyer";
  const p = route.page;
  const on = (...names) => (names.includes(p) ? "on" : "");
  const switchMode = async (role) => {
    if (role === user.role) return;
    try { await store.updateProfile({ role }); go(role === "buyer" ? "/dashboard" : "/invitations"); } catch (e) { errToast(e); }
  };
  const nav = buyer
    ? [["/dashboard", "grid", "Dashboard", on("dashboard", "rfq", "compare", "edit")], ["/rfq/new", "plus", "New RFQ", on("new")], ["/billing", "card", "Billing", on("billing")], ["/support", "help", "Support", on("support")]]
    : [["/invitations", "grid", "Invitations", on("invitations", "quote", "rfq")], ["/support", "help", "Support", on("support")]];
  const MeMenu = ({ mobile }) => html`<div class=${"menu " + (mobile ? "mobile" : "")} onClick=${() => setMenu(false)}>
      <div style="padding:8px 10px 10px;border-bottom:1px solid var(--line-2);margin-bottom:4px"><div style="font-weight:650">${user.name}</div><div class="tiny muted">${user.email}</div>${user.company && html`<div class="tiny muted">${user.company}</div>`}</div>
      <a href="#/settings"><${Icon} n="sliders" cls="sm" /> Account settings</a>
      ${mobile && html`<button onClick=${() => switchMode(buyer ? "supplier" : "buyer")}><${Icon} n="swap" cls="sm" /> Switch to ${buyer ? "Supplier" : "Buyer"} view</button>`}
      ${mobile && user.is_admin && html`<a href="#/admin/support"><${Icon} n="shield" cls="sm" /> Support Inbox</a><a href="#/admin/users"><${Icon} n="users" cls="sm" /> Users & Plans</a>`}
      ${store.mode === "demo" && html`<button onClick=${() => { store.resetDemo(); go("/login"); }}><${Icon} n="swap" cls="sm" /> Reset demo data</button>`}
      <button onClick=${() => store.signOut().then(() => go("/"))}><${Icon} n="logout" cls="sm" /> Sign out</button>
    </div>`;

  return html`
    ${store.mode === "demo" && html`<div class="demo-bar no-print">Demo mode — data is saved only in this browser. Signed in as <b>${user.email}</b>.<button onClick=${() => store.signOut().then(() => go("/login"))}>Switch account</button></div>`}
    <div class="shell">
      <aside class="side">
        <a class="brand" href="#/"><img src="icons/logo-96.png" alt="" />${CFG.appName}</a>
        <div class="mode" role="tablist" aria-label="Account view">
          <button class=${buyer ? "on" : ""} onClick=${() => switchMode("buyer")}><${Icon} n="cart" cls="sm" /> Buyer</button>
          <button class=${!buyer ? "on" : ""} onClick=${() => switchMode("supplier")}><${Icon} n="box" cls="sm" /> Supplier</button>
        </div>
        <nav class="nav">
          ${nav.map(([href, ic, label, cls]) => html`<a href=${"#" + href} class=${cls}><${Icon} n=${ic} /> ${label}</a>`)}
          ${user.is_admin && html`<div class="label">Admin</div>
            <a href="#/admin/support" class=${on("admin-support")}><${Icon} n="shield" /> Support Inbox</a>
            <a href="#/admin/users" class=${on("admin-users")}><${Icon} n="users" /> Users & Plans</a>`}
        </nav>
        <div class="side-foot" style="position:relative">
          ${menu && html`<${MeMenu} />`}
          <button class="me" onClick=${() => setMenu(!menu)}>
            <span class="avatar">${initials(user.name || user.email)}</span>
            <span class="grow"><div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.name}</div><div class="tiny muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.email}</div></span>
            <${Icon} n="up" cls="sm" />
          </button>
        </div>
      </aside>
      <main class="main">
        <header class="topbar no-print">
          <a class="brand" href="#/"><img src="icons/logo-96.png" alt="" style="width:28px;height:28px" />${CFG.appName}</a>
          <div class="row"><span class="badge ${buyer ? "b-open" : "b-awarded"}">${buyer ? "Buyer" : "Supplier"}</span>
          <button class="me" style="width:auto;padding:2px" onClick=${() => setMenu(!menu)} aria-label="Account menu"><span class="avatar">${initials(user.name || user.email)}</span></button></div>
          ${menu && html`<${MeMenu} mobile />`}
        </header>
        ${children}
        <nav class="tabbar no-print">${nav.map(([href, ic, label, cls]) => html`<a href=${"#" + href} class=${cls}><${Icon} n=${ic} />${label}</a>`)}</nav>
      </main>
    </div>`;
}

render(html`<${App} /><${Toasts} /><${ConfirmHost} />`, document.getElementById("app"));

// Register the offline service worker (makes it installable as an app).
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
