# BillCart

Self-contained, responsive e-commerce and billing demonstration. Open `index.html` in a modern browser—there is no install step or backend configuration required. Routes are refresh-safe hash URLs, for example `index.html#/login`, `index.html#/dashboard`, `index.html#/shop`, `index.html#/cart`, `index.html#/checkout`, `index.html#/orders`, `index.html#/admin`, or `index.html#/invoice/ORD-2026-10025`.

Included functional demonstrations:

- Customer catalogue with 70+ validated products (10+ in every category), search, filters, wishlist, cart, stock-aware quantities, coupons and dynamic GST billing
- Demo sign-in with Remember me, Forgot password and Register affordances (`customer@billcart.com` or `admin@billcart.com`, any password), plus customer and admin dashboards
- Address/payment checkout, stock decrement, persistent order history, Buy Again, and a normalized persisted order record with `paymentMethod` / `paymentStatus`
- GST invoice with price snapshots, HSN/SAC, CGST/SGST, QR-style verification mark, print/PDF browser flow
- Dark mode, local persistence, smart rule-based recommendations and shopping assistant
- Admin analytics dashboard, low-stock alerts, latest orders, and inventory CSV export

The app intentionally uses browser local storage as its demo data layer. For a deployed production version, replace the state adapter in `app.js` with Supabase Auth and database calls; card data must continue to be handled only by a PCI-compliant payment provider.
