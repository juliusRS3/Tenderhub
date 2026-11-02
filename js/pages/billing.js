import { html, useState, Icon, Btn, toast, CFG, planOf } from "../ui.js";
import { store } from "../store.js";

export function Billing({ user }) {
  const [annual, setAnnual] = useState(false);
  const current = planOf(user.plan);
  const paid = CFG.plans.filter((p) => p.id !== "free");

  const subscribe = async (p) => {
    const link = annual ? p.paypalAnnual : p.paypalMonthly;
    if (store.mode === "demo") {
      await store.demoSetPlan(p.id);
      toast(`Demo: you're now on ${p.name}. (No payment taken in demo mode.)`); return;
    }
    if (link) { window.open(link, "_blank", "noopener"); toast("Complete payment in the PayPal window. Your plan is activated once payment is confirmed."); return; }
    const body = `Hello,\n\nPlease upgrade my TenderHub account to ${p.name} (${annual ? "annual" : "monthly"}).\n\nAccount email: ${user.email}\nCompany: ${user.company || "-"}\n\nThank you.`;
    location.href = `mailto:${CFG.supportEmail}?subject=${encodeURIComponent("Upgrade to " + p.name)}&body=${encodeURIComponent(body)}`;
  };

  return html`<div class="page stack" style="max-width:1200px">
    <div style="text-align:center">
      <h1 style="font-size:30px">Billing & Plans</h1>
      <p class="muted" style="margin-top:6px">Choose the plan that fits your procurement team. Pay securely with PayPal.</p>
      <p class="small" style="margin-top:10px">Current plan: <span class="badge b-draft" style="color:var(--ink)">${current.name} (${current.limit === Infinity ? "unlimited" : current.limit} RFQs)</span></p>
      <div class="row" style="justify-content:center;margin-top:16px;gap:10px">
        <span class=${"small " + (annual ? "muted" : "")} style="font-weight:600">Monthly</span>
        <button class=${"toggle " + (annual ? "on" : "")} onClick=${() => setAnnual(!annual)} aria-label="Toggle annual billing" aria-pressed=${annual}></button>
        <span class=${"small " + (annual ? "" : "muted")} style="font-weight:600">Annual</span><span class="badge b-awarded">${CFG.annualDiscountLabel}</span>
      </div>
    </div>
    <div class="plans" style="margin-top:12px">${paid.map((p) => {
      const isCur = p.id === current.id;
      return html`<div class=${"card plan " + (p.popular ? "pop" : "")}>
        ${p.popular && html`<span class="tag">Most Popular</span>`}
        <h2 class="row" style=${"color:" + p.color}><${Icon} n=${p.icon} cls="sm" />${p.name}</h2>
        <p class="small muted" style="margin-top:4px">${p.blurb}</p>
        <div class="price num">$${annual ? Math.round(p.annual / 12) : p.price}<span class="small muted" style="font-weight:500"> /month</span></div>
        <div class="tiny muted">${annual ? `$${p.annual} billed yearly` : "billed monthly"} · ${p.limit === Infinity ? "Unlimited" : p.limit} active RFQs</div>
        <ul>${p.features.map((f) => html`<li><${Icon} n="check" cls="sm" />${f}</li>`)}</ul>
        ${isCur ? html`<button class="btn soft block" disabled>Current plan</button>`
          : html`<${Btn} cls=${(p.popular ? "primary" : "soft") + " block"} onClick=${() => subscribe(p)}>Subscribe to ${p.name}</${Btn}>`}
      </div>`; })}
    </div>
    <p class="small muted" style="text-align:center">${current.id === "free" ? "You're on the free plan — 2 active RFQs included at no cost." : `You're on ${current.name}. To cancel or change, contact ${CFG.supportEmail}.`}</p>
  </div>`;
}
