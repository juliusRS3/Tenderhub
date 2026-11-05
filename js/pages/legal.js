// Terms of Use and Privacy Policy. Plain-language; have a lawyer review before taking paid customers.
import { html, Icon, CFG } from "../ui.js";

const UPDATED = "5 November 2026";

function Doc({ title, children }) {
  const back = () => (history.length > 1 ? history.back() : (location.hash = "#/"));
  return html`<div class="legal">
    <a class="brand" href="#/" style="padding:0"><img src="icons/logo-96.png" alt="" style="width:28px;height:28px" />${CFG.appName}</a>
    <h1>${title}</h1>
    <p class="small muted" style="margin-bottom:14px">Last updated: ${UPDATED}</p>
    ${children}
    <h2>Contact us</h2>
    <p>${CFG.operator} (Registration No. ${CFG.operatorRegNo}), Malaysia<br />
      Email: <a href=${"mailto:" + CFG.supportEmail}>${CFG.supportEmail}</a><br />
      Website: <a href=${CFG.operatorWebsite} target="_blank" rel="noopener">${CFG.operatorWebsite.replace(/^https?:\/\//, "")}</a></p>
    <p style="margin-top:28px"><a href="#/" onClick=${(e) => { e.preventDefault(); back(); }}><${Icon} n="back" cls="sm" /> Back</a>
      · <a href=${title === "Terms of Use" ? "#/privacy" : "#/terms"}>${title === "Terms of Use" ? "Privacy Policy" : "Terms of Use"}</a></p>
  </div>`;
}

export function Terms() {
  const op = CFG.operator, app = CFG.appName;
  return html`<${Doc} title="Terms of Use">
    <p>These Terms of Use govern your use of ${app}, an online procurement platform operated by ${op} ("we", "us"). By creating an account or using ${app} you agree to these terms. If you use ${app} for a company, you confirm you are authorised to accept these terms for it.</p>

    <h2>1. What ${app} does</h2>
    <p>${app} lets buyers create requests for quotation (RFQs), invite suppliers, receive quotations, compare them and record an award. ${app} is a software tool only. We are not a buyer, supplier, agent or broker, and we are not a party to any contract, purchase order or dispute between buyers and suppliers. Buyers and suppliers are solely responsible for their RFQs, quotations, award decisions and any contract that follows.</p>

    <h2>2. Accounts</h2>
    <ul>
      <li>You must give accurate details and keep your login details confidential. You are responsible for activity under your account.</li>
      <li>Several people in the same company may share one buyer account. The account holder is responsible for everyone who uses it.</li>
      <li>Suppliers should sign up with the email address the buyer invited.</li>
    </ul>

    <h2>3. Encryption, passwords and recovery codes</h2>
    <p>RFQ content, line items, attachments, quotations, clarification questions and activity logs are encrypted on your device before they are stored. We cannot read them. This means:</p>
    <ul>
      <li>You must keep your password and your recovery code safe.</li>
      <li>If you lose both, your encrypted data cannot be recovered by anyone, including us. We are not liable for data lost this way.</li>
      <li>You are responsible for keeping your own copies of documents you need, for example by exporting bid comparisons.</li>
    </ul>

    <h2>4. Subscriptions and payment</h2>
    <ul>
      <li>Buyers may use the free plan or subscribe to a paid plan. Plan limits, such as the number of active RFQs, are shown on the Billing page.</li>
      <li>Paid plans are billed monthly or annually in advance through our payment provider. A plan is activated once payment is confirmed.</li>
      <li>You may cancel at any time by contacting us. Cancellation takes effect at the end of the current billing period, and fees already paid are not refunded unless required by law.</li>
      <li>We may change plan prices with at least 30 days' notice. Changes apply from your next billing period.</li>
      <li>Suppliers do not pay to receive invitations or submit quotations.</li>
    </ul>

    <h2>5. Acceptable use</h2>
    <p>You must not:</p>
    <ul>
      <li>post false, misleading or unlawful RFQs or quotations, or use ${app} for bid rigging, collusion, bribery or any other corrupt or anti-competitive practice;</li>
      <li>upload malware, or try to access accounts, RFQs or data you have not been given access to;</li>
      <li>disrupt, overload, copy or reverse-engineer the service;</li>
      <li>use ${app} to send spam or to harvest other users' contact details.</li>
    </ul>
    <p>We may suspend or close accounts that break these rules.</p>

    <h2>6. Your content and confidentiality</h2>
    <p>You keep ownership of everything you upload. You give us only the limited permission needed to store and transmit it so ${app} can work. Suppliers must keep buyers' RFQ information confidential and use it only to prepare their quotation. Buyers who mark an RFQ as confidential may require suppliers to acknowledge this before viewing it.</p>

    <h2>7. Availability and changes</h2>
    <p>We aim to keep ${app} available and secure, but we do not guarantee it will be uninterrupted or error-free. We may improve, change or discontinue features. If we discontinue the service, we will give reasonable notice so you can export your data.</p>

    <h2>8. Disclaimer and limitation of liability</h2>
    <p>${app} is provided "as is". To the extent permitted by law, we are not liable for any indirect or consequential loss, loss of profit, revenue, business or opportunity, or for the outcome of any tender, quotation or contract. Our total liability for any claim is limited to the subscription fees you paid us in the 12 months before the claim arose.</p>

    <h2>9. Ending your use</h2>
    <p>You may stop using ${app} and ask us to delete your account at any time. We may suspend or end your access if you breach these terms or fail to pay fees due.</p>

    <h2>10. Changes to these terms</h2>
    <p>We may update these terms. We will show the new date above and, for significant changes, notify account holders by email. Continuing to use ${app} after a change means you accept it.</p>

    <h2>11. Governing law</h2>
    <p>These terms are governed by the laws of Malaysia, and the courts of Malaysia have jurisdiction over any dispute.</p>
  </${Doc}>`;
}

