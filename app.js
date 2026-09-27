const CFG = window.HOTEL_CONFIG || {};
const LIVE = Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey && CFG.demoMode !== true);
const ADMIN_MODE = new URLSearchParams(location.search).has("admin");
const DELIVERY_MODE = new URLSearchParams(location.search).get("order") === "delivery";
let dbClient = null;
let currentTable = null;
let currentCategory = "all";
let vegOnly = false;
let currentQuery = "";
let cart = {};
let activeOrder = null;
let trackingTimer = null;
let adminData = { categories: [], menu: [], tables: [], orders: [], settings: {} };
let selectedOrderId = null;
let orderFilter = "active";
let menuAdminCategory = "all";
let reportRange = "today";
let realtimeChannel = null;
let qrModule = null;
let demoLoggedIn = false;
let waitGameScore = 0;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const TABLE_PARAM = new URLSearchParams(location.search).get("table") || new URLSearchParams(location.search).get("t");
const DEFAULT_SETTINGS = { restaurant_name: "Juniper & Stone", phone: "+91 98765 43210", address: "12 Garden Lane, Bengaluru", tax_percent: 5, currency: "INR", upi_id: "", gstin: "", logo_url: "", offer_message: "Hi! A little treat from {business}: we have something special for you.", opening_hours: "11 am – 11 pm", estimated_time: "15–25 min", is_accepting_orders: true, is_delivery_enabled: true, delivery_city: "Bengaluru", delivery_areas: ["Indiranagar", "Koramangala", "MG Road"], delivery_fee: 0, bill_footer: "Thank you for dining with us. We hope to see you again!" };
const STATUS = {
  pending: { label: "New", hint: "Order received", next: "accepted", nextLabel: "Accept order", icon: "✳" },
  accepted: { label: "Accepted", hint: "Order accepted by the kitchen", next: "preparing", nextLabel: "Start preparing", icon: "✓" },
  preparing: { label: "Preparing", hint: "Our kitchen is making your order", next: "ready", nextLabel: "Mark ready", icon: "◷" },
  ready: { label: "Ready", hint: "Ready to be served", next: "served", nextLabel: "Mark served", icon: "⌑" },
  served: { label: "Served", hint: "Enjoy your meal", next: null, nextLabel: "Complete", icon: "♡" },
  cancelled: { label: "Cancelled", hint: "This order was cancelled", next: null, nextLabel: "Cancelled", icon: "×" }
};
const DEMO_CATEGORIES = [
  { id: "cat-small", slug: "small-plates", name: "Small plates", position: 1 },
  { id: "cat-mains", slug: "from-the-kitchen", name: "From the kitchen", position: 2 },
  { id: "cat-sides", slug: "sides", name: "Sides & greens", position: 3 },
  { id: "cat-sweets", slug: "something-sweet", name: "Something sweet", position: 4 },
  { id: "cat-drinks", slug: "to-drink", name: "To drink", position: 5 }
];
const DEMO_MENU = [
  { id: "dish-1", category_id: "cat-small", name: "Burrata & stone fruit", description: "Creamy burrata, ripe peaches, basil oil, toasted sourdough.", price: 425, discount_percent: 10, is_today_special: true, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=420&q=80", tag: "A guest favourite", position: 1 },
  { id: "dish-2", category_id: "cat-small", name: "Crispy lotus stem", description: "Tossed in a sweet chilli glaze with sesame and spring onion.", price: 295, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&fit=crop&w=420&q=80", tag: "Crunchy & bright", position: 2 },
  { id: "dish-3", category_id: "cat-small", name: "Charred chicken skewers", description: "Yoghurt-marinated, served with mint chutney and pickled onion.", price: 385, is_vegetarian: false, is_available: true, image_url: "https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=420&q=80", tag: "From the grill", position: 3 },
  { id: "dish-4", category_id: "cat-mains", name: "Wild mushroom risotto", description: "Arborio rice, forest mushrooms, parmesan, a little patience.", price: 545, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=420&q=80", tag: "Comfort in a bowl", position: 1 },
  { id: "dish-5", category_id: "cat-mains", name: "Slow-braised lamb", description: "Six-hour lamb shoulder, saffron rice, crispy shallots.", price: 695, is_vegetarian: false, is_available: true, image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=420&q=80", tag: "Slow & lovely", position: 2 },
  { id: "dish-6", category_id: "cat-mains", name: "Garden harvest bowl", description: "Roasted seasonal vegetables, hummus, quinoa, herby tahini.", price: 475, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=420&q=80", tag: "Plant-powered", position: 3 },
  { id: "dish-7", category_id: "cat-sides", name: "Little gem salad", description: "Crisp leaves, pear, toasted walnut, honey mustard dressing.", price: 285, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=420&q=80", tag: "Fresh & crisp", position: 1 },
  { id: "dish-8", category_id: "cat-sides", name: "Rosemary shoestring fries", description: "Thin-cut, twice cooked, dusted with parmesan and rosemary.", price: 195, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=420&q=80", tag: "A little extra", position: 2 },
  { id: "dish-9", category_id: "cat-sweets", name: "Warm chocolate fondant", description: "Dark chocolate, soft centre, vanilla bean ice cream.", price: 325, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=420&q=80", tag: "Best shared", position: 1 },
  { id: "dish-10", category_id: "cat-sweets", name: "Mango & cardamom kulfi", description: "Alphonso mango, toasted pistachio, a pinch of cardamom.", price: 245, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=420&q=80", tag: "Seasonal", position: 2 },
  { id: "dish-11", category_id: "cat-drinks", name: "House lemonade", description: "Fresh lime, a little mint, just the right amount of fizz.", price: 145, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1513558161293-cdaf765edfd7?auto=format&fit=crop&w=420&q=80", tag: "House-made", position: 1 },
  { id: "dish-12", category_id: "cat-drinks", name: "Cold brew coffee", description: "Slow-steeped overnight, served over ice with oat milk.", price: 185, is_vegetarian: true, is_available: true, image_url: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=420&q=80", tag: "Slow mornings", position: 2 }
];

const DEMO_KEY = "juniper-stone-demo-v1";
function readDemo() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY));
    if (saved) return { ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
  } catch { /* Use the starter data when storage is empty or unavailable. */ }
  const tables = Array.from({ length: 8 }, (_, i) => ({ id: `table-${i + 1}`, table_number: String(i + 1).padStart(2, "0"), qr_token: `demo-table-${String(i + 1).padStart(2, "0")}`, capacity: i < 4 ? 2 : 4, is_active: true }));
  const initial = { categories: DEMO_CATEGORIES, menu: DEMO_MENU, tables, orders: [], settings: DEFAULT_SETTINGS };
  writeDemo(initial);
  return initial;
}
function writeDemo(data) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(data)); } catch { toast("Browser storage is full. Your demo data may not be saved.", "error"); } }
function demoAdminSessionActive() { try { return sessionStorage.getItem("tableside-demo-admin") === "true"; } catch { return false; } }
function setDemoAdminSession(active) { try { if (active) sessionStorage.setItem("tableside-demo-admin", "true"); else sessionStorage.removeItem("tableside-demo-admin"); } catch { /* The demo remains available for the current page when session storage is blocked. */ } }
let demo = readDemo();

async function initBackend() {
  if (!LIVE) return;
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    dbClient = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data: { session } } = await dbClient.auth.getSession();
    if (session && ADMIN_MODE) await checkStaffSession(session.user);
  } catch (error) {
    console.error(error);
    toast("Could not connect to Supabase. Check config.js and your connection.", "error");
  }
}

function esc(value = "") { return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]); }
function money(value) {
  const currency = adminData.settings.currency || demo.settings.currency || "INR";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(value) || 0); }
  catch { return `₹${(Number(value) || 0).toFixed(0)}`; }
}
function dateTime(value, opts = {}) { return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", ...opts }).format(new Date(value)); }
function shortDate(value) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(value)); }
function orderCode(order) { return order.order_number != null ? `#${String(order.order_number).padStart(4, "0")}` : `#${String(order.id).slice(-4).toUpperCase()}`; }
function toast(message, type = "normal") {
  const node = document.createElement("div"); node.className = `toast ${type}`; node.textContent = message; $("#toast-region").append(node); setTimeout(() => node.remove(), 3700);
}
function statusPill(status) { const info = STATUS[status] || STATUS.pending; return `<span class="status-pill ${esc(status)}">${esc(info.label)}</span>`; }
function tableName(tableId) { const t = adminData.tables.find(x => x.id === tableId) || demo.tables.find(x => x.id === tableId); return t ? `Table ${t.table_number}` : "Takeaway"; }
function orderServiceLabel(order) {
  if (order.order_type === "delivery") return order.delivery_area ? `Home delivery · ${order.delivery_area}` : "Home delivery";
  return order.table_number ? `Table ${order.table_number}` : tableName(order.table_id);
}
function itemList(order) { return order.order_items || order.items || []; }
function getOrderTotal(order) { return Number(order.total ?? order.grand_total ?? itemList(order).reduce((a, x) => a + Number(x.price_at_order || x.price || 0) * Number(x.quantity || 0), 0)); }
function discountPercent(item) { return Math.min(100, Math.max(0, Number(item.discount_percent) || 0)); }
function salePrice(item) { return Math.round((Number(item.price) * (1 - discountPercent(item) / 100) + Number.EPSILON) * 100) / 100; }

async function loadGuestData() {
  $("#demo-banner").hidden = Boolean(LIVE && dbClient);
  let categories = demo.categories, menu = demo.menu, settings = demo.settings;
  if (LIVE && dbClient) {
    try {
      const [catRes, menuRes, settingsRes] = await Promise.all([
        dbClient.from("menu_categories").select("id,slug,name,position,is_active").eq("is_active", true).order("position"),
        dbClient.from("menu_items").select("id,category_id,name,description,price,discount_percent,is_today_special,is_vegetarian,is_available,image_url,tag,position").eq("is_available", true).order("position"),
        dbClient.from("restaurant_settings").select("*").eq("id", true).single()
      ]);
      if (catRes.error) throw catRes.error; if (menuRes.error) throw menuRes.error; if (settingsRes.error) throw settingsRes.error;
      categories = catRes.data || []; menu = menuRes.data || []; settings = settingsRes.data || DEFAULT_SETTINGS;
      if (!Object.prototype.hasOwnProperty.call(settings, "is_delivery_enabled")) { settings = { ...settings, is_delivery_enabled: false, delivery_city: "", delivery_areas: [] }; }
    } catch (error) { console.error(error); settings = { ...DEFAULT_SETTINGS, is_delivery_enabled: false, delivery_city: "", delivery_areas: [] }; toast("Menu couldn't load from the live backend. Showing the sample menu.", "error"); }
  }
  adminData.categories = categories; adminData.menu = menu; adminData.settings = { ...DEFAULT_SETTINGS, ...settings };
  $$("[data-setting='restaurant_name']").forEach(el => el.textContent = settings.restaurant_name || DEFAULT_SETTINGS.restaurant_name);
  applyBrand(settings);
  $("#opening-hours").textContent = settings.opening_hours || DEFAULT_SETTINGS.opening_hours;
  $("#estimated-time").textContent = settings.estimated_time || DEFAULT_SETTINGS.estimated_time;
  $("#restaurant-status").classList.toggle("closed", settings.is_accepting_orders === false);
  $("#restaurant-status b").textContent = settings.is_accepting_orders === false ? "Closed for orders" : "Open today";
  document.body.classList.toggle("browse-only", !TABLE_PARAM && !DELIVERY_MODE);
  if (isDeliveryOrder()) {
    $("#menu-welcome-title").innerHTML = `Your favourites<br /><em>at your door.</em>`;
    $("#menu-welcome-copy").textContent = `Freshly prepared and delivered within ${settings.delivery_city || "our local service area"}. Choose a listed area when you check out.`;
  } else if (!TABLE_PARAM) {
    $("#menu-welcome-title").innerHTML = `Fresh from<br /><em>our kitchen.</em>`;
    $("#menu-welcome-copy").textContent = "Browse our menu. Scan your table QR or choose home delivery to place an order.";
  }
  configureDeliveryCheckout();
  if (TABLE_PARAM) await resolveGuestTable(categories, menu);
  renderMenu(categories, menu);
}

