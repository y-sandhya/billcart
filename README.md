# BillCart

BillCart is a self-contained vanilla HTML, CSS, and JavaScript commerce demonstration. Open `index.html` in a modern browser; no build or install step is needed. Hash routes include `#/shop`, `#/cart`, `#/checkout`, `#/orders`, `#/account`, and `#/admin`.

## Included demo flows

- 159 unique, structured products across seven categories, with distinct mapped photography or generated product-specific image fallbacks
- Search, category and price filters, stock filtering, sorting, wishlist, stock-aware customer carts, coupon codes, mixed sample GST rates, and checkout totals
- Local demo customer registration and sign in, per-customer cart/wishlist/profile/address storage, account dashboard, and saved addresses
- Demo payment success, failure, and cancellation outcomes; orders, tracking, cancellation, return requests, and printable tax invoices
- Admin overview, product creation, inventory updates, order status updates, customer overview, coupon creation, and CSV export
- Dark mode, responsive layouts, rule-based shopping assistant, and local persistence

This is a localStorage-only demonstration. Browser storage can be edited by its user; demo passphrases are not stored or securely checked, and data is not protected across browser profiles. Do not enter real passwords or payment details. Payment outcomes are simulated and no gateway is contacted. Sample ratings, HSN and GST values are illustrative and unverified. Invoices are demo print views; they are not government tax invoices and their reference is not an online verification service. Store settings are unavailable. A production deployment needs server-backed identity, authorization, inventory and orders plus a PCI-compliant payment provider.
