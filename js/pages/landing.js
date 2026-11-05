import { html, Icon, CFG } from "../ui.js";

const pilotHref = () => `mailto:${CFG.supportEmail}?subject=${encodeURIComponent("TenderHub pilot request")}&body=${encodeURIComponent("Hello,\n\nWe would like to run a real RFQ on TenderHub.\n\nCompany:\nContact person:\nPhone:\nWhat we buy (e.g. spare parts, services, consumables):\nRoughly how many RFQs per month:\n\nThank you.")}`;

export function Landing() {
  const steps = [
    ["file", "Create an RFQ", "Define what you need: description, line items, quantities, and a submission deadline. Or upload your Excel item list."],
    ["users", "Invite Suppliers", "Invite suppliers by email or pick registered suppliers. Each one gets a secure link to your RFQ."],
    ["quotes", "Receive Quotes", "Suppliers submit itemised quotes. All bids are tracked and organised automatically."],
    ["chart", "Compare & Award", "Side-by-side bid comparison with the lowest price highlighted. Award the contract with one click."]
  ];
  const sec = [
    ["lock", "Invitation-Only Access", "RFQ details are never public. Only suppliers you personally invite can view your requirements and submit quotes."],
    ["eye", "Confidentiality Controls", "Mark sensitive RFQs as confidential. Suppliers must acknowledge privacy obligations before accessing your documents."],
    ["key", "End-to-End Encrypted", "RFQs, item lists, prices and quotes are encrypted on your device before they are saved. Only you and the suppliers you invite hold the keys — not other companies, and not TenderHub."],
    ["user", "Access Control", "Only authenticated users with verified accounts can participate. Every action is tied to a verified identity."],
    ["activity", "Full Audit Trail", "Every quote submission and status change is logged. You always know exactly who has interacted with your RFQ."],
    ["trash", "Your Data, Your Control", "Delete your RFQs and quotes at any time. We never sell or share your procurement data with competitors or third parties."]
  ];
  return html`<div class="lp">
    <nav class="lp-nav">
      <a class="brand" href="#/" style="padding:0"><img src="icons/logo-96.png" alt="" />${CFG.appName}</a>
      <div class="row"><a class="btn ghost sm lp-pilot" href=${pilotHref()}>Request a pilot</a><a class="btn ghost sm" href="#/login">Sign in</a><a class="btn primary sm" href="#/signup">Get started</a></div>
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
        <div><div class="v"><${Icon} n="sheet" /></div><div class="l">Excel item upload</div><div class="s">no retyping line items</div></div>
        <div><div class="v"><${Icon} n="chart" /></div><div class="l">Side-by-side bids</div><div class="s">lowest price highlighted</div></div>
        <div><div class="v"><${Icon} n="lock" /></div><div class="l">End-to-end encrypted</div><div class="s">only you and your invitees</div></div>
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
      <h2 style="margin-bottom:12px">Ready to run a real tender?</h2>
      <p class="muted" style="max-width:560px;margin:0 auto">Try the full buyer and supplier flow now, or talk to us about a pilot for your procurement team. Free plan includes 2 active RFQs, no credit card needed.</p>
      <div class="lp-cta"><a class="btn primary" href=${pilotHref()}><${Icon} n="mail" cls="sm" /> Request a pilot</a>
        <a class="btn ghost" href="#/signup">Create free account <${Icon} n="arrow" cls="sm" /></a></div>
    </section>
    <footer class="lp-foot">
      <div>© ${new Date().getFullYear()} ${CFG.appName} · Developed and operated by ${CFG.operator}</div>
      <div style="margin-top:6px"><a href="#/terms">Terms of Use</a> · <a href="#/privacy">Privacy Policy</a> · <a href=${pilotHref()}>Request a pilot</a> · <a href=${"mailto:" + CFG.supportEmail}>${CFG.supportEmail}</a></div>
    </footer>
  </div>`;
}
