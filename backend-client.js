(() => {
  const config = window.BILL_CART_CONFIG || { mode: "demo", functionsUrl: "" };
  const production = config.mode === "production";
  const base = String(config.functionsUrl || "").replace(/\/+$/, "");
  let refreshPromise = null;
  let ready = !production;

  class BillCartApiError extends Error {
    constructor(message, status = 0, code = "api_error") {
      super(message);
      this.name = "BillCartApiError";
      this.status = status;
      this.code = code;
    }
  }

  function assertConfigured() {
    if (!base) throw new BillCartApiError("Production mode is selected, but the Supabase Functions URL is not configured.", 503, "not_configured");
  }

  async function postFunction(name, payload, { refresh = true, authAction = false } = {}) {
    if (!production) {
      throw new BillCartApiError("Backend requests are disabled in demo mode.", 403, "backend_disabled_in_demo");
    }
    assertConfigured();
    let response;
    try {
      response = await fetch(`${base}/${name}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new BillCartApiError("Could not reach BillCart. Check your connection and retry.", 0, "network_error");
    }
    let data = {};
    try { data = await response.json(); } catch { /* handled as a structured API error below */ }
    if (response.status === 401 && refresh && !authAction && name !== "auth-session") {
      try {
        await auth("refresh");
        return await postFunction(name, payload, { refresh: false });
      } catch {
        window.dispatchEvent(new CustomEvent("billcart:session-expired"));
        throw new BillCartApiError("Your session expired. Sign in again.", 401, "session_expired");
      }
    }
    if (!response.ok) throw new BillCartApiError(data.error || `BillCart request failed (${response.status}).`, response.status, response.status === 401 ? "unauthorized" : "request_failed");
    return data;
  }

  function auth(action, fields = {}) {
    if (refreshPromise && action === "refresh") return refreshPromise;
    const request = postFunction("auth-session", { action, ...fields }, { refresh: false, authAction: true });
    if (action === "refresh") {
      refreshPromise = request.finally(() => { refreshPromise = null; });
      return refreshPromise;
    }
    return request;
  }

  const data = (action, fields = {}) => postFunction("storefront-api", { action, ...fields });
  const checkout = (fields) => postFunction("checkout", fields);
  const cancelOrder = (id) => postFunction("cancel-order", { order_id: id });
  const requestReturn = (id, note = "") => postFunction("return-order", { order_id: id, note });
  const shipment = (fields) => postFunction("admin-shipment", fields);
  const inventory = (fields) => postFunction("admin-inventory", fields);
  const assistant = (fields) => postFunction("gemini-assistant", fields);

  function showBootError(error) {
    const app = document.querySelector("#app");
    if (!app) return;
    const escaped = String(error?.message || "Backend unavailable.").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    app.innerHTML = `<main class="wrap"><section class="panel empty" role="alert"><h1>BillCart is unavailable</h1><p>${escaped}</p><p>Production mode will not load demo or browser-stored customer data.</p><button class="btn" onclick="BillCartAPI.bootstrap()">Retry connection</button></section></main>`;
  }

  async function bootstrap() {
    if (!production) { ready = true; return true; }
    ready = false;
    if (typeof backendMode !== "undefined" && !backendMode) throw new BillCartApiError("Frontend mode mismatch. Reload after selecting production mode.", 500);
    const app = document.querySelector("#app");
    if (app) app.innerHTML = '<main class="wrap"><section class="panel empty" aria-live="polite"><h1>Connecting to BillCart</h1><p>Loading the live catalogue and account session…</p></section></main>';
    try {
      let catalogue;
      try { catalogue = await data("catalogue"); }
      catch (error) { showBootError(error); throw error; }
      products.splice(0, products.length, ...(catalogue.products || []));
      state.cart = []; state.wish = []; state.addresses = []; state.orders = []; state.users = {}; state.profiles = {}; state.coupons = {};
      let session = null;
      try { session = await auth("me"); }
      catch (error) {
        if (error.status !== 401) { showBootError(error); throw error; }
        try { await auth("refresh"); session = await auth("me"); }
        catch (refreshError) { if (refreshError.status !== 401) { showBootError(refreshError); throw refreshError; } }
      }
      state.user = session?.user || null;
      state.coupon = "";
      state.checkout = { paymentMethod: "UPI" };
      if (state.user) await loadAccountData();
      ready = true;
      if (typeof loadRoute === "function") loadRoute();
      window.dispatchEvent(new CustomEvent("billcart:ready"));
      return true;
    } catch (error) {
      ready = false;
      showBootError(error);
      return false;
    }
  }

  async function loadAccountData() {
    const bundle = await data("bootstrap");
    if (!state.user || bundle.user?.id !== state.user.id) throw new BillCartApiError("Account response did not match the active session.", 403, "account_mismatch");
    state.user = { ...bundle.user, role: bundle.profile.role, name: bundle.profile.name };
    state.profiles[state.user.id] = bundle.profile;
    state.cart = bundle.cart || [];
    state.wish = bundle.wish || [];
    state.addresses = bundle.addresses || [];
    state.coupons = bundle.coupons || {};
    state.orders = bundle.orders || [];
    state.adminCustomers = [];
    state.billQuote = await refreshQuote(false);
  }

  async function refreshQuote(allowInvalid = true) {
    if (!state.user || !state.cart.length) return normalizeQuote({ valid: true, subtotal: 0, productDiscount: 0, coupon: 0, taxable: 0, cgst: 0, sgst: 0, shipping: 0, total: 0 });
    const result = await data("quote", { items: state.cart, coupon: state.coupon || "" });
    if (!allowInvalid && !result.quote.valid && state.coupon) {
      state.coupon = "";
      return normalizeQuote((await data("quote", { items: state.cart, coupon: "" })).quote);
    }
    return normalizeQuote(result.quote);
  }

  function normalizeQuote(quote) { return { ...quote, sub: quote.subtotal ?? quote.sub ?? 0, delivery: quote.shipping ?? quote.delivery ?? 0 }; }

  async function signIn(email, password) {
    await auth("sign-in", { email, password });
    const result = await auth("me");
    state.user = result.user;
    await loadAccountData();
    state.adminSection = "Dashboard";
    if (typeof go === "function") go(state.user.role === "admin" ? "admin" : "dashboard");
  }
  async function register(name, email, password, phone) {
    const result = await auth("sign-up", { display_name: name, email, password });
    if (!result.authenticated) return { emailConfirmationRequired: true };
    const session = await auth("me");
    state.user = session.user;
    await loadAccountData();
    if (phone) await data("profile-update", { name, phone });
    if (typeof go === "function") go("dashboard");
    return { emailConfirmationRequired: false };
  }
  async function signOut() {
    try { await auth("sign-out"); }
    finally {
      state.user = null; state.cart = []; state.wish = []; state.addresses = []; state.orders = []; state.coupons = {}; state.coupon = "";
      if (typeof loadRoute === "function") loadRoute();
    }
  }

  window.addEventListener("billcart:session-expired", () => {
    if (!production) return;
    state.user = null; state.cart = []; state.wish = []; state.addresses = []; state.orders = []; state.coupon = "";
    ready = true;
    if (typeof go === "function") go("login");
    if (typeof toast === "function") toast("Your secure session expired. Sign in again.");
  });

  window.BillCartAPI = Object.freeze({ production, get ready() { return ready; }, auth, data, checkout, cancelOrder, requestReturn,
    shipment, inventory, assistant, bootstrap, loadAccountData, refreshQuote, signIn, register, signOut, BillCartApiError });
  if (production) void bootstrap();
})();
