import { html, Icon, CFG } from "../ui.js";

export function Landing() {
  const steps = [
    ["file", "Create an RFQ", "Define what you need: description, line items, quantities, and a submission deadline. Or upload your Excel item list."],
    ["users", "Invite Suppliers", "Search and invite qualified suppliers to your bidders list. They get notified instantly."],
    ["quotes", "Receive Quotes", "Suppliers submit itemised quotes. All bids are tracked and organised automatically."],
    ["chart", "Compare & Award", "Side-by-side bid comparison with the lowest price highlighted. Award the contract with one click."]
  ];
  const sec = [
    ["lock", "Invitation-Only Access", "RFQ details are never public. Only suppliers you personally invite can view your requirements and submit quotes."],
    ["eye", "Confidentiality Controls", "Mark sensitive RFQs as confidential. Suppliers must acknowledge privacy obligations before accessing your documents."],
    ["key", "Encrypted Data", "All data is transmitted over HTTPS with TLS encryption. Your RFQ data is stored securely and never shared with third parties."],
    ["user", "Access Control", "Only authenticated users with verified accounts can participate. Every action is tied to a verified identity."],
    ["activity", "Full Audit Trail", "Every quote submission and status change is logged. You always know exactly who has interacted with your RFQ."],
    ["trash", "Your Data, Your Control", "Delete your RFQs and quotes at any time. We never sell or share your procurement data with competitors or third parties."]
  ];
  return html`<div class="lp">
    <nav class="lp-nav">
      <a class="brand" href="#/" style="padding:0"><img src="icons/logo-96.png" alt="" />${CFG.appName}</a>
      <div class="row"><a class="btn ghost sm" href="#/login">Sign in</a><a class="btn primary sm" href="#/signup">Get started</a></div>
    </nav>

    <section class="lp-hero">
      <span class="pill"><${Icon} n="checkc" cls="sm" /> Procurement made simple</span>
      <h1>From RFQ to Contract <span>in One Place</span></h1>
      <p>TenderHub replaces messy email threads with a structured procurement workflow. Buyers create RFQs, suppliers compete, and the best bid wins.</p>
      <div class="lp-cta">
        <a class="btn primary" href="#/signup">Get started free <${Icon} n="arrow" cls="sm" /></a>
        <a class="btn ghost" href="#/login"><${Icon} n="logout" cls="sm" /> Sign in</a>
      </div>
      <div class="card lp-stats">
        <div><div class="v">3×</div><div class="l">Faster procurement</div><div class="s">vs. email-based RFQs</div></div>
        <div><div class="v">5+</div><div class="l">Average bids per RFQ</div><div class="s">competitive quotes</div></div>
        <div><div class="v">&lt;24h</div><div class="l">Time to first quote</div><div class="s">from publishing</div></div>
      </div>
    </section>

    <section class="lp-sec">
      <div class="eyebrow">How it works</div>
      <h2>Four steps to a better deal</h2>
      <div class="lp-steps">${steps.map(([ic, t, d], i) => html`
        <div class="card"><span class="n">0${i + 1}</span><div class="ic-tile"><${Icon} n=${ic} /></div><h3>${t}</h3><p class="muted small" style="margin-top:6px">${d}</p></div>`)}
      </div>
    </section>

    <section class="lp-sec">
      <div class="eyebrow">Built for both sides</div>
      <h2>Whether you buy or supply</h2>
      <div class="lp-sides">
        <div class="lp-side b"><div class="row"><div class="ic-tile" style="margin:0;background:#fff"><${Icon} n="shield" /></div><h2 style="text-align:left;margin:0">Buyer</h2></div>
          <ul>${["Create and manage RFQs in minutes", "Upload line items from Excel", "Build a curated supplier shortlist", "Compare bids with full line-item detail", "Award contracts and track outcomes"].map((t) => html`<li><${Icon} n="checkc" cls="sm" />${t}</li>`)}</ul></div>
        <div class="lp-side s"><div class="row"><div class="ic-tile" style="margin:0;background:#fff;color:var(--teal)"><${Icon} n="building" /></div><h2 style="text-align:left;margin:0">Supplier</h2></div>
          <ul>${["Receive RFQ invitations from buyers", "Submit detailed itemised quotes", "Ask clarification questions", "Update your quote before the deadline", "Track award status in real time"].map((t) => html`<li><${Icon} n="checkc" cls="sm" />${t}</li>`)}</ul></div>
      </div>
    </section>

    <section class="lp-sec">
      <div class="eyebrow">Security & Privacy</div>
      <h2>Your procurement data stays private</h2>
      <p class="lead">In procurement, confidentiality is non-negotiable. TenderHub is built from the ground up to keep your RFQs, bids, and supplier relationships completely private and under your control.</p>
      <div class="chips">${[["lock", "HTTPS Encrypted"], ["eye", "Invitation-Only"], ["user", "Verified Accounts"], ["activity", "Audit Logged"]].map(([i, t]) => html`<span><${Icon} n=${i} cls="sm" />${t}</span>`)}</div>
      <div class="lp-sec-grid">${sec.map(([ic, t, d]) => html`<div class="card"><div class="ic-tile"><${Icon} n=${ic} /></div><h3>${t}</h3><p class="muted small" style="margin-top:6px">${d}</p></div>`)}</div>
      <div class="promise"><${Icon} n="shield" cls="lg" /><div><h3>Our Privacy Promise</h3><p class="muted small">We will never sell, share, or expose your RFQ data, supplier lists, or pricing information to any third party — ever. Your competitive intelligence belongs to you alone.</p></div></div>
    </section>

    <section class="lp-sec" style="text-align:center">
      <h2 style="margin-bottom:12px">Start your first RFQ today</h2>
      <p class="muted">Free plan includes 2 active RFQs. No credit card needed.</p>
      <div class="lp-cta"><a class="btn primary" href="#/signup">Create free account <${Icon} n="arrow" cls="sm" /></a></div>
    </section>
    <footer class="lp-foot">© ${new Date().getFullYear()} ${CFG.appName} · <a href=${"mailto:" + CFG.supportEmail}>${CFG.supportEmail}</a></footer>
  </div>`;
}