function isDeliveryOrder() { return DELIVERY_MODE && !TABLE_PARAM; }
function configuredDeliveryAreas() {
  const source = adminData.settings.delivery_areas || [];
  return (Array.isArray(source) ? source : String(source).split(/\r?\n/)).map(area => String(area).trim()).filter(Boolean);
}
function deliveryIsAvailable() {
  return adminData.settings.is_delivery_enabled !== false && Boolean(String(adminData.settings.delivery_city || "").trim()) && configuredDeliveryAreas().length > 0;
}
function configureDeliveryCheckout() {
  const fields = $("#delivery-fields");
  if (!fields) return;
  fields.hidden = !isDeliveryOrder();
  if (!isDeliveryOrder()) return;
  $("#delivery-city").value = adminData.settings.delivery_city || "";
  const areaSelect = $("#delivery-area");
  const selectedArea = areaSelect.value;
  areaSelect.innerHTML = `<option value="">Choose your area</option>` + configuredDeliveryAreas().map(area => `<option value="${esc(area)}">${esc(area)}</option>`).join("");
  if (configuredDeliveryAreas().includes(selectedArea)) areaSelect.value = selectedArea;
  const unavailable = !deliveryIsAvailable();
  $("#delivery-mode-warning")?.remove();
  if (unavailable) {
    const message = document.createElement("p");
    message.id = "delivery-mode-warning";
    message.className = "delivery-mode-warning";
    message.textContent = "Home delivery is not set up right now. Please contact the restaurant.";
    fields.prepend(message);
  }
  $("#cart-table-label").textContent = deliveryIsAvailable()
    ? `Delivery within ${adminData.settings.delivery_city}. Choose one of the listed areas.`
    : "Home delivery is currently unavailable.";
}

async function resolveGuestTable() {
  if (!TABLE_PARAM) { currentTable = null; $("#table-context-text").textContent = DELIVERY_MODE ? `Home delivery · ${adminData.settings.delivery_city || "service area"}` : "Menu browsing"; $("#cart-table-label").textContent = DELIVERY_MODE ? `Delivering within ${adminData.settings.delivery_city || "your city"}. Choose an area and enter your address.` : "Open this menu from your table QR to place a dine-in order."; return; }
  if (LIVE && dbClient) {
    try {
      const { data, error } = await dbClient.rpc("get_table_info", { p_table_token: TABLE_PARAM });
      if (error) throw error;
      currentTable = data?.is_active ? { table_number: data.table_number, qr_token: TABLE_PARAM, id: null } : null;
    } catch (error) { console.error(error); currentTable = null; }
  } else currentTable = demo.tables.find(t => (t.qr_token === TABLE_PARAM || t.table_number === TABLE_PARAM) && t.is_active !== false) || null;
  if (!currentTable) {
    $("#table-context-text").textContent = "Table link not recognised — please ask a team member";
    $("#cart-table-label").textContent = "Table QR not recognised. Let our team know before sending the order.";
    toast("We couldn't recognise this table QR. Please ask a team member.", "error");
  } else {
    $("#table-context-text").textContent = `You're at Table ${currentTable.table_number}`;
    $("#cart-table-label").textContent = `Ordering for Table ${currentTable.table_number} · We'll bring it right over.`;
  }
}

function renderMenu(categories = adminData.categories, menu = adminData.menu) {
  const available = menu.filter(item => item.is_available !== false);
  const displayedCats = categories.filter(cat => available.some(item => item.category_id === cat.id));
  const counts = new Map(displayedCats.map(cat => [cat.id, available.filter(item => item.category_id === cat.id).length]));
  $("#category-list").innerHTML = `<button class="category-tab ${currentCategory === "all" ? "active" : ""}" data-category="all" type="button">Everything <span class="category-count">${available.length}</span></button>` + displayedCats.map(cat => `<button class="category-tab ${currentCategory === cat.id ? "active" : ""}" data-category="${esc(cat.id)}" type="button">${esc(cat.name)} <span class="category-count">${counts.get(cat.id)}</span></button>`).join("");
  let groups = currentCategory === "all" ? displayedCats : displayedCats.filter(cat => cat.id === currentCategory);
  const term = currentQuery.trim().toLowerCase();
  let html = "";
  if (currentCategory === "all" && !term && !vegOnly) {
    const specials = available.filter(item => item.is_today_special);
    if (specials.length) html += `<section class="today-specials"><div class="menu-group-heading"><h3>Today’s special</h3><span>Just for today ✳</span></div><div class="dish-grid">${specials.map(dishCard).join("")}</div></section>`;
  }
  for (const cat of groups) {
    const items = available.filter(item => item.category_id === cat.id && (!vegOnly || item.is_vegetarian) && (!term || `${item.name} ${item.description || ""} ${cat.name}`.toLowerCase().includes(term)));
    if (!items.length) continue;
    html += `<section class="menu-group"><div class="menu-group-heading"><h3>${esc(cat.name)}</h3><span>${items.length} ${items.length === 1 ? "dish" : "dishes"}</span></div><div class="dish-grid">${items.map(dishCard).join("")}</div></section>`;
  }
  $("#menu-content").innerHTML = html || `<div class="empty-state"><strong>Nothing on that plate.</strong>Try another search or category.</div>`;
  $$(".category-tab").forEach(button => button.addEventListener("click", () => { currentCategory = button.dataset.category; renderMenu(); }));
  $$("[data-add-dish]").forEach(button => button.addEventListener("click", () => changeCart(button.dataset.addDish, 1)));
}

function dishCard(item) {
  const qty = cart[item.id]?.quantity || 0;
  const discount = discountPercent(item); const price = salePrice(item);
  return `<article class="dish-card ${item.is_today_special ? "is-special" : ""}"><div class="dish-copy"><div class="dish-topline"><span class="diet-icon ${item.is_vegetarian ? "" : "nonveg"}" aria-label="${item.is_vegetarian ? "Vegetarian" : "Non-vegetarian"}"></span>${item.is_today_special ? `<span class="dish-tag special-tag">TODAY'S SPECIAL</span>` : `<span class="dish-tag">${discount ? `${discount}% OFF` : esc(item.tag || (item.is_vegetarian ? "Garden fresh" : "From our kitchen"))}</span>`}</div><h4>${esc(item.name)}</h4><p class="dish-description">${esc(item.description || "Made fresh in our kitchen.")}</p><div class="dish-bottom"><span class="dish-price">${discount ? `<del>${money(item.price)}</del> ` : ""}${money(price)}</span>${qty ? `<span class="quantity-control"><button class="quantity-button" data-card-qty="${esc(item.id)}" data-delta="-1" aria-label="Remove one" type="button">−</button><b>${qty}</b><button class="quantity-button" data-card-qty="${esc(item.id)}" data-delta="1" aria-label="Add one" type="button">+</button></span>` : `<button class="add-dish" data-add-dish="${esc(item.id)}" aria-label="Add ${esc(item.name)} to order" type="button">+</button>`}</div></div><div class="dish-visual">${item.image_url ? `<img loading="lazy" src="${esc(item.image_url)}" alt="${esc(item.name)}" onerror="this.remove()" />` : `<span class="dish-visual-placeholder">✳</span>`}</div></article>`;
}
function applyBrand(settings = adminData.settings) {
  const businessName = settings?.restaurant_name || DEFAULT_SETTINGS.restaurant_name;
  document.title = `${businessName} — ${ADMIN_MODE ? (new URLSearchParams(location.search).get("view") === "settings" ? "Settings" : "Admin Dashboard") : isDeliveryOrder() ? "Home Delivery" : TABLE_PARAM ? "Table Menu" : "Menu"}`;
  $(".brand-lockup[aria-label]")?.setAttribute("aria-label", `${businessName} home`);
  for (const mark of $$('[data-brand-mark]')) {
    const image = $("[data-brand-logo]", mark); const initials = $(".brand-initials", mark);
    if (image && settings?.logo_url) { image.src = settings.logo_url; image.hidden = false; mark.classList.add("has-logo"); if (initials) initials.hidden = true; }
    else if (image) { image.hidden = true; image.removeAttribute("src"); mark.classList.remove("has-logo"); if (initials) initials.hidden = false; }
  }
}

function changeCart(id, delta) {
  if (!TABLE_PARAM && !DELIVERY_MODE) { toast("Scan a table QR or choose home delivery to place an order."); return; }
  const item = (adminData.menu.length ? adminData.menu : demo.menu).find(x => x.id === id);
  if (!item) return;
  const next = (cart[id]?.quantity || 0) + delta;
  if (next < 1) delete cart[id]; else cart[id] = { item, quantity: next };
  renderMenu(); renderCartDock();
}
function cartItems() { return Object.values(cart); }
function cartSummary() {
  const listSubtotal = cartItems().reduce((sum, row) => sum + Number(row.item.price) * row.quantity, 0);
  const subtotal = cartItems().reduce((sum, row) => sum + salePrice(row.item) * row.quantity, 0);
  const discount = listSubtotal - subtotal;
  const taxPercent = Number(adminData.settings.tax_percent || 0);
  const tax = Math.round(subtotal * taxPercent) / 100;
  const deliveryFee = isDeliveryOrder() ? Math.max(0, Number(adminData.settings.delivery_fee) || 0) : 0;
  return { listSubtotal, subtotal, discount, tax, taxPercent, deliveryFee, total: subtotal + tax + deliveryFee };
}
function renderCartDock() {
  const count = cartItems().reduce((sum, row) => sum + row.quantity, 0);
  $("#cart-dock").hidden = !count;
  if (!count) return;
  $("#dock-count").textContent = count; $("#dock-items").textContent = `${count} ${count === 1 ? "item" : "items"}`;
  $("#dock-total").textContent = money(cartSummary().total);
  $("#cart-dock .dock-summary strong").textContent = isDeliveryOrder() ? "Your delivery order" : "Your table order";
}
function openCart() {
  if (!cartItems().length) return;
  if (!TABLE_PARAM && !DELIVERY_MODE) { toast("Scan a table QR or choose home delivery to place an order."); return; }
  if (isDeliveryOrder() && !deliveryIsAvailable()) { toast("Home delivery is not configured right now.", "error"); return; }
  if (TABLE_PARAM && !currentTable) { toast("Please ask a team member to confirm your table.", "error"); return; }
  $("#cart-overlay").hidden = false; renderCartSheet(); document.body.classList.add("modal-open");
}
function closeCart() { $("#cart-overlay").hidden = true; document.body.classList.remove("modal-open"); }
function renderCartSheet() {
  $("#cart-lines").innerHTML = cartItems().map(({ item, quantity }) => `<div class="cart-line"><div class="cart-line-main"><h4>${esc(item.name)}${item.is_today_special ? ` <span class="special-inline">Today’s special</span>` : ""}</h4><small>${discountPercent(item) ? `<del>${money(item.price)}</del> ${money(salePrice(item))}` : `${money(item.price)}`} each</small></div><div class="cart-line-controls"><button class="quantity-button" data-cart-qty="${esc(item.id)}" data-delta="-1" aria-label="Remove one" type="button">−</button><b>${quantity}</b><button class="quantity-button" data-cart-qty="${esc(item.id)}" data-delta="1" aria-label="Add one" type="button">+</button><span class="cart-line-total">${money(salePrice(item) * quantity)}</span></div></div>`).join("") || `<div class="cart-empty"><strong>Room for something lovely.</strong>Your basket is empty for now.</div>`;
  const sums = cartSummary();
  $("#cart-totals").innerHTML = `${sums.discount ? `<div class="total-row discount-row"><span>You saved</span><span>−${money(sums.discount)}</span></div>` : ""}<div class="total-row"><span>Subtotal</span><span>${money(sums.subtotal)}</span></div>${sums.tax ? `<div class="total-row"><span>Tax (${sums.taxPercent}%)</span><span>${money(sums.tax)}</span></div>` : ""}${isDeliveryOrder() ? `<div class="total-row"><span>Delivery fee</span><span>${sums.deliveryFee ? money(sums.deliveryFee) : "Free"}</span></div>` : ""}<div class="total-row grand"><span>Total</span><span>${money(sums.total)}</span></div>`;
  const acceptingOrders = adminData.settings.is_accepting_orders !== false;
  const deliveryActive = !isDeliveryOrder() || deliveryIsAvailable();
  $("#place-order").disabled = !cartItems().length || !acceptingOrders || !deliveryActive;
  $("#place-order").innerHTML = !acceptingOrders ? `Orders are paused` : isDeliveryOrder() ? `Place delivery order <span aria-hidden="true">→</span>` : `Send to the kitchen <span aria-hidden="true">→</span>`;
  $(".sheet-header .eyebrow").textContent = isDeliveryOrder() ? "HOME DELIVERY" : "YOUR TABLE ORDER";
  $("#checkout-footnote").textContent = isDeliveryOrder() ? "We’ll deliver within the selected city area." : "You can pay at the counter after your meal.";
  $$('[data-cart-qty]').forEach(button => button.addEventListener("click", () => { changeCart(button.dataset.cartQty, Number(button.dataset.delta)); renderCartSheet(); }));
}

