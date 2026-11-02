# TenderHub

A platform connecting buyers and sellers: buyers create RFQs, invite suppliers, compare quotes side by side and award the best bid.

Plain HTML/JavaScript Progressive Web App, with no build step.

## Privacy: end-to-end encrypted

The following are encrypted **in the user's browser before they are saved**:

- RFQ content: title, description, line items, terms and the T&C PDF
- Quotes: prices, lead times and notes
- Clarification Q&A
- Activity log

Only the buyer and the suppliers they invite hold the keys. Other companies cannot read this data, and neither can the TenderHub admin or anyone with database access.

| The database can see | The database cannot read |
|---|---|
| Account name, email, company, plan | RFQ titles, descriptions, items, terms, PDFs |
| RFQ status, deadline, standard/confidential | Quoted prices, lead times, notes |
| Who is invited to an RFQ, who quoted, who won | Clarification questions and answers, activity log |
| Support chat (so the admin can help) | |

Every user gets a **recovery code** at first sign-in. If a user forgets their password *and* loses the recovery code, their encrypted data cannot be recovered by anyone.

## Files

- `config.js` holds everything you normally change: Supabase keys, plans and prices, PayPal links, dropdown lists and the terms template.
- `supabase/schema.sql` is the database setup, with tables, access rules and plan limits.

With the Supabase keys left empty, the app runs in **demo mode**. In demo mode, data stays in the visitor's browser, and sample accounts use the password `demo1234`.

## Going live (one-time)

1. **Create the database.** Make a free project at supabase.com. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and click **Run**. The last line makes `julius.stating@gmail.com` the admin; change it first if needed.
2. **Connect the app.** In Supabase, open **Project Settings → API**. Copy the **Project URL** and the **anon public** key into `supabaseUrl` and `supabaseAnonKey` in `config.js`. The anon key is meant to be public, and the access rules protect the data.
3. **Set the sign-in links.** In Supabase, open **Authentication → URL Configuration**. Set **Site URL** to `https://tenderhub.my` and add `https://tenderhub.my/**` to the redirect URLs.
4. **Publish the site.** Host this repository on any static host, such as Vercel, Netlify or Cloudflare Pages, and point the `tenderhub.my` domain at it.
5. **Payments (optional).** Paste your PayPal subscription links into `config.js`. Until you do, "Subscribe" emails you an upgrade request. Activate plans in the app under **Admin → Users & Plans**.

If you change plan limits in `config.js`, change them in `supabase/schema.sql` too (`plan_limit` and `plan_confidential`), then re-run those two functions in the SQL Editor.
