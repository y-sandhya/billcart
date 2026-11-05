/* Explicit deployment switch. Keep demo mode until the staging backend is verified. */
window.BILL_CART_CONFIG = Object.freeze({
  mode: "demo", // "demo" | "production"
  functionsUrl: "https://yedsemmxzxclaqlxqunj.supabase.co/functions/v1",
});