async function placeOrder() {
  if (!cartItems().length) return;
  if (!TABLE_PARAM && !DELIVERY_MODE) { toast("Scan a table QR or choose home delivery to place an order.", "error"); return; }
  if (adminData.settings.is_accepting_orders === false) { toast("We're not taking new orders right now. Please ask a team member.", "error"); return; }
  if ($("#marketing-opt-in").checked) {
    const digits = normalizedPhone($("#customer-phone").value);
    if (digits.length < 10 || digits.length > 15) { toast("Enter a valid mobile number for WhatsApp offers, or leave the offer box unchecked.", "error"); $("#customer-phone").focus(); return; }
  }
  if (TABLE_PARAM && !currentTable) { toast("Table QR not recognised.", "error"); return; }
  let deliveryDetails = null;
  if (isDeliveryOrder()) {
    if (!deliveryIsAvailable()) { toast("Home delivery is not configured right now.", "error"); return; }
    const area = $("#delivery-area").value;
    const address = $("#delivery-address").value.trim();
    if (!configuredDeliveryAreas().includes(area)) { toast("Choose an area from the delivery list.", "error"); $("#delivery-area").focus(); return; }
    if (!address) { toast("Enter the full delivery address.", "error"); $("#delivery-address").focus(); return; }
    deliveryDetails = { city: adminData.settings.delivery_city.trim(), area, address, postal_code: $("#delivery-postal-code").value.trim() };
  }
  const button = $("#place-order"); button.disabled = true; button.innerHTML = `<span class="spinner"></span> Sending…`;
  const summary = cartSummary();
  const orderPayload = { order_type: currentTable ? "dine_in" : "delivery", customer_name: $("#customer-name").value.trim(), customer_phone: $("#customer-phone").value.trim(), marketing_opt_in: $("#marketing-opt-in").checked, customer_note: $("#order-note").value.trim(), delivery_city: deliveryDetails?.city || null, delivery_area: deliveryDetails?.area || null, delivery_address: deliveryDetails?.address || null, delivery_postal_code: deliveryDetails?.postal_code || null, delivery_fee: summary.deliveryFee, total: summary.total, subtotal: summary.subtotal, discount_total: summary.discount, tax_total: summary.tax, status: "pending", table_id: currentTable?.id || null, table_number: currentTable?.table_number || null, created_at: new Date().toISOString(), items: cartItems().map(({ item, quantity }) => ({ menu_item_id: item.id, name: item.name, list_price_at_order: Number(item.price), price_at_order: salePrice(item), discount_percent_at_order: discountPercent(item), discount_amount: Math.round((Number(item.price) - salePrice(item)) * quantity * 100) / 100, quantity, is_vegetarian: item.is_vegetarian, is_today_special_at_order: Boolean(item.is_today_special) })) };
  try {
    if (LIVE && dbClient) {
      const { data, error } = await dbClient.rpc("create_order", { p_table_token: currentTable?.qr_token || null, p_customer_name: orderPayload.customer_name || null, p_customer_phone: orderPayload.customer_phone || null, p_marketing_opt_in: orderPayload.marketing_opt_in, p_customer_note: orderPayload.customer_note || null, p_items: orderPayload.items.map(i => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })), p_order_type: orderPayload.order_type, p_delivery_details: deliveryDetails || {} });
      if (error) throw error;
      activeOrder = { ...orderPayload, id: data.id, order_number: data.order_number, public_token: data.public_token, total: Number(data.grand_total), subtotal: Number(data.subtotal), discount_total: Number(data.discount_total), tax_total: Number(data.tax_total), delivery_fee: Number(data.delivery_fee || 0) };
    } else {
      demo = readDemo();
      activeOrder = { ...orderPayload, id: crypto.randomUUID(), order_number: Math.max(0, ...demo.orders.map(o => Number(o.order_number) || 0)) + 1, public_token: crypto.randomUUID(), payment_status: "unpaid" };
      demo.orders.unshift(activeOrder); writeDemo(demo);
    }
    $("#success-number").textContent = orderCode(activeOrder); $("#success-status").textContent = STATUS.pending.hint;
    $("#success-title").innerHTML = isDeliveryOrder() ? `Delivery order sent<span class="heading-dot">.</span>` : `Order sent<span class="heading-dot">.</span>`;
    $("#success-copy").textContent = isDeliveryOrder() ? `We’ll bring it to ${deliveryDetails.area}, ${deliveryDetails.city}.` : "Our kitchen is on it. We'll bring everything right over.";
    $("#success-overlay").hidden = false; $("#cart-overlay").hidden = true;
    waitGameScore = 0;
    cart = {}; renderCartDock(); renderMenu();
    $("#customer-name").value = ""; $("#customer-phone").value = ""; $("#marketing-opt-in").checked = false; $("#order-note").value = ""; $("#delivery-area").value = ""; $("#delivery-address").value = ""; $("#delivery-postal-code").value = "";
    toast("Your order is on its way to the kitchen.", "success");
  } catch (error) { console.error(error); toast(error.message || "The order couldn't be sent. Please try again.", "error"); }
  button.disabled = false; button.innerHTML = isDeliveryOrder() ? `Place delivery order <span aria-hidden="true">→</span>` : `Send to the kitchen <span aria-hidden="true">→</span>`;
}

async function openTracking() {
  if (!activeOrder) return;
  $("#success-overlay").hidden = true; $("#tracking-overlay").hidden = false;
  $("#tracking-meta").textContent = `${orderCode(activeOrder)} · ${currentTable ? `Table ${currentTable.table_number}` : activeOrder.order_type === "delivery" ? `Home delivery · ${activeOrder.delivery_area || ""}` : "Takeaway"}`;
  await refreshTracking(); clearInterval(trackingTimer); trackingTimer = setInterval(refreshTracking, LIVE ? 7000 : 4000);
}
function renderWaitGame() {
  const completed = waitGameScore >= 8;
  $("#wait-game-title").textContent = completed ? "Garden helper, promoted" : "Kitchen garden";
  $("#wait-game-copy").textContent = completed ? "Nice work — you're basically a sous-chef. Tap to play again." : "Tap the herb button 8 times to pick a tiny bunch.";
  $("#wait-game-button").innerHTML = `${completed ? "✨" : "🌿"} <span id="wait-game-score">${completed ? "Play again" : `${waitGameScore}/8`}</span>`;
}
async function refreshTracking() {
  if (!activeOrder) return;
  let status = activeOrder.status;
  if (LIVE && dbClient && activeOrder.public_token) {
    try { const { data, error } = await dbClient.rpc("get_order_status", { p_public_token: activeOrder.public_token }); if (!error && data?.status) status = data.status; }
    catch (error) { console.error(error); }
  } else {
    demo = readDemo(); status = demo.orders.find(o => o.id === activeOrder.id)?.status || status;
  }
  activeOrder.status = status;
  const sequence = ["pending", "accepted", "preparing", "ready", "served"];
  const index = sequence.indexOf(status);
  const descriptions = { pending: "Sent to the kitchen", accepted: "The kitchen has accepted it", preparing: "Freshly made just for you", ready: "Ready to be served at your table", served: "Enjoy every bite" };
  $("#tracking-title").innerHTML = status === "served" ? "Hope you love it<span class=\"heading-dot\">.</span>" : status === "cancelled" ? "Order cancelled<span class=\"heading-dot\">.</span>" : "On its way<span class=\"heading-dot\">.</span>";
  $("#tracking-steps").innerHTML = status === "cancelled" ? `<div class="track-step current"><span class="track-node">×</span><div class="track-copy"><strong>Order cancelled</strong><small>Ask one of our team if you need help.</small></div></div>` : sequence.map((step, i) => `<div class="track-step ${i < index ? "done" : i === index ? "current" : ""}"><span class="track-node">${i < index ? "✓" : STATUS[step].icon}</span><div class="track-copy"><strong>${esc(STATUS[step].label)}</strong><small>${esc(descriptions[step])}</small></div></div>`).join("");
  renderWaitGame();
}

function initGuestEvents() {
  $("#menu-search").addEventListener("input", event => { currentQuery = event.target.value; renderMenu(); });
  $("#veg-filter").addEventListener("click", event => { vegOnly = !vegOnly; event.currentTarget.setAttribute("aria-pressed", String(vegOnly)); renderMenu(); });
  $("#open-cart").addEventListener("click", openCart); $("#place-order").addEventListener("click", placeOrder);
  $$("[data-close-cart]").forEach(el => el.addEventListener("click", closeCart));
  $("#track-order").addEventListener("click", openTracking);
  $("#wait-game-button").addEventListener("click", () => {
    waitGameScore = waitGameScore >= 8 ? 0 : waitGameScore + 1;
    renderWaitGame();
  });
  $("#new-order").addEventListener("click", () => { $("#success-overlay").hidden = true; document.body.classList.remove("modal-open"); window.scrollTo({ top: document.querySelector(".menu-section").offsetTop - 20, behavior: "smooth" }); });
  $$("[data-close-success]").forEach(el => el.addEventListener("click", () => { $("#success-overlay").hidden = true; document.body.classList.remove("modal-open"); }));
  $$("[data-close-tracking]").forEach(el => el.addEventListener("click", () => { $("#tracking-overlay").hidden = true; clearInterval(trackingTimer); document.body.classList.remove("modal-open"); }));
  document.addEventListener("click", event => { const btn = event.target.closest("[data-card-qty]"); if (btn) changeCart(btn.dataset.cardQty, Number(btn.dataset.delta)); });
  document.addEventListener("keydown", event => { if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) { event.preventDefault(); $("#menu-search").focus(); } if (event.key === "Escape") { closeCart(); $("#success-overlay").hidden = true; $("#tracking-overlay").hidden = true; } });
}

/* Admin workspace */
async function adminLoad() {
  const signedInUser = adminData.user || null;
  const signedInName = adminData.displayName || null;
  if (!LIVE) demo = readDemo();
  try {
    if (LIVE && dbClient) {
      const [cats, dishes, tables, settings, orders] = await Promise.all([
        dbClient.from("menu_categories").select("*").order("position"),
        dbClient.from("menu_items").select("*").order("position"),
        dbClient.from("dining_tables").select("id,table_number,qr_token,capacity,is_active,created_at").order("table_number"),
        dbClient.from("restaurant_settings").select("*").eq("id", true).single(),
        dbClient.from("orders").select("*,order_items(*),dining_tables(table_number)").order("created_at", { ascending: false }).limit(500)
      ]);
      for (const res of [cats, dishes, tables, settings, orders]) if (res.error) throw res.error;
      adminData = { user: signedInUser, displayName: signedInName, categories: cats.data || [], menu: dishes.data || [], tables: tables.data || [], settings: { ...DEFAULT_SETTINGS, ...settings.data }, orders: (orders.data || []).map(o => ({ ...o, table_number: o.dining_tables?.table_number })) };
    } else adminData = { user: signedInUser, displayName: signedInName, categories: demo.categories, menu: demo.menu, tables: demo.tables, settings: { ...DEFAULT_SETTINGS, ...demo.settings }, orders: demo.orders };
  } catch (error) { console.error(error); toast(`Couldn't refresh data: ${error.message}`, "error"); }
  renderAdmin();
}

