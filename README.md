# TableSide — restaurant ordering & admin system

A responsive QR ordering website with a restaurant admin desk. It includes a browser-only demo and a Supabase-backed mode for live orders shared across devices.

## Included

- A public `index.html` homepage with restaurant services, configured delivery city/areas, and a delivery-order entry point.
- A mobile-first, customer-only menu route with categories, search, vegetarian filter, basket, notes and order tracking.
- Home delivery checkout restricted to a single admin-configured city and its listed areas, with saved address, optional PIN/mobile, delivery fee and server-side validation.
- Table-specific QR links created from the admin panel, with PNG download and a print-ready table card.
- A separate staff dashboard with sign-in, live order board, status changes, payment marking and service overview.
- Menu and category management, availability toggles, table management, QR deactivation and order history.
- Separate business settings for name, contact details, address, logo, currency, tax/GST, UPI, hours, estimated preparation time, order availability and bill footer.
- Item discounts, a Today’s Special highlight, optional guest name/mobile and a separate optional WhatsApp offers opt-in.
- A small herb-tapping activity while guests wait for their order.
- Reports for today / last 7 days / last 30 days, CSV exports, and printable order lists.
- A4 invoices and POS / thermal receipts in 58 mm and 80 mm widths. In the print dialog choose the matching printer and paper size.
- Supabase SQL schema with row-level security and server-side order totals.
- GitHub Actions workflow to publish the static site with GitHub Pages.

## Run the local demo

Serve this folder with a static file server. For example, with Python installed:

```powershell
py -m http.server 8000
```

Opening `http://localhost:8000` shows the public restaurant homepage, service details, and configured delivery areas. The delivery menu is at `http://localhost:8000/menu.html?order=delivery`; table QR codes open the same menu with that table's token. Direct links:

- Admin dashboard: `http://localhost:8000/admin.html`
- Business settings: `http://localhost:8000/settings.html` (sign in first from the Admin dashboard)
- Public homepage: `http://localhost:8000/`
- Home delivery menu: `http://localhost:8000/menu.html?order=delivery`

Demo sign-in:

- Email: `demo@hotel.local`
- Password: `demo123`

Demo orders and settings are saved in that browser's local storage. The demo is useful for trying the flow; it does not sync between devices and the demo password is not intended for a real restaurant.

## Set up free live data with Supabase

1. Create a Supabase project and open **SQL Editor**.
2. Run [`supabase/schema.sql`](supabase/schema.sql). It creates the restaurant settings, starter categories and menu dishes, eight tables, order tables, security policies and the secure order RPC functions.
3. In Supabase **Authentication → Users**, create an owner/staff user with an email and password.
4. In **SQL Editor**, register that Auth user's UUID as restaurant staff. Replace the email and display name in this statement:

   ```sql
   insert into public.staff_users (user_id, role, display_name)
   select id, 'owner', 'Restaurant Admin'
   from auth.users
   where email = 'owner@example.com'
   on conflict (user_id) do update
   set role = excluded.role, display_name = excluded.display_name, is_active = true;
   ```

5. Open the project's **Connect / API settings** and copy the Project URL plus its **publishable** key (or legacy `anon` key).
6. Put those public client values in [`config.js`](config.js), and set `demoMode` to `false`:

   ```js
   window.HOTEL_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "YOUR-PUBLISHABLE-OR-ANON-KEY",
     demoMode: false
   };
   ```

7. Open `/admin.html` and sign in with the Auth account. Use **Menu** to edit dishes and set discounts or Today’s Special; use **Tables & QR** to add tables and download/print each QR; use **Order history** for past tickets; use **Settings** or `/settings.html` for business details, logo, and delivery service.

8. In **Settings → Home delivery area**, enable delivery, enter the single service city, add the localities you serve (one per line), and set the delivery fee. Guests choose only one of those localities; the city is fixed from Settings, and the database checks the city and area again before accepting each delivery order. Rerun the updated `supabase/schema.sql` in SQL Editor after pulling code changes so the delivery fields and secure order function are added to your existing project.

At checkout, a guest can leave their name and mobile blank. A separate unchecked box records permission for occasional WhatsApp offers. The Customers view and offer shortcut only include guests whose latest recorded order has that box checked. WhatsApp opens a prefilled message for staff to review and send; this starter does not send messages automatically.

The key in `config.js` is public by design. **Never** place a `service_role` / secret key in this browser app or in GitHub. Row-level security prevents guests from reading customer names or browsing orders. Public order creation and order-status lookup go through narrowly scoped SQL functions.

## Publish from GitHub

The workflow in [`.github/workflows/pages.yml`](.github/workflows/pages.yml) deploys on each push to `main` or `master`.

1. Create a GitHub repository and push this project to its `main` or `master` branch. If this folder is not connected to the repository yet, GitHub shows the exact remote URL and commands when you create the repository. Typical commands are:

   ```powershell
   git add .
   git commit -m "Build restaurant ordering system"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

   If an `origin` remote is already set, keep it and push to its branch instead of adding another one.
2. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the build and deployment source.
3. Check the **Actions** tab. When the deployment finishes, GitHub shows the public site URL. If you change `config.js`, push that change so the live site picks it up.
4. In the admin panel's **Tables & QR** section, download/print each table's own QR code. The code links to the published website and that table's private QR token.

The published site root (`/`) is the customer-facing homepage. Customers can view services and start home delivery orders from the configured localities. The Admin Dashboard is `/admin.html`; staff Settings can enable delivery, define the one city and allowed areas, and set the fee. Table QR codes still open `/menu.html?table=...` for table orders. Older QR links using `index.html?table=...` are forwarded to the menu too.

For a public repository, [GitHub Pages is available on GitHub Free](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). Supabase currently offers a $0 Free plan suitable for trying a small restaurant setup, but free projects can pause after a week of low activity. Check the current [Supabase pricing](https://supabase.com/pricing) and [pause rules](https://supabase.com/docs/guides/platform/free-project-pausing) before relying on it for continuous restaurant service.

## Notes for service & printing

- Admin accounts must exist in Supabase Auth **and** have an active row in `public.staff_users`.
- Guest orders are `pending` until staff accept them. The board then moves them through accepted, preparing, ready, served or cancelled.
- Order prices, GST/tax and totals are recalculated inside the database when an order is placed. Update the tax percentage in Settings to the rate your restaurant uses.
- Item discounts are applied before tax. Today’s Special stays active until an admin turns it off on the menu item.
- Turn off **Accepting orders** in Settings when the kitchen is closed. The guest menu displays the closed state and the database rejects any order submitted while closed.
- Home delivery is off until staff enable it and configure a city plus at least one locality in Settings. Delivery orders include the saved delivery fee on the order detail and printed A4 / thermal bills.
- Browser printing opens your device's print dialog. Choose A4 for the invoice or the matching 58 mm / 80 mm receipt roll for a POS printer. Some printer drivers ignore CSS paper sizing, so set the roll size in the driver too.
- GitHub Pages serves the frontend; Supabase holds the shared database and staff authentication. There is no payment gateway in this starter, so staff mark cash/UPI payments as paid from the order detail panel.

