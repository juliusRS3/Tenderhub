// =====================================================================
//  TenderHub settings — this is the ONLY file you normally need to edit.
// =====================================================================

window.TENDERHUB_CONFIG = {
  appName: "TenderHub",
  // The public web address of your app (used in invitation emails).
  appUrl: "https://tenderhub.my",
  supportEmail: "info@pacificedgetrading.com",

  // ---------------------------------------------------------------
  // 1) BACKEND (Supabase). Leave both empty to run in DEMO MODE:
  //    everything is saved only in this browser, with sample accounts.
  //    Paste your values from Supabase → Project Settings → API.
  // ---------------------------------------------------------------
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Emails that get the Admin menu (Support Inbox, Users & Plans).
  adminEmails: ["julius.stating@gmail.com"],

  // ---------------------------------------------------------------
  // 2) PLANS. "limit" = active RFQs (Draft + Open) at the same time.
  //    paypalMonthly / paypalAnnual: paste the PayPal subscription
  //    button links from your PayPal Business account. While empty,
  //    the Subscribe button emails you an upgrade request instead.
  // ---------------------------------------------------------------
  annualDiscountLabel: "Save ~17%",
  plans: [
    { id: "free", name: "Free", price: 0, annual: 0, limit: 2, confidential: false,
      blurb: "Try TenderHub at no cost", features: ["2 active RFQs at a time", "Unlimited suppliers per RFQ", "Bid comparison tool"] },
    { id: "lite", name: "Starter Lite", price: 29, annual: 290, limit: 3, confidential: false, color: "#2563eb", icon: "zap",
      blurb: "For individuals getting started",
      features: ["3 active RFQs at a time", "Unlimited suppliers per RFQ", "Email invitations to suppliers", "Bid comparison tool"],
      paypalMonthly: "", paypalAnnual: "" },
    { id: "plus", name: "Starter Plus", price: 59, annual: 590, limit: 10, confidential: true, popular: true, color: "#4f46e5", icon: "sparkles",
      blurb: "For small procurement teams",
      features: ["10 active RFQs at a time", "Everything in Starter Lite", "Confidential RFQs", "Priority email support"],
      paypalMonthly: "", paypalAnnual: "" },
    { id: "growth", name: "Growth", price: 149, annual: 1490, limit: 25, confidential: true, color: "#9333ea", icon: "rocket",
      blurb: "For growing procurement teams",
      features: ["25 active RFQs at a time", "Everything in Starter Plus", "Priority support", "Advanced bid analytics"],
      paypalMonthly: "", paypalAnnual: "" },
    { id: "enterprise", name: "Enterprise", price: 499, annual: 4990, limit: Infinity, confidential: true, color: "#ea580c", icon: "building",
      blurb: "For large procurement operations",
      features: ["Unlimited active RFQs", "Everything in Growth", "Dedicated account manager", "Custom onboarding", "SLA guarantees"],
      paypalMonthly: "", paypalAnnual: "" }
  ],

  // ---------------------------------------------------------------
  // 3) DROPDOWN LISTS
  // ---------------------------------------------------------------
  currencies: ["USD", "EUR", "GBP", "MYR", "SGD", "AED", "OMR", "SAR", "QAR", "KWD", "BHD", "INR", "CNY", "JPY", "AUD", "IDR", "THB", "PHP", "NGN"],
  units: ["pcs", "set", "lot", "box", "ream", "kg", "ton", "m", "m2", "m3", "litre", "drum", "roll", "pair", "day", "month", "job"],
  incoterms: [
    ["EXW", "Ex Works"], ["FCA", "Free Carrier"], ["CPT", "Carriage Paid To"], ["CIP", "Carriage and Insurance Paid To"],
    ["DAP", "Delivered at Place"], ["DPU", "Delivered at Place Unloaded"], ["DDP", "Delivered Duty Paid"],
    ["FAS", "Free Alongside Ship"], ["FOB", "Free on Board"], ["CFR", "Cost and Freight"], ["CIF", "Cost, Insurance and Freight"]
  ],

  // Text used when a buyer picks "Use Template" for Terms & Conditions.
  termsTemplate:
`STANDARD TERMS AND CONDITIONS OF PURCHASE

1. Offer and Acceptance. A quotation submitted through TenderHub is a firm offer, valid for the validity period stated in the quotation. A contract is formed only when the Buyer issues a written Purchase Order or award notice.

2. Prices. Prices are fixed for the validity period, in the quotation currency, and inclusive of all costs needed to deliver under the stated Incoterm unless stated otherwise.

3. Delivery. Goods/services shall be delivered to the stated delivery place within the quoted lead time. Time of delivery is of the essence.

4. Quality and Warranty. Goods shall be new, fit for purpose, conform to the specification and be free of defects for 12 months from delivery.

5. Inspection and Rejection. The Buyer may inspect and reject non-conforming goods at the Supplier's cost.

6. Invoicing and Payment. Payment within 30 days of receipt of a correct invoice and acceptance of goods/services.

7. Confidentiality. The Supplier shall keep all RFQ information confidential and use it only to prepare its quotation.

8. Liability. Neither party is liable for indirect or consequential loss. The Supplier indemnifies the Buyer against third-party claims arising from defective goods or the Supplier's negligence.

9. Governing Law. These terms are governed by the laws of the Buyer's country of registration unless agreed otherwise in the Purchase Order.`
};