function navigateAdmin(view) {
  $$(".admin-nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  $$(".admin-view").forEach(section => section.classList.toggle("active", section.dataset.adminView === view));
  const label = ({ overview: "Overview", orders: "Orders", "menu-admin": "Menu", tables: "Tables & QR", history: "Order history", offers: "Offers & specials", customers: "Customers", reports: "Reports", settings: "Settings" })[view] || "Overview";
  $("#admin-breadcrumb").textContent = label;
  if (view === "orders") renderOrders(); if (view === "tables") renderTables(); if (view === "menu-admin") renderAdminMenu(); if (view === "history") renderHistory(); if (view === "offers") renderOffers(); if (view === "customers") renderCustomers(); if (view === "reports") renderReports();
}
function renderAdmin() {
  const loggedIn = LIVE && dbClient ? Boolean(adminData.user) : demoLoggedIn;
  $("#admin-login").hidden = loggedIn; $("#admin-workspace").hidden = !loggedIn;
  $("#staff-name").textContent = adminData.displayName || (LIVE ? "Restaurant team" : "Demo workspace");
  $("#profile-name").textContent = adminData.displayName || (LIVE ? "Staff" : "Demo");
  $("#connection-state").textContent = LIVE && dbClient ? "Connected · live data" : "Demo · this browser only";
  $("#admin-date").textContent = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
  if (!loggedIn) {
    if (!(LIVE && dbClient)) $(".login-tip").innerHTML = "Demo access: <code>demo@hotel.local</code> / <code>demo123</code>. Orders stay in this browser. Connect Supabase for shared use.";
    return;
  }
  $$("[data-setting='restaurant_name']").forEach(el => el.textContent = adminData.settings.restaurant_name || DEFAULT_SETTINGS.restaurant_name);
  applyBrand(adminData.settings); renderOverview(); renderOrders(); renderAdminMenu(); renderTables(); renderHistory(); renderOffers(); renderCustomers(); renderReports(); populateSettings(); setLogoPreview(adminData.settings.logo_url);
}
function filteredOrders(filter = orderFilter) {
  const all = [...adminData.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const term = $("#order-search")?.value.trim().toLowerCase() || "";
  const visible = filter === "active" ? all.filter(o => !["served", "cancelled"].includes(o.status)) : filter === "completed" ? all.filter(o => ["served", "cancelled"].includes(o.status)) : all;
  return visible.filter(o => !term || `${orderCode(o)} ${o.customer_name || ""} ${o.customer_phone || ""} ${orderServiceLabel(o)} ${o.delivery_address || ""}`.toLowerCase().includes(term));
}
function orderSummaryLine(order) { const items = itemList(order); const qty = items.reduce((n, x) => n + Number(x.quantity || 0), 0); return `${qty} ${qty === 1 ? "item" : "items"}${items.length ? ` · ${items.slice(0, 2).map(i => i.name).join(", ")}${items.length > 2 ? "…" : ""}` : ""}`; }
function renderOverview() {
  $("#overview-greeting").textContent = `${new Intl.DateTimeFormat("en-IN", { weekday: "long" }).format(new Date()).toUpperCase()}, YOUR RESTAURANT IS READY`;
  const today = new Date().toDateString(); const todays = adminData.orders.filter(o => new Date(o.created_at).toDateString() === today); const active = todays.filter(o => !["served", "cancelled"].includes(o.status));
  const revenue = todays.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + getOrderTotal(o), 0);
  const served = todays.filter(o => o.status === "served").length;
  const metrics = [["Orders today", todays.length, `${active.length} still in progress`, "▤", ""], ["Sales today", money(revenue), `${served} served so far`, "₹", "gold"], ["In the kitchen", todays.filter(o => ["accepted", "preparing"].includes(o.status)).length, "Accepted & preparing", "◷", "orange"], ["Ready to serve", todays.filter(o => o.status === "ready").length, "Waiting at the pass", "⌑", "blue"]];
  $("#metric-grid").innerHTML = metrics.map(([label, value, note, icon, color]) => `<article class="metric-card"><span class="metric-label">${esc(label)}</span><strong class="metric-value">${esc(value)}</strong><span class="metric-note">${esc(note)}</span><span class="metric-icon ${color}">${icon}</span></article>`).join("");
  $("#recent-orders").innerHTML = todays.slice(0, 4).map(o => `<div class="recent-order-row" data-select-order="${esc(o.id)}"><span class="order-avatar">${esc(String(o.order_type === "delivery" ? "D" : o.table_number || tableName(o.table_id).replace("Table ", "T")))}</span><span class="recent-order-copy"><strong>${orderCode(o)} · ${esc(o.customer_name || orderServiceLabel(o))}</strong><small>${esc(orderServiceLabel(o))} · ${esc(orderSummaryLine(o))}</small></span><span class="recent-order-price">${money(getOrderTotal(o))}</span>${statusPill(o.status)}</div>`).join("") || `<div class="empty-inline">No orders yet today. The first one will show up here.</div>`;
  const occupied = new Set(active.map(o => o.table_id).filter(Boolean)); const tablesActive = adminData.tables.filter(t => t.is_active !== false).length;
  $("#service-snapshot").innerHTML = `<div class="service-tile"><span>Active tables</span><strong>${occupied.size} <small>/ ${tablesActive}</small></strong></div><div class="service-tile"><span>Average order</span><strong>${money(todays.length ? revenue / Math.max(todays.filter(o => o.status !== "cancelled").length, 1) : 0)}</strong></div><p class="service-footnote">${active.length ? `${active.length} order${active.length === 1 ? "" : "s"} need a little attention.` : "Looking good — nothing needs attention."}</p>`;
}
function renderOrders() {
  if (!adminData.orders) return;
  const activeCount = adminData.orders.filter(o => !["served", "cancelled"].includes(o.status)).length;
  $("#active-order-count").textContent = activeCount; $("#nav-order-count").textContent = activeCount; $("#nav-order-count").hidden = !activeCount;
  const list = filteredOrders();
  $("#orders-list").innerHTML = list.map(o => `<article class="order-card ${o.id === selectedOrderId ? "selected" : ""}" data-order-id="${esc(o.id)}"><div class="order-card-top"><div class="order-card-id"><span class="order-avatar">${esc(o.order_type === "delivery" ? "D" : o.table_number || tableName(o.table_id).replace("Table ", "T"))}</span><span><strong>${orderCode(o)} · ${esc(o.customer_name || orderServiceLabel(o))}</strong><small>${dateTime(o.created_at)} · ${esc(orderServiceLabel(o))} · ${esc(orderSummaryLine(o))}</small></span></div>${statusPill(o.status)}</div><div class="order-card-bottom"><span>${esc(o.customer_note || o.delivery_address || "No kitchen note")}</span><strong>${money(getOrderTotal(o))}</strong></div></article>`).join("") || `<div class="empty-state"><strong>${orderFilter === "active" ? "All caught up." : "No orders to show."}</strong>New guest orders will appear here.</div>`;
  $$(".order-card").forEach(card => card.addEventListener("click", () => { selectedOrderId = card.dataset.orderId; renderOrders(); renderOrderDetail(); }));
  if (!list.some(o => o.id === selectedOrderId)) selectedOrderId = list[0]?.id || null;
  renderOrderDetail();
}
function renderOrderDetail() {
  const order = adminData.orders.find(o => o.id === selectedOrderId);
  if (!order) { $("#order-detail").innerHTML = `<div class="detail-empty"><span>▤</span><h3>Select an order</h3><p>Choose an order to view items and update its status.</p></div>`; return; }
  const items = itemList(order); const sums = { discount: Number(order.discount_total || 0), discountedSubtotal: Number(order.subtotal ?? items.reduce((s, i) => s + Number(i.price_at_order ?? i.price ?? 0) * Number(i.quantity), 0)), tax: Number(order.tax_total || 0), deliveryFee: Number(order.delivery_fee || 0), total: getOrderTotal(order) };
  sums.subtotal = sums.discountedSubtotal + sums.discount;
  const next = STATUS[order.status]?.next;
  const phoneHref = order.customer_phone ? `tel:${encodeURIComponent(order.customer_phone)}` : "";
  const deliveryAddress = order.order_type === "delivery" ? [order.delivery_address, order.delivery_area, order.delivery_city, order.delivery_postal_code].filter(Boolean).join(", ") : "";
  $("#order-detail").innerHTML = `<div class="order-detail-header"><div><h2>${orderCode(order)}</h2><p>${esc(order.customer_name || "Guest")} · ${esc(orderServiceLabel(order))} · ${dateTime(order.created_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p></div>${statusPill(order.status)}</div>${order.customer_phone ? `<p class="detail-section-label">GUEST CONTACT · ${order.marketing_opt_in ? `<span class="consent-badge">OFFERS OPTED IN</span>` : `<span class="customer-meta">NO PROMOTIONAL CONSENT</span>`}</p><div class="detail-note"><a href="${esc(phoneHref)}">${esc(order.customer_phone)}</a>${order.marketing_opt_in ? ` · <a target="_blank" rel="noopener" href="${esc(whatsAppUrl(order.customer_phone, order.customer_name))}">WhatsApp offer ↗</a>` : ""}</div>` : ""}${deliveryAddress ? `<p class="detail-section-label">DELIVERY ADDRESS</p><div class="detail-note">${esc(deliveryAddress)}</div>` : ""}<p class="detail-section-label">ORDER ITEMS</p><div class="detail-items">${items.map(i => `<div class="detail-item"><span>${Number(i.quantity)} × ${esc(i.name)}${Number(i.discount_percent_at_order) ? ` <small>${Number(i.discount_percent_at_order)}% off</small>` : ""}</span><strong>${money(Number(i.price_at_order ?? i.price) * Number(i.quantity))}</strong></div>`).join("")}</div><p class="detail-section-label">BILL SUMMARY</p><div class="detail-totals"><div class="total-row"><span>Subtotal</span><span>${money(sums.subtotal)}</span></div>${sums.discount ? `<div class="total-row discount-row"><span>Discount</span><span>−${money(sums.discount)}</span></div><div class="total-row"><span>After discount</span><span>${money(sums.discountedSubtotal)}</span></div>` : ""}${sums.tax ? `<div class="total-row"><span>Tax</span><span>${money(sums.tax)}</span></div>` : ""}${order.order_type === "delivery" ? `<div class="total-row"><span>Delivery fee</span><span>${sums.deliveryFee ? money(sums.deliveryFee) : "Free"}</span></div>` : ""}<div class="total-row grand"><span>Total</span><span>${money(sums.total)}</span></div></div>${order.customer_note ? `<p class="detail-section-label">NOTE FOR THE KITCHEN</p><div class="detail-note">${esc(order.customer_note)}</div>` : ""}<p class="detail-section-label">PAYMENT · <span class="customer-meta">${esc(order.payment_status || "unpaid").toUpperCase()}</span></p><div class="detail-actions">${next ? `<button id="advance-order" class="button button-primary" data-status="${esc(next)}" type="button">${esc(STATUS[order.status].nextLabel)} <span>→</span></button>` : ""}${order.status !== "cancelled" && order.status !== "served" ? `<button id="cancel-order" class="button button-outline" type="button">Cancel order</button>` : ""}<button id="toggle-payment" class="button button-outline" type="button">${order.payment_status === "paid" ? "Mark unpaid" : "Mark paid"}</button></div><div class="print-action-row"><button data-print-order="receipt" type="button">Print 80 mm receipt</button><button data-print-order="receipt58" type="button">Print 58 mm receipt</button><button data-print-order="a4" type="button">Print A4 bill</button></div>`;
  $("#advance-order")?.addEventListener("click", event => updateOrder(order.id, { status: event.currentTarget.dataset.status }));
  $("#cancel-order")?.addEventListener("click", () => updateOrder(order.id, { status: "cancelled" }));
  $("#toggle-payment")?.addEventListener("click", () => updateOrder(order.id, { payment_status: order.payment_status === "paid" ? "unpaid" : "paid" }));
  $$('[data-print-order]').forEach(btn => btn.addEventListener("click", () => printOrder(order, btn.dataset.printOrder)));
}
function historyOrders() {
  const range = $("#history-range")?.value || "all";
  const search = $("#history-search")?.value.trim().toLowerCase() || "";
  const start = new Date();
  if (range === "today") start.setHours(0, 0, 0, 0);
  else if (range === "7d") start.setDate(start.getDate() - 6);
  else if (range === "30d") start.setDate(start.getDate() - 29);
  return [...adminData.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).filter(order => {
    const inRange = range === "all" || new Date(order.created_at) >= start;
    const text = `${orderCode(order)} ${order.customer_name || ""} ${order.customer_phone || ""} ${orderServiceLabel(order)} ${order.delivery_address || ""}`.toLowerCase();
    return inRange && (!search || text.includes(search));
  });
}
function renderHistory() {
  const orders = historyOrders();
  $("#history-list").innerHTML = orders.map(order => `<article class="history-row"><span class="order-avatar">${esc(order.order_type === "delivery" ? "D" : order.table_number || tableName(order.table_id).replace("Table ", "T"))}</span><div class="history-main"><strong>${orderCode(order)} · ${esc(order.customer_name || "Guest")}</strong><small>${dateTime(order.created_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · ${esc(order.customer_phone || "No mobile shared")} · ${esc(orderServiceLabel(order))} · ${esc(orderSummaryLine(order))}</small></div>${statusPill(order.status)}<strong class="history-total">${money(getOrderTotal(order))}</strong><button class="small-icon-action" data-history-open="${esc(order.id)}" aria-label="Open order" title="Open order" type="button">↗</button></article>`).join("") || `<div class="empty-state"><strong>No orders in this date range.</strong>Completed and cancelled tickets will stay here.</div>`;
  $$('[data-history-open]').forEach(button => button.addEventListener("click", () => {
    selectedOrderId = button.dataset.historyOpen; orderFilter = "all";
    $$('[data-order-filter]').forEach(filter => filter.classList.toggle("selected", filter.dataset.orderFilter === "all"));
    navigateAdmin("orders"); renderOrders();
  }));
}
function renderOffers() {
  const offers = adminData.menu.filter(item => discountPercent(item) > 0 || item.is_today_special);
  const discounted = offers.filter(item => discountPercent(item) > 0).length;
  const specials = offers.filter(item => item.is_today_special).length;
  $("#offer-metrics").innerHTML = [["Discounted dishes", discounted, "A lower menu price applies automatically", "%", "gold"], ["Today’s specials", specials, "Highlighted at the top of the guest menu", "✳", "orange"], ["Offer opt-ins", marketingCustomers().filter(customer => customer.marketing_opt_in).length, "Guests who agreed to WhatsApp offers", "♡", "blue"], ["Offer control", "Menu", "Edit a dish to change its offer", "☷", ""]].map(([label, value, note, icon, color]) => `<article class="metric-card"><span class="metric-label">${esc(label)}</span><strong class="metric-value">${esc(value)}</strong><span class="metric-note">${esc(note)}</span><span class="metric-icon ${color}">${icon}</span></article>`).join("");
  $("#offer-items").innerHTML = offers.map(item => `<article class="offer-row"><div class="admin-menu-thumb">${item.image_url ? `<img src="${esc(item.image_url)}" alt="" onerror="this.remove()" />` : "✳"}</div><div class="offer-row-copy"><strong>${esc(item.name)}</strong><small>${esc(adminData.categories.find(category => category.id === item.category_id)?.name || "Menu")}</small></div><span class="offer-labels">${item.is_today_special ? `<b class="offer-label special">Today’s special</b>` : ""}${discountPercent(item) ? `<b class="offer-label discount">${discountPercent(item)}% off</b>` : ""}</span><span class="offer-price">${discountPercent(item) ? `<del>${money(item.price)}</del> ` : ""}<strong>${money(salePrice(item))}</strong></span><button class="button button-outline" data-edit-offer="${esc(item.id)}" type="button">Edit</button></article>`).join("") || `<div class="empty-state"><strong>No offers running right now.</strong>Edit a menu item to add a discount or mark it as today’s special.</div>`;
  $$('[data-edit-offer]').forEach(button => button.addEventListener("click", () => openMenuDialog(adminData.menu.find(item => item.id === button.dataset.editOffer))));
}
function normalizedPhone(value) { return String(value || "").replace(/\D/g, ""); }
function marketingCustomers() {
  const customers = new Map();
  [...adminData.orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach(order => {
    const digits = normalizedPhone(order.customer_phone); if (!digits) return;
    if (!customers.has(digits)) customers.set(digits, { key: digits, phone: order.customer_phone, name: order.customer_name || "Guest", marketing_opt_in: Boolean(order.marketing_opt_in), order_count: 0, last_order: order.created_at, last_order_id: order.id });
    customers.get(digits).order_count += 1;
  });
  return [...customers.values()];
}
function whatsAppUrl(phone, customerName = "") {
  let digits = normalizedPhone(phone);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  const settings = { ...DEFAULT_SETTINGS, ...adminData.settings };
  const todaySpecials = adminData.menu.filter(item => item.is_today_special).map(item => item.name);
  let message = String(settings.offer_message || DEFAULT_SETTINGS.offer_message).replaceAll("{name}", customerName || "there").replaceAll("{business}", settings.restaurant_name);
  if (todaySpecials.length) message += ` Today’s special: ${todaySpecials.join(", ")}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
function renderCustomers() {
  const search = $("#customer-search")?.value.trim().toLowerCase() || "";
  const customers = marketingCustomers().filter(customer => !search || `${customer.name} ${customer.phone}`.toLowerCase().includes(search));
  $("#customer-list").innerHTML = customers.map(customer => `<article class="customer-row"><span class="customer-avatar">${esc((customer.name || "G").slice(0, 1).toUpperCase())}</span><div class="customer-row-main"><strong>${esc(customer.name)}</strong><small><a href="tel:${esc(encodeURIComponent(customer.phone))}">${esc(customer.phone)}</a> · ${customer.order_count} order${customer.order_count === 1 ? "" : "s"} · Last visit ${shortDate(customer.last_order)}</small></div>${customer.marketing_opt_in ? `<span class="consent-badge">OPTED IN</span>` : `<span class="no-consent-badge">NO OFFERS</span>`}${customer.marketing_opt_in ? `<a class="button button-outline whatsapp-button" target="_blank" rel="noopener" href="${esc(whatsAppUrl(customer.phone, customer.name))}">WhatsApp offer ↗</a>` : `<span class="customer-row-hint">Offers disabled</span>`}</article>`).join("") || `<div class="empty-state"><strong>No guest contact details found.</strong>Guests may optionally share their name and mobile at checkout.</div>`;
}
function exportCustomers(consentedOnly = false) {
  const customers = marketingCustomers().filter(customer => !consentedOnly || customer.marketing_opt_in);
  const rows = [["Name", "Mobile", "Order count", "Last visit", "WhatsApp offers consent"], ...customers.map(customer => [customer.name, customer.phone, customer.order_count, new Date(customer.last_order).toISOString(), customer.marketing_opt_in ? "Yes" : "No"])];
  const csv = rows.map(row => row.map(value => { const cell = String(value); const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell; return `"${safe.replaceAll('"', '""')}"`; }).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `restaurant-guests-${consentedOnly ? "opted-in-" : ""}${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
}
async function updateOrder(id, changes) {
  try {
    if (LIVE && dbClient) { const { error } = await dbClient.from("orders").update(changes).eq("id", id); if (error) throw error; }
    else { demo = readDemo(); const row = demo.orders.find(o => o.id === id); if (row) Object.assign(row, changes, { updated_at: new Date().toISOString() }); writeDemo(demo); adminData.orders = demo.orders; }
    await adminLoad(); if (changes.status) toast(`Order ${changes.status === "cancelled" ? "cancelled" : STATUS[changes.status].label.toLowerCase()}.`, "success"); else toast(`Payment marked ${changes.payment_status}.`, "success");
  } catch (error) { toast(error.message || "Couldn't update the order.", "error"); }
}

function renderAdminMenu() {
  const cats = adminData.categories; const menu = adminData.menu || []; const term = $("#admin-menu-search")?.value.trim().toLowerCase() || "";
  $("#admin-category-filters").innerHTML = `<button class="category-pill ${menuAdminCategory === "all" ? "active" : ""}" data-menu-filter="all" type="button">Everything</button>` + cats.map(c => `<button class="category-pill ${menuAdminCategory === c.id ? "active" : ""}" data-menu-filter="${esc(c.id)}" type="button">${esc(c.name)}</button>`).join("");
  const visible = menu.filter(i => (menuAdminCategory === "all" || i.category_id === menuAdminCategory) && (!term || `${i.name} ${i.description || ""}`.toLowerCase().includes(term)));
  $("#admin-menu-list").innerHTML = visible.map(i => `<article class="admin-menu-row"><div class="admin-menu-thumb">${i.image_url ? `<img src="${esc(i.image_url)}" alt="" onerror="this.remove()" />` : "✳"}</div><div class="admin-menu-copy"><strong>${esc(i.name)}</strong><small>${esc(adminData.categories.find(c => c.id === i.category_id)?.name || "Uncategorised")} · ${i.is_vegetarian ? "Vegetarian" : "Non-vegetarian"}${i.is_today_special ? " · Today’s special" : ""}${discountPercent(i) ? ` · ${discountPercent(i)}% off` : ""}</small></div><strong class="admin-menu-price">${discountPercent(i) ? `<del>${money(i.price)}</del><br />` : ""}${money(salePrice(i))}</strong><label class="availability-toggle"><input type="checkbox" data-availability="${esc(i.id)}" ${i.is_available ? "checked" : ""} /> Available</label><div class="row-actions"><button class="small-icon-action" data-edit-menu="${esc(i.id)}" title="Edit" type="button">✎</button><button class="small-icon-action danger" data-delete-menu="${esc(i.id)}" title="Delete" type="button">×</button></div></article>`).join("") || `<div class="empty-state"><strong>No dishes found.</strong>Add an item or try another filter.</div>`;
  $$('[data-menu-filter]').forEach(btn => btn.addEventListener("click", () => { menuAdminCategory = btn.dataset.menuFilter; renderAdminMenu(); }));
  $$('[data-availability]').forEach(input => input.addEventListener("change", () => saveMenuItem({ id: input.dataset.availability, is_available: input.checked })));
  $$('[data-edit-menu]').forEach(btn => btn.addEventListener("click", () => openMenuDialog(adminData.menu.find(i => i.id === btn.dataset.editMenu))));
  $$('[data-delete-menu]').forEach(btn => btn.addEventListener("click", () => deleteMenuItem(btn.dataset.deleteMenu)));
}
async function saveMenuItem(values) {
  try {
    if (LIVE && dbClient) {
      const { id, ...payload } = values;
      const query = id ? dbClient.from("menu_items").update(payload).eq("id", id) : dbClient.from("menu_items").insert(payload);
      const { error } = await query; if (error) throw error;
    } else {
      demo = readDemo();
      const idx = demo.menu.findIndex(i => i.id === values.id);
      if (idx >= 0) Object.assign(demo.menu[idx], values); else demo.menu.unshift({ ...values, id: crypto.randomUUID(), position: demo.menu.length + 1 });
      writeDemo(demo); adminData.menu = demo.menu;
    }
    if (LIVE) await adminLoad(); else { renderAdminMenu(); renderMenu(); }
    return true;
  } catch (error) { console.error(error); toast(error.message || "Couldn't save this menu item.", "error"); return false; }
}
async function deleteMenuItem(id) {
  if (!confirm("Delete this dish from the menu? Existing order receipts keep their saved item details.")) return;
  try {
    if (LIVE && dbClient) { const { error } = await dbClient.from("menu_items").delete().eq("id", id); if (error) throw error; }
    else { demo = readDemo(); demo.menu = demo.menu.filter(i => i.id !== id); writeDemo(demo); adminData.menu = demo.menu; }
    await adminLoad(); toast("Dish removed from the menu.", "success");
  } catch (error) { toast(error.message || "Couldn't delete this dish.", "error"); }
}

function categorySlug(name) {
  const slug = name.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `category-${crypto.randomUUID().slice(0, 8)}`;
}
async function saveCategory(values) {
  try {
    if (LIVE && dbClient) {
      const { id, ...payload } = values;
      const query = id ? dbClient.from("menu_categories").update(payload).eq("id", id) : dbClient.from("menu_categories").insert(payload);
      const { error } = await query; if (error) throw error;
    } else {
      demo = readDemo(); const idx = demo.categories.findIndex(c => c.id === values.id);
      if (idx >= 0) Object.assign(demo.categories[idx], values); else demo.categories.push({ ...values, id: crypto.randomUUID(), position: demo.categories.length + 1 });
      writeDemo(demo); adminData.categories = demo.categories;
    }
    await adminLoad(); openCategoriesDialog(); renderMenu();
    return true;
  } catch (error) { toast(error.message || "Couldn't save this category.", "error"); return false; }
}
async function deleteCategory(id) {
  if (adminData.menu.some(item => item.category_id === id)) { toast("Move or delete this category's dishes first.", "error"); return; }
  if (!confirm("Remove this menu category?")) return;
  try {
    if (LIVE && dbClient) { const { error } = await dbClient.from("menu_categories").delete().eq("id", id); if (error) throw error; }
    else { demo = readDemo(); demo.categories = demo.categories.filter(c => c.id !== id); writeDemo(demo); }
    await adminLoad(); openCategoriesDialog(); renderMenu(); toast("Category removed.", "success");
  } catch (error) { toast(error.message || "Couldn't remove this category.", "error"); }
}
function openCategoriesDialog() {
  const rows = adminData.categories.map(category => `<form class="category-manager-row" data-category-form="${esc(category.id)}"><input name="name" aria-label="Category name" required maxlength="80" value="${esc(category.name)}" /><label class="availability-toggle"><input name="is_active" type="checkbox" ${category.is_active !== false ? "checked" : ""} /> Visible</label><button class="small-icon-action" type="submit" title="Save category">✓</button><button class="small-icon-action danger" type="button" data-delete-category="${esc(category.id)}" title="Delete category">×</button></form>`).join("");
  openDialog(`<section class="dialog-panel"><header class="dialog-header"><div><p class="eyebrow">MENU ORGANISATION</p><h2>Categories<span class="heading-dot">.</span></h2><p>Hide a category or give it a new name.</p></div><button class="icon-button" data-dialog-close aria-label="Close" type="button">×</button></header><div class="category-manager-list">${rows || `<div class="empty-inline">No menu categories yet.</div>`}</div><form id="create-category-form" class="category-create-row"><input name="name" required maxlength="80" placeholder="New category name" aria-label="New category name" /><button class="button button-primary" type="submit">＋ Add category</button></form></section>`);
  $$("[data-dialog-close]").forEach(el => el.addEventListener("click", closeDialog));
  $$('[data-category-form]').forEach(form => form.addEventListener("submit", event => { event.preventDefault(); const category = adminData.categories.find(c => c.id === form.dataset.categoryForm); const data = new FormData(form); saveCategory({ id: category.id, name: String(data.get("name")).trim(), slug: categorySlug(String(data.get("name"))), is_active: data.has("is_active") }); }));
  $$('[data-delete-category]').forEach(button => button.addEventListener("click", () => deleteCategory(button.dataset.deleteCategory)));
  $("#create-category-form").addEventListener("submit", async event => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get("name")).trim(); const ok = await saveCategory({ name, slug: categorySlug(name), is_active: true, position: adminData.categories.length + 1 }); if (ok) toast("Category added.", "success"); });
}

