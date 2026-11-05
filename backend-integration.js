(() => {
  const api = window.BillCartAPI;
  if (!api?.production) return;
  const escape = (value) => bcEscape(value ?? "");
  const moneySafe = (value) => money(Number(value) || 0);
  let checkoutKey = "";
  let previousRoute = window.go;

  function notice(error) {
    const message = error?.message || "BillCart request failed. Retry the action.";
    if (typeof toast === "function") toast(message);
    return false;
  }
  function routePath(page, arg) { return page + (arg !== undefined && arg !== null && arg !== "" ? "/" + encodeURIComponent(String(arg)) : ""); }
  function showLoading(title = "Loading…") {
    document.querySelector("#app").innerHTML = `${nav()}<main class="wrap"><section class="panel empty" role="status"><h2>${escape(title)}</h2></section></main>`;
  }
  function showError(error, retry) {
    if (error?.code === "session_expired") return previousRoute("login");
    const message = escape(error?.message || "Request failed.");
    document.querySelector("#app").innerHTML = `${nav()}<main class="wrap"><section class="panel empty" role="alert"><h2>Could not load this page</h2><p>${message}</p><button class="btn" onclick="BillCartIntegration.retry('${escape(retry)}')">Retry</button></section></main>`;
  }
  async function refreshCatalogue() {
    const result = await api.data("catalogue");
    products.splice(0, products.length, ...(result.products || []));
  }
  async function afterCartChange() {
    await api.data("cart-sync", { items: state.cart });
    state.billQuote = await api.refreshQuote();
  }
  async function reloadUserData() {
    await api.loadAccountData();
    await refreshCatalogue();
  }
  function setInputValue(id, value) { const input = document.querySelector(`#${id}`); if (input) input.value = value ?? ""; }

  async function renderOffers() {
    showLoading("Loading current coupons and offers…");
    try {
      const result = state.user
        ? await api.data("customer-coupons", { items: state.cart })
        : await api.data("active-coupons");
      const coupons = result.coupons || [];
      let best = null;
      if (state.user && state.cart.length) {
        const response = await api.data("best-coupon", { items: state.cart });
        if (response.coupon) best = response;
      }
      const cards = coupons.map((coupon) => {
        const eligible = state.user && coupon.eligible === true;
        const status = !state.user ? "Sign in to check eligibility." : eligible ? "Eligible for this cart." : coupon.eligibilityReason || "Not eligible for this cart.";
        return `<article class="panel offer-card"><div class="eyebrow">${coupon.type === "percent" ? `${Number(coupon.value)}% off` : coupon.type === "fixed" ? `${moneySafe(coupon.value)} off` : "Free delivery"}${coupon.isDemo ? ' · <span class="status">Demo coupon</span>' : ""}</div><h2><code class="coupon-code">${escape(coupon.code)}</code></h2><p>Minimum order: ${coupon.min ? moneySafe(coupon.min) : "None"}</p><p>Expiry: ${escape(coupon.expiry || "No expiry specified")}</p><p>Terms: ${coupon.type === "shipping" ? "Waives delivery charge when eligible." : coupon.type === "percent" ? `Percentage discount${coupon.max ? ` up to ${moneySafe(coupon.max)}` : ""}.` : `Flat discount${coupon.max ? ` up to ${moneySafe(coupon.max)}` : ""}.`}${coupon.maxPerCustomer ? ` Limit ${coupon.maxPerCustomer} per customer.` : ""}</p><p class="muted">${escape(status)}</p><div class="hero-actions"><button class="btn secondary" onclick="copyCoupon('${escape(coupon.code)}')">Copy Code</button><button class="btn" ${eligible ? "" : "disabled"} onclick="BillCartIntegration.applyOffer('${escape(coupon.code)}')">Apply Coupon</button></div></article>`;
      }).join("");
      document.querySelector("#app").innerHTML = `${nav()}<main class="wrap"><div class="section-head"><div><div class="eyebrow">BillCart savings</div><h1>Coupons & Offers</h1></div><button class="btn secondary" onclick="go('cart')">Go to cart</button></div>${best ? `<section class="panel best-offer"><div class="eyebrow">Best eligible for your cart</div><h2>${escape(best.coupon.code)}</h2><p>Estimated savings: ${moneySafe(best.savings)} · Backend quote updated now.</p><button class="btn" onclick="BillCartIntegration.applyBestCoupon()">Apply best coupon</button></section>` : state.user && state.cart.length ? "" : `<p class="muted">${state.user ? "Add products to your cart to check offer eligibility." : "Sign in and add items to check customer-specific coupon eligibility."}</p>`}${cards ? `<div class="grid offers-grid">${cards}</div>` : `<section class="panel empty"><h2>No active offers are available.</h2><p class="muted">Only active backend coupons are shown here.</p></section>`}</main>`;
    } catch (error) { showError(error, "offers"); }
  }

  async function applyCouponCode(code) {
    if (!state.user) return go("login");
    if (!state.cart.length) return notice(new Error("Add an item before applying a coupon."));
    const result = await api.data("quote", { items: state.cart, coupon: code });
    if (!result.quote.valid) throw new Error(result.quote.error || "Coupon is not eligible for this cart.");
    state.coupon = code;
    state.billQuote = { ...result.quote, sub: result.quote.subtotal, delivery: result.quote.shipping };
    return go("cart");
  }

  function loginPage() {
    return `${nav()}<main class="wrap"><section class="panel auth"><h2>Sign in</h2><p class="muted">Your secure BillCart account is stored by the configured backend.</p><label>Email<input id="email" type="email" autocomplete="email" maxlength="254"></label><label>Password<input id="password" type="password" autocomplete="current-password" maxlength="128"></label><button class="btn" onclick="BillCartIntegration.signIn()">Sign in</button><button class="link" onclick="go('register')">Create account</button></section></main><div class="toast hidden"></div>`;
  }
  function registerPage() {
    return `${nav()}<main class="wrap"><form class="panel auth" onsubmit="event.preventDefault();BillCartIntegration.register()"><h2>Create account</h2><label>Name<input id="regName" required minlength="2" maxlength="100" autocomplete="name"></label><label>Email<input id="regEmail" required type="email" maxlength="254" autocomplete="email"></label><label>Password<input id="regPassword" required type="password" minlength="10" maxlength="128" autocomplete="new-password"></label><label>Phone<input id="regPhone" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" autocomplete="tel"></label><button class="btn">Register</button></form></main><div class="toast hidden"></div>`;
  }

  async function cartAction(action) {
    if (!state.user) return go("login");
    const before = state.cart.map((item) => ({ ...item }));
    try {
      action();
      await afterCartChange();
      return go("cart");
    } catch (error) {
      state.cart = before;
      try { await api.data("cart-sync", { items: before }); } catch { /* render the original memory state and show the backend error */ }
      notice(error);
      return go("cart");
    }
  }

  async function renderOrders() {
    if (!state.user) return previousRoute("login");
    showLoading("Loading your orders…");
    try {
      const result = state.user.role === "admin" ? await api.data("admin-orders") : await api.data("my-orders");
      state.orders = result.orders || [];
      const rows = state.orders.map((order) => `<tr><td><b>${escape(order.orderId)}</b><br>${escape(order.createdAt)}</td><td>${order.items.map((item) => `<div class="order-item-preview"><img src="${escape(bcImage({image:item.image,name:item.name}))}" alt="${escape(item.name)}" onerror="bcProductImageError(this,${Number(item.id)||0})"><span>${escape(item.name)} · ${escape(item.sku)} · ${item.quantity} × ${moneySafe(item.unitPrice)}</span></div>`).join("")}</td><td>${moneySafe(order.grandTotal)}</td><td>${escape(order.paymentStatus)}</td><td>${escape(order.orderStatus)}</td><td><button class="link" onclick="go('invoice','${escape(order.orderId)}')">Invoice</button>${state.user.role === "admin" ? "" : `<button class="link" onclick="go('tracking','${escape(order.orderId)}')">Track</button><button class="link" onclick="BillCartIntegration.askOrder('${escape(order.id)}')">Order assistance</button>${["Confirmed","Processing","Packed"].includes(order.orderStatus)?`<button class="link" onclick="BillCartIntegration.cancel('${escape(order.id)}')">Cancel</button>`:""}${order.orderStatus === "Delivered" ? `<button class="link" onclick="BillCartIntegration.requestReturn('${escape(order.id)}')">Return</button>` : ""}`}</td></tr>`).join("");
      document.querySelector("#app").innerHTML = `${nav()}<main class="wrap"><div class="section-head"><h2>${state.user.role === "admin" ? "All orders" : "My orders"}</h2></div>${rows ? `<section class="panel table-scroll"><table class="table"><thead><tr><th>Order and date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></section>` : `<section class="panel empty"><h2>No orders yet</h2><button class="btn" onclick="go('shop')">Browse products</button></section>`}</main>`;
    } catch (error) { showError(error, "orders"); }
  }

  function renderTracking(orderNumber) {
    const order = state.orders.find((item) => item.orderId === orderNumber || item.id === orderNumber);
    if (!order || order.userId !== state.user?.id && state.user?.role !== "admin") return previousRoute("orders");
    const events = order.shipmentHistory || [];
    const steps = ["Placed","Confirmed","Processing","Packed","Shipped","Out for delivery","Delivered"];
    return `${nav()}<main class="wrap"><section class="panel"><div class="eyebrow">Admin-managed shipment history</div><h2>Order ${escape(order.orderId)}</h2><p>Current status: <b>${escape(order.orderStatus)}</b></p><p>Tracking number: ${escape(order.trackingNumber || "Not assigned")}</p><p>Courier: ${escape(order.courier || "Not assigned")}</p><p>Estimated delivery: ${escape(order.estimatedDelivery || "Not available")}</p><ol class="shipment-timeline">${events.map((event) => `<li><b>${escape(event.status)}</b><span>${escape(event.at)}</span><p>${escape(event.note)}</p></li>`).join("")}</ol><p class="muted">Tracking is maintained by BillCart staff. It is not live courier tracking.</p><button class="btn secondary" onclick="go('orders')">Back to orders</button></section></main>`;
  }

  function adminLoading(section) { showLoading(`Loading admin ${section.toLowerCase()}…`); }
  async function renderAdmin(section = "Dashboard") {
    if (state.user?.role !== "admin") return previousRoute("login");
    state.adminSection = section; adminLoading(section);
    try {
      let content = "";
      if (section === "Products") {
        const result = await api.data("admin-products"); products.splice(0, products.length, ...(result.products || []));
        content = `<h2>Products</h2><div class="table-scroll"><table class="table"><thead><tr><th>SKU</th><th>Name</th><th>Category</th><th>Price</th><th>GST</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>${products.map((p)=>`<tr><td>${escape(p.sku)}</td><td><input id="bc-prod-name-${p.id}" value="${escape(p.name)}"></td><td><input id="bc-prod-category-${p.id}" value="${escape(p.category)}"></td><td><input id="bc-prod-price-${p.id}" type="number" min="0.01" step="0.01" value="${p.p}"></td><td><select id="bc-prod-gst-${p.id}">${[0,5,12,18,28].map((rate)=>`<option value="${rate}" ${rate===p.gstRate?"selected":""}>${rate}%</option>`).join("")}</select></td><td>${p.stock}</td><td>${p.active===false?"Inactive":"Active"}</td><td><button class="link" onclick="BillCartIntegration.saveProduct(${p.id})">Save</button><button class="link" onclick="BillCartIntegration.deleteProduct(${p.id})">Deactivate</button></td></tr>`).join("")}</tbody></table></div><h3>Add product</h3><div class="form-grid"><input id="bc-new-name" placeholder="Name"><input id="bc-new-brand" placeholder="Brand"><input id="bc-new-category" placeholder="Category"><input id="bc-new-price" type="number" min="0.01" placeholder="Price"><input id="bc-new-old" type="number" min="0.01" placeholder="Compare at price"><input id="bc-new-gst" type="number" value="18" placeholder="GST rate"><input id="bc-new-image" placeholder="Image URL"></div><button class="btn" onclick="BillCartIntegration.saveProduct()">Create product</button>`;
      } else if (section === "Inventory") {
        const result=await api.data("admin-products");products.splice(0,products.length,...result.products);
        content=`<h2>Inventory</h2><p>Stock changes are recorded in the inventory movement table.</p><div class="table-scroll"><table class="table"><thead><tr><th>SKU</th><th>Product</th><th>Current stock</th><th>New stock</th><th>Reason</th><th></th></tr></thead><tbody>${products.map(p=>`<tr><td>${escape(p.sku)}</td><td>${escape(p.name)}</td><td>${p.stock}</td><td><input id="bc-stock-${p.id}" type="number" min="0" step="1" value="${p.stock}"></td><td><input id="bc-stock-reason-${p.id}" maxlength="160" value="Stock count adjustment"></td><td><button class="link" onclick="BillCartIntegration.saveStock(${p.id})">Save</button></td></tr>`).join("")}</tbody></table></div>`;
      } else if (section === "Orders") {
        const result=await api.data("admin-orders");state.orders=result.orders||[];
        const choices={Confirmed:["Processing","Cancelled"],Processing:["Packed","Cancelled"],Packed:["Shipped","Cancelled"],Shipped:["Out for delivery","Delivery failed"],"Out for delivery":["Delivered","Delivery failed"],"Delivery failed":["Out for delivery","Shipped"],"Return requested":["Returned"]};
        content=`<h2>Orders and shipments</h2><div class="table-scroll"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Shipment details</th><th>Update</th></tr></thead><tbody>${state.orders.map(o=>`<tr><td>${escape(o.orderId)}<br>${escape(o.createdAt)}<br>${moneySafe(o.grandTotal)}</td><td>${escape(o.customer)}<br>${escape(o.deliveryAddress?.phone)}</td><td>${escape(o.orderStatus)}<br>${escape(o.paymentStatus)}</td><td><input id="bc-track-${escape(o.id)}" placeholder="Tracking number" value="${escape(o.trackingNumber)}"><input id="bc-courier-${escape(o.id)}" placeholder="Courier" value="${escape(o.courier)}"><input id="bc-dispatch-${escape(o.id)}" type="datetime-local"><input id="bc-estimate-${escape(o.id)}" type="date" value="${escape(o.estimatedDelivery)}"><textarea id="bc-note-${escape(o.id)}" maxlength="1000" placeholder="Shipment note"></textarea></td><td><select id="bc-status-${escape(o.id)}">${(choices[o.orderStatus]||[]).map(s=>`<option value="${s.toLowerCase().replaceAll(" ","_")}">${s}</option>`).join("")}</select><button class="link" onclick="BillCartIntegration.updateShipment('${escape(o.id)}')">Update</button></td></tr>`).join("")}</tbody></table></div>`;
      } else if (section === "Coupons") {
        const result=await api.data("admin-coupons"); state.coupons=result.coupons||{};
        content=`<h2>Coupons</h2><div class="table-scroll"><table class="table"><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Uses</th><th>Status</th><th></th></tr></thead><tbody>${Object.entries(state.coupons).map(([code,c])=>`<tr><td>${escape(code)}</td><td>${escape(c.type)}</td><td>${c.type==='percent'?`${c.value}%`:c.type==='fixed'?moneySafe(c.value):'Free shipping'}</td><td>${c.uses}${c.maxUses?` / ${c.maxUses}`:""}</td><td>${c.active?"Active":"Inactive"}</td><td><button class="link" onclick="BillCartIntegration.editCoupon('${escape(code)}')">Edit</button><button class="link" onclick="BillCartIntegration.toggleCoupon('${escape(code)}')">${c.active?"Deactivate":"Activate"}</button><button class="link" onclick="BillCartIntegration.deleteCoupon('${escape(code)}')">Delete</button></td></tr>`).join("")}</tbody></table></div><h3 id="bc-coupon-form-title">Create coupon</h3><div class="form-grid"><input id="bc-coupon-code" placeholder="Code"><select id="bc-coupon-type"><option value="percent">Percent</option><option value="fixed">Fixed amount</option><option value="shipping">Free shipping</option></select><input id="bc-coupon-value" type="number" min="0" step="0.01" placeholder="Value"><input id="bc-coupon-min" type="number" min="0" step="0.01" placeholder="Minimum subtotal"><input id="bc-coupon-max" type="number" min="0.01" step="0.01" placeholder="Maximum discount"><input id="bc-coupon-start" type="date"><input id="bc-coupon-expiry" type="date"><input id="bc-coupon-limit" type="number" min="1" placeholder="Total uses"><input id="bc-coupon-per" type="number" min="1" value="1" placeholder="Uses per customer"></div><button class="btn" onclick="BillCartIntegration.saveCoupon()">Save coupon</button>`;
      } else if (section === "Customers") {
        const result=await api.data("admin-customers");
        content=`<h2>Customers</h2><div class="table-scroll"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead><tbody>${result.customers.map(c=>`<tr><td>${escape(c.display_name)}</td><td>${escape(c.email)}</td><td>${escape(c.phone)}</td><td>${escape(c.status)}</td><td>${escape(c.created_at)}</td></tr>`).join("")}</tbody></table></div>`;
      } else if (section === "Dashboard" || section === "Reports" || section === "Invoices") {
        const [ordersResult,productsResult,customersResult]=await Promise.all([api.data("admin-orders"),api.data("admin-products"),api.data("admin-customers")]);
        state.orders=ordersResult.orders||[];products.splice(0,products.length,...productsResult.products||[]);
        const revenue=state.orders.reduce((sum,o)=>sum+Number(o.grandTotal||0),0);
        content=`<h2>${escape(section)}</h2><div class="metrics"><div class="metric">Revenue<b>${moneySafe(revenue)}</b></div><div class="metric">Orders<b>${state.orders.length}</b></div><div class="metric">Customers<b>${customersResult.customers.length}</b></div><div class="metric">Products<b>${products.length}</b></div></div><h3>Recent orders</h3>${state.orders.slice(0,12).map(o=>`<p>${escape(o.orderId)} · ${escape(o.customer)} · ${moneySafe(o.grandTotal)} · ${escape(o.orderStatus)}</p>`).join("")}`;
      } else content=`<h2>${escape(section)}</h2><p>This admin section is not connected to the database yet.</p>`;
      const sections=["Dashboard","Products","Inventory","Orders","Customers","Coupons","Invoices","Reports"];
      document.querySelector("#app").innerHTML=`${nav()}<main class="wrap"><div class="panel">${sections.map(s=>`<button class="btn secondary" onclick="adminPanel('${s}')">${s}</button>`).join("")}</div><section class="panel">${content}</section></main>`;
    } catch(error) { showError(error,`admin:${section}`); }
  }

  async function saveProduct(id) {
    const p=id?products.find((item)=>item.id===Number(id)):null;
    const v=(field,fallback="")=>document.querySelector(field)?.value??fallback;
    const product={...(p?{id:p.id,sku:p.sku}:{}),name:v(id?`#bc-prod-name-${id}`:"#bc-new-name"),brand:v(id?null:"#bc-new-brand",p?.brand),category:v(id?`#bc-prod-category-${id}`:"#bc-new-category"),price:Number(v(id?`#bc-prod-price-${id}`:"#bc-new-price")),compare_at_price:Number(v(id?null:"#bc-new-old",p?.old||0)),gst_rate:Number(v(id?`#bc-prod-gst-${id}`:"#bc-new-gst",p?.gstRate||18)),image_url:v(id?null:"#bc-new-image",p?.image||""),description:p?.description||"",hsn:p?.hsn||"",active:p?.active??true};
    try{await api.data("admin-product-save",{product});await renderAdmin("Products");toast("Product saved.")}catch(error){notice(error)}
  }
  async function deleteProduct(id){if(!confirm("Deactivate this product? It will leave the storefront while inventory movements and order history are preserved."))return;try{await api.data("admin-product-delete",{id});await refreshCatalogue();await renderAdmin("Products")}catch(error){notice(error)}}
  async function saveStock(id){try{await api.inventory({product_id:Number(id),stock:Number(document.querySelector(`#bc-stock-${id}`).value),reason:document.querySelector(`#bc-stock-reason-${id}`).value});await refreshCatalogue();await renderAdmin("Inventory")}catch(error){notice(error)}}
  async function updateShipment(id){
    const order=state.orders.find((item)=>item.id===id);if(!order)return notice(new Error("Order no longer appears in the current admin list."));
    const value=(prefix)=>document.querySelector(`#${prefix}-${CSS.escape(id)}`)?.value||"";
    try{await api.shipment({order_id:id,status:value("bc-status"),tracking_number:value("bc-track"),courier:value("bc-courier"),dispatch_date:value("bc-dispatch")||null,estimated_delivery:value("bc-estimate")||null,note:value("bc-note")});await renderAdmin("Orders")}catch(error){notice(error)}
  }
  function clearCouponForm(){for(const id of ["bc-coupon-code","bc-coupon-value","bc-coupon-min","bc-coupon-max","bc-coupon-start","bc-coupon-expiry","bc-coupon-limit"])setInputValue(id,"");setInputValue("bc-coupon-per","1");setInputValue("bc-coupon-type","percent");document.querySelector("#bc-coupon-form-title").textContent="Create coupon";}
  function editCoupon(code){const c=state.coupons[code];if(!c)return;setInputValue("bc-coupon-code",code);setInputValue("bc-coupon-type",c.type);setInputValue("bc-coupon-value",c.value);setInputValue("bc-coupon-min",c.min);setInputValue("bc-coupon-max",c.max);setInputValue("bc-coupon-start",c.startsAt?.slice(0,10));setInputValue("bc-coupon-expiry",c.expiry);setInputValue("bc-coupon-limit",c.maxUses);setInputValue("bc-coupon-per",c.maxPerCustomer);document.querySelector("#bc-coupon-form-title").textContent=`Edit ${code}`;}
  async function saveCoupon(overrides={}){const code=document.querySelector("#bc-coupon-code").value.trim().toUpperCase(),existing=state.coupons[code]||{};const coupon={code,type:document.querySelector("#bc-coupon-type").value,value:Number(document.querySelector("#bc-coupon-value").value||0),min:Number(document.querySelector("#bc-coupon-min").value||0),max:document.querySelector("#bc-coupon-max").value?Number(document.querySelector("#bc-coupon-max").value):null,startsAt:document.querySelector("#bc-coupon-start").value||null,expiry:document.querySelector("#bc-coupon-expiry").value||null,maxUses:document.querySelector("#bc-coupon-limit").value?Number(document.querySelector("#bc-coupon-limit").value):null,maxPerCustomer:Number(document.querySelector("#bc-coupon-per").value||1),active:existing.active!==false,...overrides};try{await api.data("admin-coupon-save",{coupon});await renderAdmin("Coupons")}catch(error){notice(error)}}
  async function deleteCoupon(code){if(!confirm(`Delete coupon ${code}?`))return;try{await api.data("admin-coupon-delete",{code});await renderAdmin("Coupons")}catch(error){notice(error)}}
  async function toggleCoupon(code){const c=state.coupons[code];if(c)await saveCoupon({active:!c.active});}
  async function askOrder(id){const order=state.orders.find((item)=>item.id===id);if(!order)return notice(new Error("Order not found."));const question=prompt(`Ask about order ${order.orderId}:`);if(!question?.trim())return;const box=document.querySelector(`#order-assistance-${CSS.escape(id)}`);if(box)box.textContent="Checking this order…";try{const result=await api.assistant({message:question,order_number:order.orderId});if(box)box.textContent=result.answer;else toast(result.answer)}catch(error){if(box)box.textContent=error.message;else notice(error)}}

  window.BillCartIntegration = Object.freeze({ retry: (target)=>target.startsWith("admin:")?renderAdmin(target.slice(6)):target==="orders"?renderOrders():api.bootstrap(),
    signIn: async()=>{try{const email=document.querySelector("#email").value.trim(),password=document.querySelector("#password").value;await api.signIn(email,password)}catch(error){notice(error)}},
    register: async()=>{try{const result=await api.register(document.querySelector("#regName").value.trim(),document.querySelector("#regEmail").value.trim(),document.querySelector("#regPassword").value,document.querySelector("#regPhone").value.trim());if(result.emailConfirmationRequired)toast("Check your email to confirm the account, then sign in.")}catch(error){notice(error)}},
    saveProduct,deleteProduct,saveStock,updateShipment,saveCoupon,editCoupon,deleteCoupon,toggleCoupon,askOrder,
    renderOffers,
    applyOffer: (code) => applyCouponCode(code),
    applyBestCoupon: async () => { try { const result = await api.data("best-coupon", { items: state.cart }); if (!result.coupon) return notice(new Error("No eligible coupon improves this cart.")); state.coupon = result.coupon.code; state.billQuote = { ...result.quote, sub: result.quote.subtotal, delivery: result.quote.shipping }; go("cart"); } catch (error) { notice(error); } },
    cancel: async(id)=>{try{await api.cancelOrder(id);await reloadUserData();await renderOrders()}catch(error){notice(error)}},
    requestReturn: async(id)=>{const note=prompt("Optional return reason:")||"";try{await api.requestReturn(id,note);await reloadUserData();await renderOrders()}catch(error){notice(error)}},
  });

  window.login = loginPage;
  window.registerDemo = registerPage;
  window.logout = () => { void api.signOut().catch(notice); };
  window.signIn = () => window.BillCartIntegration.signIn();
  window.registerAccount = () => window.BillCartIntegration.register();
  window.bill = () => state.billQuote || { valid: false, subtotal: 0, sub: 0, coupon: 0, productDiscount: 0, taxable: 0, cgst: 0, sgst: 0, delivery: 0, shipping: 0, total: 0 };
  window.applyCoupon = async () => {
    const code=(document.querySelector("#coupon")?.value||"").trim().toUpperCase();if(!code)return toast("Enter a coupon code.");
    try{const result=await api.data("quote",{items:state.cart,coupon:code});if(!result.quote.valid)return toast(result.quote.error||"Coupon is not eligible.");state.coupon=code;state.billQuote={...result.quote,sub:result.quote.subtotal,delivery:result.quote.shipping};go("cart")}catch(error){notice(error)}
  };
  window.bestCoupon = () => window.BillCartIntegration.applyBestCoupon();
  window.removeCoupon = async () => {state.coupon="";try{state.billQuote=await api.refreshQuote();go("cart")}catch(error){notice(error)}};
  window.add = (id) => cartAction(()=>{const p=products.find((item)=>item.id===Number(id));if(!p||p.stock<1)throw new Error("Product unavailable.");const item=state.cart.find((entry)=>entry.id===Number(id));if(item){if(item.q>=p.stock)throw new Error("Stock limit reached.");item.q++}else state.cart.push({id:Number(id),q:1})});
  window.wish = (id) => (async()=>{if(!state.user)return go("login");const before=[...state.wish];state.wish=state.wish.includes(Number(id))?state.wish.filter((value)=>value!==Number(id)):[...state.wish,Number(id)];try{await api.data("wishlist-sync",{items:state.wish.map((value)=>({id:value}))});loadRoute()}catch(error){state.wish=before;notice(error)}})();
  window.qty = (id,delta) => cartAction(()=>{const item=state.cart.find((entry)=>entry.id===Number(id)),p=products.find((product)=>product.id===Number(id));if(!item||!p)throw new Error("Cart item unavailable.");if(item.q+Number(delta)<1){state.cart=state.cart.filter((entry)=>entry.id!==Number(id));return}if(item.q+Number(delta)>p.stock)throw new Error("Stock limit reached.");item.q+=Number(delta)});
  window.remove = (id) => cartAction(()=>{state.cart=state.cart.filter((item)=>item.id!==Number(id))});
  window.placeOrder = async () => {
    if(!state.user)return go("login");const address=bcReadAddress();if(!address)return toast("Enter a valid name, phone, address, city, state, and postal code.");
    if(!state.cart.length)return go("cart");const method=(state.checkout?.paymentMethod||document.querySelector('input[name="paymentMethod"]:checked')?.value||"UPI").toLowerCase().replaceAll(" ","_");
    const outcome=document.querySelector("#demoPayment")?.value||"success";checkoutKey=checkoutKey||crypto.randomUUID();const button=document.querySelector("#placeOrderButton");if(button)button.disabled=true;
    try{const result=await api.checkout({items:state.cart.map((item)=>({product_id:item.id,quantity:item.q})),address:{recipient:address.name,phone:address.phone,address_line:address.address,city:address.city,region:address.state,postal_code:address.pincode},payment_method:method,test_outcome:outcome,coupon:state.coupon||null,idempotency_key:checkoutKey});
      if(document.querySelector("#saveAddressOnOrder")?.checked)await api.data("address-save",{address});checkoutKey="";await reloadUserData();const order=state.orders.find((item)=>item.id===result.order_id);if(order)return go("success",order.orderId);return go("orders");
    }catch(error){notice(error)}finally{if(button)button.disabled=false}
  };
  window.saveProfile = async()=>{const name=document.querySelector("#profileName").value.trim(),phone=document.querySelector("#profilePhone").value.trim();try{await api.data("profile-update",{name,phone});state.user.name=name;state.profiles[state.user.id]={...state.profiles[state.user.id],name,phone,email:state.user.email};go("account")}catch(error){notice(error)}};
  window.editAddress = (index)=>{bcEditAddress=Number(index);previousRoute("account")};
  window.addAddress = async()=>{const ids={name:"addrName",phone:"addrPhone",address:"addrLine",city:"addrCity",state:"addrState",pincode:"addrPin"},address=Object.fromEntries(Object.entries(ids).map(([key,id])=>[key,(document.querySelector(`#${id}`)?.value||"").trim()]));if(bcEditAddress>=0&&state.addresses[bcEditAddress])address.id=state.addresses[bcEditAddress].id;try{await api.data("address-save",{address});bcEditAddress=-1;await api.loadAccountData();go("account")}catch(error){notice(error)}};
  window.deleteAddress = async(index)=>{const address=state.addresses[index];if(!address)return;try{await api.data("address-delete",{id:address.id});await api.loadAccountData();go("account")}catch(error){notice(error)}};
  window.ask = async(question)=>{const target=document.querySelector("#answer");if(target)target.textContent="Checking the catalogue…";try{const result=await api.assistant({message:question});if(target)target.textContent=result.answer}catch(error){if(target)target.textContent=error.message;else notice(error)}};
  window.go = (page,arg,replace=false)=>{
    if(page==="offers") { if(!replace)history.pushState({route:"offers"},"",location.pathname+"#/offers");void renderOffers();return; }
    if(page==="admin") {if(!replace)history.pushState({route:"admin"},"",location.pathname+"#/admin");void renderAdmin(state.adminSection||"Dashboard");return;}
    if(page==="orders") {if(!replace)history.pushState({route:"orders"},"",location.pathname+"#/orders");void renderOrders();return;}
    if(page==="tracking") {if(!replace)history.pushState({route:routePath(page,arg)},"",location.pathname+"#/"+routePath(page,arg));const html=renderTracking(String(arg||""));document.querySelector("#app").innerHTML=html;return;}
    return previousRoute(page,arg,replace);
  };
  window.adminPanel=(section)=>{state.adminSection=section;go("admin")};
  window.trackOrder=(id)=>renderTracking(String(id));
  window.cancelOrder=(id)=>window.BillCartIntegration.cancel(state.orders.find((order)=>order.orderId===id||order.id===id)?.id||id);
  window.requestReturn=(id)=>window.BillCartIntegration.requestReturn(state.orders.find((order)=>order.orderId===id||order.id===id)?.id||id);
  window.updateProduct=(id)=>window.BillCartIntegration.saveProduct(id);
  window.updateStock=(id)=>window.BillCartIntegration.saveStock(id);
  window.createProduct=()=>window.BillCartIntegration.saveProduct();
  window.createCoupon=()=>window.BillCartIntegration.saveCoupon();
  window.applyCoupon=window.applyCoupon;
  window.loadRoute=()=>{const parts=(location.hash.replace(/^#\/?/,"")||"home").split("/").map((part)=>{try{return decodeURIComponent(part)}catch{return ""}});if(parts[0]==="orders"&&parts[1])return previousRoute("invoice",parts[1],true);return go(parts[0],parts[1],true)};
  window.addEventListener("hashchange",window.loadRoute);window.addEventListener("popstate",window.loadRoute);
  window.addEventListener("billcart:ready",()=>{if(state.user?.role==="admin")state.adminSection="Dashboard"});
})();
