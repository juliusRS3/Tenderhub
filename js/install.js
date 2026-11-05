// "Install app" button. Android / desktop Chrome & Edge: one-tap install via the browser's prompt.
// iPhone / iPad: Apple doesn't allow websites to install themselves, so we show how to use Share → Add to Home Screen.
import { html, useState, useEffect, Icon, Modal } from "./ui.js";

let deferred = null;
const subs = new Set();
const notify = () => subs.forEach((f) => f());

addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; notify(); });
addEventListener("appinstalled", () => { deferred = null; notify(); });

const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(navigator.userAgent);

/** Returns null when the app is already installed or this browser can't install it. */
export function InstallButton({ cls = "btn ghost sm", label = "Install app", menuItem = false }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(null);
  useEffect(() => { const f = () => force((x) => x + 1); subs.add(f); return () => subs.delete(f); }, []);

  if (isStandalone()) return null;
  const mode = deferred ? "prompt" : isIOS() ? "ios" : isAndroid() ? "android" : null;
  if (!mode) return null;

  const click = async () => {
    if (mode === "prompt") { deferred.prompt(); try { await deferred.userChoice; } catch {} deferred = null; notify(); }
    else setHelp(mode);
  };
  const btn = menuItem
    ? html`<button onClick=${click}><${Icon} n="download" cls="sm" /> ${label}</button>`
    : html`<button class=${cls + " install-btn"} onClick=${click} aria-label="Install TenderHub app" title="Install TenderHub app"><${Icon} n="download" cls="sm" /><span class="install-txt">${label}</span></button>`;
  return html`${btn}${help && html`<${InstallHelp} mode=${help} onClose=${() => setHelp(null)} />`}`;
}

function InstallHelp({ mode, onClose }) {
  const steps = mode === "ios"
    ? [html`Tap the <b>Share</b> button <span class="install-chip"><${Icon} n="upload" cls="sm" /></span> at the bottom of Safari (top right on iPad).`,
       html`Scroll down and tap <b>Add to Home Screen</b>.`,
       html`Tap <b>Add</b>. TenderHub appears on your home screen and opens full-screen like an app.`]
    : [html`Tap the browser menu <b>⋮</b> at the top right.`,
       html`Tap <b>Install app</b> or <b>Add to Home screen</b>.`,
       html`Confirm. TenderHub appears on your home screen and opens full-screen like an app.`];
  return html`<${Modal} title="Install TenderHub" onClose=${onClose}
      foot=${html`<button class="btn primary" onClick=${onClose}>Got it</button>`}>
    <div class="row" style="gap:12px;margin-bottom:14px"><img src="icons/icon-192.png" alt="" style="width:52px;height:52px;border-radius:12px" />
      <div class="small muted">Install TenderHub on your ${mode === "ios" ? "iPhone" : "phone"}. No app store needed, and it takes about 10 seconds.</div></div>
    <ol class="install-steps">${steps.map((s) => html`<li>${s}</li>`)}</ol>
    ${mode === "ios" && html`<p class="tiny muted" style="margin-top:10px">Using Chrome on iPhone? Tap the Share button next to the address bar, then Add to Home Screen.</p>`}
  </${Modal}>`;
}