function openDialog(content) { $("#admin-dialog-root").innerHTML = `<div class="admin-dialog"><button class="overlay-scrim" data-dialog-close aria-label="Close dialog" type="button"></button>${content}</div>`; $("[data-dialog-close]").addEventListener("click", closeDialog); document.addEventListener("keydown", dialogEscape, { once: true }); }
function closeDialog() { $("#admin-dialog-root").innerHTML = ""; }
function dialogEscape(event) { if (event.key === "Escape") closeDialog(); }
function openMenuDialog(item = null) {
  if (!adminData.categories.length) { toast("Create a menu category in Supabase before adding dishes.", "error"); return; }
  const isEdit = Boolean(item);
  openDialog(`<section class="dialog-panel"><header class="dialog-header"><div><p class="eyebrow">${isEdit ? "KEEPING IT FRESH" : "ADD TO THE MENU"}</p><h2>${isEdit ? "Edit this dish" : "A new favourite"}<span class="heading-dot">.</span></h2><p>Guest prices and offers update as soon as you save.</p></div><button class="icon-button" data-dialog-close aria-label="Close" type="button">×</button></header><form id="menu-dialog-form" class="dialog-form"><label>Dish name<input name="name" required maxlength="120" value="${esc(item?.name || "")}" placeholder="e.g. Garden harvest bowl" /></label><label>Price (${esc(adminData.settings.currency || "INR")})<input name="price" type="number" min="0" step="0.01" required value="${esc(item?.price ?? "")}" /></label><label>Category<select name="category_id" required>${adminData.categories.map(c => `<option value="${esc(c.id)}" ${item?.category_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label><label>Discount (%)<input name="discount_percent" type="number" min="0" max="100" step="0.01" value="${esc(item?.discount_percent || 0)}" /></label><label class="wide">Tag <span>(optional)</span><input name="tag" maxlength="45" value="${esc(item?.tag || "")}" placeholder="House-made" /></label><label class="wide">Description<textarea name="description" rows="2" maxlength="300" placeholder="A few words about the dish…">${esc(item?.description || "")}</textarea></label><label class="wide">Image URL <span>(optional)</span><input name="image_url" type="url" maxlength="500" value="${esc(item?.image_url || "")}" placeholder="https://…" /></label><label class="checkbox-field"><input name="is_vegetarian" type="checkbox" ${item?.is_vegetarian !== false ? "checked" : ""} /> Vegetarian</label><label class="checkbox-field"><input name="is_today_special" type="checkbox" ${item?.is_today_special ? "checked" : ""} /> Today’s special</label><label class="checkbox-field"><input name="is_available" type="checkbox" ${item?.is_available !== false ? "checked" : ""} /> Available to order</label><div class="dialog-actions"><button class="button button-quiet" data-dialog-close type="button">Cancel</button><button class="button button-primary" type="submit">${isEdit ? "Save dish" : "Add dish"} <span>→</span></button></div></form></section>`);
  $$("[data-dialog-close]").forEach(el => el.addEventListener("click", closeDialog));
  $("#menu-dialog-form").addEventListener("submit", async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const values = { name: form.get("name").trim(), price: Number(form.get("price")), discount_percent: Number(form.get("discount_percent")) || 0, is_today_special: form.has("is_today_special"), category_id: form.get("category_id"), tag: form.get("tag").trim(), description: form.get("description").trim(), image_url: form.get("image_url").trim() || null, is_vegetarian: form.has("is_vegetarian"), is_available: form.has("is_available") }; if (item) values.id = item.id; if (await saveMenuItem(values)) { closeDialog(); toast(isEdit ? "Dish updated." : "Dish added to the menu.", "success"); } });
}

function renderTables() {
  $("#table-grid").innerHTML = adminData.tables.map(t => {
    const active = adminData.orders.some(o => o.table_id === t.id && !["served", "cancelled"].includes(o.status));
    return `<article class="table-card"><div><strong class="table-number">${esc(t.table_number)}</strong><span class="table-label">TABLE ${esc(t.table_number)}</span><span class="table-capacity">Seats ${Number(t.capacity) || 2}</span><span class="table-occupancy ${active ? "busy" : ""}">${active ? "ORDER IN PROGRESS" : t.is_active === false ? "INACTIVE" : "READY FOR GUESTS"}</span></div><div class="qr-preview" data-qr-preview="${esc(t.id)}"></div><div class="table-card-actions"><button data-show-qr="${esc(t.id)}" type="button">View &amp; print QR</button><button data-copy-qr="${esc(t.id)}" type="button">Copy link</button><button class="table-toggle ${t.is_active === false ? "reactivate" : "table-delete"}" data-toggle-table="${esc(t.id)}" title="${t.is_active === false ? "Reactivate table" : "Deactivate table"}" type="button">${t.is_active === false ? "Activate" : "Off"}</button></div></article>`;
  }).join("") || `<div class="empty-state"><strong>No tables set up yet.</strong>Add your first table to make its QR code.</div>`;
  renderQrPreviews();
  $$('[data-show-qr]').forEach(btn => btn.addEventListener("click", () => showTableQR(adminData.tables.find(t => t.id === btn.dataset.showQr))));
  $$('[data-copy-qr]').forEach(btn => btn.addEventListener("click", async () => { const table = adminData.tables.find(t => t.id === btn.dataset.copyQr); const url = qrUrl(table); try { await navigator.clipboard.writeText(url); toast("Table QR link copied.", "success"); } catch { prompt("Copy this table link", url); } }));
  $$('[data-toggle-table]').forEach(btn => btn.addEventListener("click", () => toggleTable(btn.dataset.toggleTable)));
}
function qrUrl(table) { const url = new URL("./menu.html", location.href); url.searchParams.set("table", table.qr_token); return url.toString(); }
async function ensureQR() { if (qrModule) return qrModule; try { qrModule = await import("https://esm.sh/qrcode@1.5.4"); return qrModule.default || qrModule; } catch (error) { console.error(error); toast("QR generator couldn't load. Check your internet connection.", "error"); return null; } }
async function renderQrPreviews() {
  const qr = await ensureQR(); if (!qr) return;
  for (const box of $$('[data-qr-preview]')) {
    const table = adminData.tables.find(t => t.id === box.dataset.qrPreview); if (!table) continue;
    try { const canvas = document.createElement("canvas"); await qr.toCanvas(canvas, qrUrl(table), { margin: 0, width: 160, color: { dark: "#20342c", light: "#ffffff" }, errorCorrectionLevel: "M" }); box.innerHTML = ""; box.append(canvas); }
    catch (error) { console.error(error); box.textContent = "QR"; }
  }
}
async function showTableQR(table) {
  if (!table) return;
  const qr = await ensureQR(); if (!qr) return;
  try {
    const dataUrl = await qr.toDataURL(qrUrl(table), { margin: 2, width: 500, color: { dark: "#20342c", light: "#ffffff" }, errorCorrectionLevel: "H" });
    openDialog(`<section class="qr-print-card"><button class="icon-button" data-dialog-close aria-label="Close" type="button" style="position:absolute;right:8px;top:8px">×</button><p class="eyebrow" style="justify-content:center">SCAN &amp; ORDER</p><h2>Table ${esc(table.table_number)}</h2><p>Point your camera here to open our menu.</p><img src="${dataUrl}" alt="QR code for Table ${esc(table.table_number)}" /><div class="qr-print-url">${esc(qrUrl(table))}</div><div class="qr-print-actions"><button id="download-table-qr" class="button button-outline" type="button">Download PNG</button><button id="print-table-qr" class="button button-primary" type="button">Print table card</button></div></section>`);
    $$("[data-dialog-close]").forEach(el => el.addEventListener("click", closeDialog));
    $("#download-table-qr").addEventListener("click", () => { const a = document.createElement("a"); a.href = dataUrl; a.download = `table-${table.table_number}-qr.png`; a.click(); });
    $("#print-table-qr").addEventListener("click", () => { const settings = { ...DEFAULT_SETTINGS, ...adminData.settings }; $("#print-root").innerHTML = `<article class="print-document print-qr">${settings.logo_url ? `<img class="qr-brand-logo" src="${esc(settings.logo_url)}" alt="" />` : ""}<p>${esc(settings.restaurant_name)}</p><h1>Table ${esc(table.table_number)}</h1><p>Scan to view the menu<br />and order from your table</p><img src="${dataUrl}" alt="QR code" /><small>${esc(qrUrl(table))}</small></article>`; printWithSize("qr"); });
  } catch (error) { toast(error.message || "Couldn't create QR code.", "error"); }
}
async function addTable(values) {
  try {
    if (LIVE && dbClient) { const { error } = await dbClient.from("dining_tables").insert({ table_number: values.table_number, capacity: values.capacity, qr_token: crypto.randomUUID() }); if (error) throw error; }
    else { demo = readDemo(); if (demo.tables.some(t => t.table_number.toLowerCase() === values.table_number.toLowerCase())) throw new Error("That table number already exists."); demo.tables.push({ id: crypto.randomUUID(), qr_token: `demo-${crypto.randomUUID()}`, ...values, is_active: true }); writeDemo(demo); }
    closeDialog(); await adminLoad(); toast(`Table ${values.table_number} is ready.`, "success");
  } catch (error) { toast(error.message || "Couldn't add that table.", "error"); }
}
function openTableDialog() {
  const next = String((Math.max(0, ...adminData.tables.map(t => Number(t.table_number) || 0)) + 1)).padStart(2, "0");
  openDialog(`<section class="dialog-panel"><header class="dialog-header"><div><p class="eyebrow">A PLACE FOR EVERYONE</p><h2>Add a table<span class="heading-dot">.</span></h2><p>A unique QR code will be generated automatically.</p></div><button class="icon-button" data-dialog-close aria-label="Close" type="button">×</button></header><form id="table-dialog-form" class="dialog-form"><label>Table number / name<input name="table_number" required maxlength="30" value="${esc(next)}" placeholder="e.g. 01 or Patio A" /></label><label>Seats<input name="capacity" type="number" min="1" max="30" value="2" required /></label><div class="dialog-actions"><button class="button button-quiet" data-dialog-close type="button">Cancel</button><button class="button button-primary" type="submit">Create table <span>→</span></button></div></form></section>`);
  $$("[data-dialog-close]").forEach(el => el.addEventListener("click", closeDialog));
  $("#table-dialog-form").addEventListener("submit", event => { event.preventDefault(); const form = new FormData(event.currentTarget); addTable({ table_number: form.get("table_number").trim(), capacity: Number(form.get("capacity")) }); });
}
async function toggleTable(id) {
  const table = adminData.tables.find(t => t.id === id); if (!table) return;
  const nextActive = table.is_active === false;
  if (!nextActive && !confirm(`Deactivate Table ${table.table_number}? Its QR code will stop accepting new orders until reactivated.`)) return;
  try {
    if (LIVE && dbClient) { const { error } = await dbClient.from("dining_tables").update({ is_active: nextActive }).eq("id", id); if (error) throw error; }
    else { demo = readDemo(); const target = demo.tables.find(t => t.id === id); if (target) target.is_active = nextActive; writeDemo(demo); }
    await adminLoad(); toast(`Table ${table.table_number} ${nextActive ? "reactivated" : "deactivated"}.`, "success");
  } catch (error) { toast(error.message || "Couldn't update this table.", "error"); }
}

function ordersInRange(range) {
  const now = new Date(); let start = new Date(now); if (range === "7d") start.setDate(now.getDate() - 6); else if (range === "30d") start.setDate(now.getDate() - 29); else start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return adminData.orders.filter(o => new Date(o.created_at) >= start && o.status !== "cancelled");
}
function renderReports() {
  const orders = ordersInRange(reportRange); const revenue = orders.reduce((sum, o) => sum + getOrderTotal(o), 0); const average = orders.length ? revenue / orders.length : 0;
  const itemsCount = orders.reduce((sum, o) => sum + itemList(o).reduce((s, i) => s + Number(i.quantity || 0), 0), 0);
  const metrics = [["Gross sales", money(revenue), "Before refunds", "₹", "gold"], ["Orders", orders.length, reportRange === "today" ? "Today" : reportRange === "7d" ? "Last 7 days" : "Last 30 days", "▤", ""], ["Average order", money(average), "Per order", "◷", "blue"], ["Items served", itemsCount, "Across all orders", "✳", "orange"]];
  $("#report-metrics").innerHTML = metrics.map(([label, value, note, icon, color]) => `<article class="metric-card"><span class="metric-label">${esc(label)}</span><strong class="metric-value">${esc(value)}</strong><span class="metric-note">${esc(note)}</span><span class="metric-icon ${color}">${icon}</span></article>`).join("");
  const statuses = Object.keys(STATUS).filter(s => s !== "cancelled").map(s => [s, orders.filter(o => o.status === s).length]); const max = Math.max(1, ...statuses.map(([, n]) => n));
  $("#status-breakdown").innerHTML = statuses.map(([status, count]) => `<div class="breakdown-row"><span>${esc(STATUS[status].label)}</span><span class="breakdown-bar"><i style="width:${count / max * 100}%"></i></span><strong>${count}</strong></div>`).join("");
  const popular = new Map(); orders.forEach(o => itemList(o).forEach(i => popular.set(i.name, (popular.get(i.name) || 0) + Number(i.quantity || 0))));
  $("#popular-items").innerHTML = [...popular].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count], i) => `<div class="popular-row"><span class="popular-rank">${i + 1}</span><span><strong>${esc(name)}</strong><small>${count} ordered</small></span><b>${count}</b></div>`).join("") || `<div class="empty-inline">Your guest favourites will show up here.</div>`;
}
function exportReport() {
  const orders = ordersInRange(reportRange); const rows = [["Order", "Date", "Service", "Delivery address", "Customer", "Mobile", "WhatsApp offers consent", "Status", "Items", "Subtotal after discount", "Discount", "Tax", "Delivery fee", "Total", "Payment"], ...orders.map(o => [orderCode(o), new Date(o.created_at).toISOString(), orderServiceLabel(o), [o.delivery_address, o.delivery_area, o.delivery_city, o.delivery_postal_code].filter(Boolean).join(", "), o.customer_name || "Guest", o.customer_phone || "", o.marketing_opt_in ? "Yes" : "No", o.status, itemList(o).map(i => `${i.quantity} x ${i.name}`).join("; "), o.subtotal ?? "", o.discount_total || "", o.tax_total || "", o.delivery_fee || 0, getOrderTotal(o), o.payment_status || "unpaid"])];
  const csv = rows.map(row => row.map(value => { const cell = String(value); const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell; return `"${safe.replaceAll('"', '""')}"`; }).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `restaurant-report-${reportRange}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
}
function populateSettings() {
  const form = $("#settings-form"); for (const [key, value] of Object.entries(adminData.settings || DEFAULT_SETTINGS)) { const input = form.elements.namedItem(key); if (input) { if (input.type === "checkbox") input.checked = Boolean(value); else if (input.tagName === "TEXTAREA" && Array.isArray(value)) input.value = value.join("\n"); else input.value = value ?? ""; } }
}
async function compressLogo(file) {
  const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Couldn't process that logo image.")), "image/jpeg", 0.84));
}
async function blobAsDataUrl(blob) {
  return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Couldn't read that logo file.")); reader.readAsDataURL(blob); });
}
function setLogoPreview(url) {
  const preview = $("#logo-preview"); if (!preview) return;
  preview.src = url || ""; preview.hidden = !url;
}
async function saveSettings(values, logoFile = null) {
  try {
    const settings = { ...values };
    if (logoFile?.size) {
      const logoBlob = await compressLogo(logoFile);
      if (LIVE && dbClient) {
        const path = `logos/${Date.now()}-${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await dbClient.storage.from("restaurant-assets").upload(path, logoBlob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
        if (uploadError) throw uploadError;
        settings.logo_url = dbClient.storage.from("restaurant-assets").getPublicUrl(path).data.publicUrl;
      } else settings.logo_url = await blobAsDataUrl(logoBlob);
    }
    if (LIVE && dbClient) { const { error } = await dbClient.from("restaurant_settings").update(settings).eq("id", true); if (error) throw error; }
    else { demo = readDemo(); Object.assign(demo.settings, settings); writeDemo(demo); }
    await adminLoad(); if (!ADMIN_MODE) await loadGuestData(); setLogoPreview(adminData.settings.logo_url); toast("Business settings saved.", "success");
  } catch (error) { toast(error.message || "Couldn't save the settings.", "error"); }
}

function printableOrder(order) {
  const settings = { ...DEFAULT_SETTINGS, ...adminData.settings };
  const items = itemList(order); const discountedSubtotal = Number(order.subtotal ?? items.reduce((s, i) => s + Number(i.price_at_order ?? i.price ?? 0) * Number(i.quantity), 0)); const discountTotal = Number(order.discount_total ?? items.reduce((s, i) => s + Number(i.discount_amount || 0), 0)); const subtotal = discountedSubtotal + discountTotal; const tax = Number(order.tax_total || 0); const deliveryFee = Number(order.delivery_fee || 0); const total = getOrderTotal(order);
  const deliveryAddress = order.order_type === "delivery" ? [order.delivery_address, order.delivery_area, order.delivery_city, order.delivery_postal_code].filter(Boolean).join(", ") : "";
  const meta = `<div class="receipt-meta"><span>Bill no.</span><strong>${orderCode(order)}</strong><span>Date</span><strong>${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</strong><span>Service</span><strong>${esc(orderServiceLabel(order))}</strong>${deliveryAddress ? `<span>Deliver to</span><strong>${esc(deliveryAddress)}</strong>` : ""}${order.customer_name ? `<span>Guest</span><strong>${esc(order.customer_name)}</strong>` : ""}${order.customer_phone ? `<span>Mobile</span><strong>${esc(order.customer_phone)}</strong>` : ""}</div>`;
  const itemRows = items.map(i => { const price = Number(i.list_price_at_order ?? 0) || Number(i.price_at_order ?? i.price ?? 0); return `<tr><td>${esc(i.name)}</td><td class="qty-col">${Number(i.quantity)}</td><td>${money(price)}</td><td>${money(price * Number(i.quantity))}</td></tr>`; }).join("");
  const totals = `<div class="receipt-totals"><div class="receipt-total-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>${discountTotal ? `<div class="receipt-total-row"><span>Discount</span><strong>−${money(discountTotal)}</strong></div><div class="receipt-total-row"><span>After discount</span><strong>${money(discountedSubtotal)}</strong></div>` : ""}${tax ? `<div class="receipt-total-row"><span>Tax / GST</span><strong>${money(tax)}</strong></div>` : ""}${order.order_type === "delivery" ? `<div class="receipt-total-row"><span>Delivery fee</span><strong>${deliveryFee ? money(deliveryFee) : "Free"}</strong></div>` : ""}<div class="receipt-total-row grand"><span>TOTAL</span><strong>${money(total)}</strong></div><div class="receipt-total-row"><span>Payment</span><strong>${esc((order.payment_status || "unpaid").toUpperCase())}</strong></div></div>`;
  const note = order.customer_note ? `<div class="receipt-note"><strong>Kitchen note:</strong> ${esc(order.customer_note)}</div>` : "";
  return { settings, meta, itemRows, totals, note, tableLabel: orderServiceLabel(order), deliveryAddress, deliveryFee, subtotal, discounted_subtotal: discountedSubtotal, discount_total: discountTotal, tax, total };
}
function printOrder(order, type) {
  const bill = printableOrder(order); const s = bill.settings;
  if (type === "receipt" || type === "receipt58") {
    $("#print-root").innerHTML = `<article class="print-document print-receipt ${type === "receipt58" ? "receipt-narrow" : ""}"><header class="receipt-brand">${s.logo_url ? `<img class="receipt-logo" src="${esc(s.logo_url)}" alt="" />` : ""}<h1>${esc(s.restaurant_name)}</h1>${s.address ? `<p>${esc(s.address)}</p>` : ""}${s.phone ? `<p>${esc(s.phone)}</p>` : ""}${s.gstin ? `<p>GSTIN: ${esc(s.gstin)}</p>` : ""}</header><div class="receipt-title">TAX INVOICE / RECEIPT</div>${bill.meta}<table class="receipt-items"><thead><tr><th>Item</th><th class="qty-col">Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${bill.itemRows}</tbody></table>${bill.totals}${bill.note}<footer class="receipt-footer">${esc(s.bill_footer || "Thank you!")}<br />${s.upi_id ? `UPI: ${esc(s.upi_id)}<br />` : ""}Served with care · ${new Date().getFullYear()}</footer></article>`;
  } else {
    $("#print-root").innerHTML = `<article class="print-document print-a4"><header class="a4-header"><div class="a4-brand">${s.logo_url ? `<img class="a4-logo" src="${esc(s.logo_url)}" alt="" />` : ""}<h1>${esc(s.restaurant_name)}</h1>${s.address ? `<p>${esc(s.address)}</p>` : ""}${s.phone ? `<p>Phone: ${esc(s.phone)}</p>` : ""}${s.gstin ? `<p>GSTIN: ${esc(s.gstin)}</p>` : ""}</div><div class="a4-invoice-label"><strong>INVOICE</strong><p>Order ${orderCode(order)}</p><p>${new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(order.created_at))}</p><p>${dateTime(order.created_at)}</p></div></header><div class="a4-customer"><div><p><strong>Billed to</strong></p><p>${esc(order.customer_name || "Restaurant guest")}</p><p>${esc(bill.tableLabel)}</p>${bill.deliveryAddress ? `<p><strong>Deliver to</strong><br />${esc(bill.deliveryAddress)}</p>` : ""}</div><div><p><strong>Payment status</strong></p><p>${esc((order.payment_status || "unpaid").toUpperCase())}</p></div></div><table class="a4-items"><thead><tr><th>Item description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${bill.itemRows}</tbody></table><div class="a4-bottom"><div class="a4-note">${bill.note ? `<strong>Order note</strong><br />${esc(order.customer_note)}` : (s.upi_id ? `<strong>Pay via UPI</strong><br />${esc(s.upi_id)}` : "")}</div><div class="a4-totals"><div class="receipt-total-row"><span>Subtotal</span><strong>${money(bill.subtotal)}</strong></div>${bill.discount_total ? `<div class="receipt-total-row"><span>Discount</span><strong>−${money(bill.discount_total)}</strong></div><div class="receipt-total-row"><span>After discount</span><strong>${money(bill.discounted_subtotal)}</strong></div>` : ""}${bill.tax ? `<div class="receipt-total-row"><span>Tax / GST</span><strong>${money(bill.tax)}</strong></div>` : ""}${order.order_type === "delivery" ? `<div class="receipt-total-row"><span>Delivery fee</span><strong>${bill.deliveryFee ? money(bill.deliveryFee) : "Free"}</strong></div>` : ""}<div class="receipt-total-row grand"><span>Total due</span><strong>${money(bill.total)}</strong></div></div></div><footer class="a4-footer">${esc(s.bill_footer || "Thank you for dining with us.")}</footer></article>`;
  }
  printWithSize(type);
}
function printWithSize(type) {
  const style = document.createElement("style"); style.id = "dynamic-print-page"; style.textContent = type === "receipt58" ? "@media print{@page{size:58mm auto;margin:3mm}}" : type === "receipt" ? "@media print{@page{size:80mm auto;margin:3mm}}" : type === "qr" ? "@media print{@page{size:90mm 130mm;margin:5mm}}" : "@media print{@page{size:A4 portrait;margin:14mm}}";
  $("#dynamic-print-page")?.remove(); document.head.append(style); document.body.classList.add("print-mode");
  const clean = () => { document.body.classList.remove("print-mode"); $("#dynamic-print-page")?.remove(); window.removeEventListener("afterprint", clean); };
  window.addEventListener("afterprint", clean); window.print(); setTimeout(clean, 1500);
}
function printOrdersList() {
  const orders = filteredOrders("all"); const s = adminData.settings;
  const rows = orders.map(o => `<tr><td>${orderCode(o)}</td><td>${new Intl.DateTimeFormat("en-IN", { dateStyle: "short", timeStyle: "short" }).format(new Date(o.created_at))}</td><td>${esc(orderServiceLabel(o))}${o.delivery_address ? `<br />${esc(o.delivery_address)}, ${esc(o.delivery_city || "")}` : ""}</td><td>${esc(o.customer_name || "Guest")}${o.customer_phone ? `<br />${esc(o.customer_phone)}` : ""}</td><td>${esc(orderSummaryLine(o))}</td><td>${esc(STATUS[o.status]?.label || o.status)}</td><td>${money(getOrderTotal(o))}</td></tr>`).join("");
  $("#print-root").innerHTML = `<article class="print-document print-a4"><header class="a4-header"><div class="a4-brand"><h1>${esc(s.restaurant_name)}</h1><p>${esc(s.address || "")}</p></div><div class="a4-invoice-label"><strong>ORDERS</strong><p>${new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date())}</p></div></header><table class="a4-items"><thead><tr><th>Order</th><th>Time</th><th>Service / address</th><th>Guest</th><th>Items</th><th>Status</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></article>`; printWithSize("a4");
}

/* Authentication and event wiring */
async function checkStaffSession(user) {
  if (!LIVE || !dbClient) return;
  try {
    const { data, error } = await dbClient.from("staff_users").select("role,display_name,is_active").eq("user_id", user.id).single();
    if (error) throw error;
    if (!data?.is_active) throw new Error("This staff account has been disabled.");
    adminData.user = user; adminData.displayName = data.display_name || user.email || "Staff";
    await adminLoad(); subscribeOrders();
  } catch (error) {
    console.error(error); await dbClient.auth.signOut();
    $("#login-error").textContent = error.message.includes("row") ? "This account has no staff access yet. Ask your admin to add it to staff_users." : error.message;
    $("#login-error").hidden = false;
  }
}
async function login(event) {
  event.preventDefault(); $("#login-error").hidden = true;
  const email = $("#login-email").value.trim(); const password = $("#login-password").value; const button = $("#login-form").querySelector("button[type=submit]");
  button.disabled = true; button.textContent = "Signing in…";
  if (!(LIVE && dbClient)) {
    if (email.toLowerCase() === "demo@hotel.local" && password === "demo123") { demoLoggedIn = true; setDemoAdminSession(true); renderAdmin(); toast("Welcome to the demo workspace.", "success"); }
    else { $("#login-error").textContent = "For the local demo, use demo@hotel.local and demo123."; $("#login-error").hidden = false; }
  } else {
    try { const { data, error } = await dbClient.auth.signInWithPassword({ email, password }); if (error) throw error; await checkStaffSession(data.user); }
    catch (error) { $("#login-error").textContent = error.message || "Couldn't sign in."; $("#login-error").hidden = false; }
  }
  button.disabled = false; button.innerHTML = `Sign in <span aria-hidden="true">→</span>`;
}
async function logout() {
  if (LIVE && dbClient) { await dbClient.auth.signOut(); if (realtimeChannel) await dbClient.removeChannel(realtimeChannel); adminData.user = null; adminData.displayName = null; }
  demoLoggedIn = false; setDemoAdminSession(false); renderAdmin();
}
function subscribeOrders() {
  if (!dbClient || realtimeChannel) return;
  realtimeChannel = dbClient.channel("admin-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, async payload => {
    if (payload.eventType === "INSERT") toast(`New order received · #${String(payload.new.order_number).padStart(4, "0")}`, "success");
    await adminLoad();
  }).subscribe();
}
function initAdminEvents() {
  $$(".admin-nav-item").forEach(btn => btn.addEventListener("click", () => navigateAdmin(btn.dataset.view)));
  $$('[data-go-view]').forEach(btn => btn.addEventListener("click", () => navigateAdmin(btn.dataset.goView)));
  $("#login-form").addEventListener("submit", login); $("#sign-out").addEventListener("click", logout);
  $("#refresh-admin").addEventListener("click", adminLoad); $("#add-menu-item").addEventListener("click", () => openMenuDialog()); $("#manage-categories").addEventListener("click", openCategoriesDialog); $("#add-table").addEventListener("click", openTableDialog);
  $("#order-search").addEventListener("input", renderOrders);
  $$("[data-order-filter]").forEach(btn => btn.addEventListener("click", () => { orderFilter = btn.dataset.orderFilter; $$("[data-order-filter]").forEach(x => x.classList.toggle("selected", x === btn)); renderOrders(); }));
  $("#admin-menu-search").addEventListener("input", renderAdminMenu); $("#report-range").addEventListener("change", e => { reportRange = e.target.value; renderReports(); });
  $("#history-range").addEventListener("change", renderHistory); $("#history-search").addEventListener("input", renderHistory); $("#export-customers").addEventListener("click", () => exportCustomers(false));
  $("#customer-search").addEventListener("input", renderCustomers); $("#export-marketing-customers").addEventListener("click", () => exportCustomers(true));
  $("#export-report").addEventListener("click", exportReport); $("#print-orders").addEventListener("click", printOrdersList);
  $("#settings-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const logoFile = form.get("logo_file");
    const areas = [...new Map(String(form.get("delivery_areas") || "").split(/\r?\n/).map(area => area.trim()).filter(Boolean).map(area => [area.toLocaleLowerCase(), area])).values()];
    const deliveryEnabled = form.has("is_delivery_enabled");
    const deliveryCity = form.get("delivery_city").trim();
    if (deliveryEnabled && (!deliveryCity || !areas.length)) {
      toast("To enable delivery, add the city and at least one service area.", "error");
      if (!deliveryCity) $("#settings-form").elements.namedItem("delivery_city").focus();
      else $("#settings-form").elements.namedItem("delivery_areas").focus();
      return;
    }
    saveSettings({ restaurant_name: form.get("restaurant_name").trim(), phone: form.get("phone").trim(), address: form.get("address").trim(), tax_percent: Number(form.get("tax_percent")) || 0, currency: (form.get("currency").trim() || "INR").toUpperCase(), upi_id: form.get("upi_id").trim(), gstin: form.get("gstin").trim(), logo_url: form.get("logo_url").trim(), offer_message: form.get("offer_message").trim(), opening_hours: form.get("opening_hours").trim(), estimated_time: form.get("estimated_time").trim(), is_accepting_orders: form.has("is_accepting_orders"), is_delivery_enabled: deliveryEnabled, delivery_city: deliveryCity, delivery_areas: areas, delivery_fee: Math.max(0, Number(form.get("delivery_fee")) || 0), bill_footer: form.get("bill_footer").trim() }, logoFile);
  });
  $("#logo-file").addEventListener("change", async event => { const file = event.currentTarget.files?.[0]; if (!file) return; try { setLogoPreview(await blobAsDataUrl(await compressLogo(file))); } catch (error) { toast(error.message, "error"); } });
  $("#settings-form").elements.namedItem("logo_url").addEventListener("input", event => { if (!$("#logo-file").files?.length) setLogoPreview(event.currentTarget.value.trim()); });
  $("#admin-profile").addEventListener("click", logout);
  document.addEventListener("click", event => { const order = event.target.closest("[data-select-order]"); if (order) { navigateAdmin("orders"); selectedOrderId = order.dataset.selectOrder; renderOrders(); } });
  if (LIVE && dbClient) dbClient.auth.onAuthStateChange((event, session) => { if (event === "SIGNED_IN" && session) checkStaffSession(session.user); if (event === "SIGNED_OUT") { adminData.user = null; renderAdmin(); } });
}

async function boot() {
  demoLoggedIn = !LIVE && demoAdminSessionActive();
  await initBackend();
  if (ADMIN_MODE) {
    initAdminEvents();
    $("#customer-app").hidden = true; $("#cart-dock").hidden = true; $("#admin-app").hidden = false;
    if (!LIVE) { adminData = { categories: demo.categories, menu: demo.menu, tables: demo.tables, settings: { ...DEFAULT_SETTINGS, ...demo.settings }, orders: demo.orders }; }
    if (adminData.user || demoLoggedIn) await adminLoad(); else renderAdmin();
    const requestedView = new URLSearchParams(location.search).get("view");
    if (requestedView && $("[data-admin-view='" + requestedView + "']")) navigateAdmin(requestedView);
    return;
  }
  initGuestEvents();
  await loadGuestData();
  window.addEventListener("storage", event => {
    if (!(LIVE && dbClient) && event.key === DEMO_KEY) {
      demo = readDemo();
      if (activeOrder) refreshTracking();
    }
  });
}

boot();