export function Privacy() {
  const op = CFG.operator, app = CFG.appName;
  return html`<${Doc} title="Privacy Policy">
    <p>This policy explains how ${op} ("we", "us") handles personal data when you use ${app}, in line with Malaysia's Personal Data Protection Act 2010 (PDPA).</p>

    <div class="box"><b>In short:</b> your RFQs, item lists, prices, quotations and attachments are encrypted on your device. We cannot read them, and we never sell or share your data.</div>

    <h2>1. What we collect</h2>
    <ul>
      <li><b>Account details:</b> your name, email address, company name, whether you use ${app} as a buyer or supplier, your subscription plan and sign-up date.</li>
      <li><b>RFQ records we can see:</b> whether an RFQ is draft, open, closed or awarded, its deadline, which email addresses were invited, and which accounts submitted a quotation. We need these to control access and apply plan limits.</li>
      <li><b>Encrypted content we cannot read:</b> RFQ titles and descriptions, line items, terms and attachments, quotations and prices, clarification questions and answers, and activity logs.</li>
      <li><b>Support messages</b> you send us through the Support page. These are not encrypted, so that we can read and answer them.</li>
      <li><b>Payment records:</b> payments are handled by our payment provider. We receive confirmation of payment, not your card details.</li>
      <li><b>Technical data</b> needed to run the service securely, such as login sessions.</li>
    </ul>

    <h2>2. Why we use it</h2>
    <ul>
      <li>to create and secure your account and let you sign in;</li>
      <li>to deliver RFQs to the suppliers you invite and quotations back to you;</li>
      <li>to manage subscriptions, plan limits and billing;</li>
      <li>to answer support requests and send important service notices.</li>
    </ul>
    <p>We do not use your data for advertising and we do not sell it.</p>

    <h2>3. Who we share it with</h2>
    <ul>
      <li><b>Other users, as you direct:</b> suppliers you invite can see your RFQ and your name and company; buyers can see the quotations and company details of suppliers who quote. Other users of the supplier directory can find registered users by name, company or email.</li>
      <li><b>Service providers</b> who host our database and website and process payments, and who may store data outside Malaysia, for example in Singapore. They only process data to provide their service to us.</li>
      <li><b>Authorities,</b> where required by law.</li>
    </ul>

    <h2>4. How long we keep it</h2>
    <p>We keep your data while your account is active. If you ask us to delete your account, we delete your account details and the RFQs and quotations you own, except records we must keep by law, such as payment records.</p>

    <h2>5. Security</h2>
    <p>Data is sent over encrypted connections (HTTPS). Content is encrypted on your device with keys that only you and the people you invite hold. Your password and recovery code are never sent to us in a form we can use to read your data.</p>

    <h2>6. Demo mode</h2>
    <p>When ${app} runs in demo mode, everything you enter is stored only in your own browser and is not sent to us.</p>

    <h2>7. Your rights</h2>
    <p>You may ask to access or correct your personal data, ask us to delete your account, or withdraw consent to us processing it (which will mean closing your account). Contact us using the details below. We will respond within 21 days.</p>

    <h2>8. Changes</h2>
    <p>We may update this policy and will show the new date above. For significant changes we will notify account holders by email.</p>
  </${Doc}>`;
}
