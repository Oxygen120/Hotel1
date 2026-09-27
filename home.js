const CFG = window.HOTEL_CONFIG || {};
const DEMO_KEY = "juniper-stone-demo-v1";
const DEFAULT_SETTINGS = {
  restaurant_name: "Juniper & Stone",
  address: "12 Garden Lane, Bengaluru",
  phone: "+91 98765 43210",
  opening_hours: "11 am – 11 pm",
  is_accepting_orders: true,
  is_delivery_enabled: true,
  delivery_city: "Bengaluru",
  delivery_areas: ["Indiranagar", "Koramangala", "MG Road"],
  delivery_fee: 0,
  currency: "INR",
  logo_url: ""
};

function renderArea(container, area, className) {
  const chip = document.createElement("span");
  chip.className = className;
  chip.textContent = area;
  container.append(chip);
}

function updatePage(settings) {
  const name = settings.restaurant_name || DEFAULT_SETTINGS.restaurant_name;
  const areas = Array.isArray(settings.delivery_areas)
    ? settings.delivery_areas.map(area => String(area).trim()).filter(Boolean)
    : String(settings.delivery_areas || "").split(/\r?\n/).map(area => area.trim()).filter(Boolean);
  const city = String(settings.delivery_city || "").trim();
  const canDeliver = settings.is_delivery_enabled !== false && settings.is_accepting_orders !== false && Boolean(city) && areas.length > 0;

  document.title = `${name} — Welcome`;
  document.querySelectorAll("[data-home-name]").forEach(el => { el.textContent = name; });
  document.querySelectorAll("[data-home-city]").forEach(el => { el.textContent = city || "your city"; });
  document.querySelectorAll("[data-home-address]").forEach(el => { el.textContent = settings.address || ""; });
  document.querySelectorAll("[data-home-hours]").forEach(el => { el.textContent = settings.opening_hours || "Hours vary"; });
  const phone = String(settings.phone || "").trim();
  document.querySelectorAll("[data-home-phone]").forEach(el => {
    el.textContent = phone;
    el.href = phone ? `tel:${phone.replace(/[^+\d]/g, "")}` : "#";
    el.hidden = !phone;
  });

  const logo = document.querySelector("[data-home-logo]");
  const brandMark = logo?.closest(".brand-mark");
  if (logo && settings.logo_url) {
    logo.src = settings.logo_url;
    logo.hidden = false;
    brandMark?.classList.add("has-logo");
    brandMark?.querySelector(".brand-initials")?.setAttribute("hidden", "");
  }

  const status = document.querySelector("#home-status");
  if (status) {
    const accepting = settings.is_accepting_orders !== false;
    status.classList.toggle("closed", !accepting);
    status.querySelector("b").textContent = accepting ? "Open for orders" : "Orders paused";
  }

  const areaList = document.querySelector("#home-area-list");
  const areaChips = document.querySelector("#home-area-chips");
  areaList.replaceChildren();
  areaChips.replaceChildren();
  areas.forEach(area => {
    renderArea(areaList, area, "home-area-chip");
    renderArea(areaChips, area, "home-area-chip");
  });
  document.querySelector("#home-area-count").textContent = areas.length ? `${areas.length} local areas` : "No delivery areas configured";
  const fee = Math.max(0, Number(settings.delivery_fee) || 0);
  let feeLabel = fee ? `${fee} ${settings.currency || "INR"}` : "Free delivery";
  try { if (fee) feeLabel = new Intl.NumberFormat("en-IN", { style: "currency", currency: settings.currency || "INR", maximumFractionDigits: 2 }).format(fee); } catch { /* Use the configured amount and currency if the code is not supported. */ }
  document.querySelector("#home-delivery-fee").textContent = fee ? `Delivery fee: ${feeLabel}` : "Free delivery";
  document.querySelector("#delivery-summary").hidden = !canDeliver;
  document.querySelector("#delivery-unavailable").hidden = canDeliver;
  document.querySelector(".home-delivery-band").hidden = !canDeliver;
  document.querySelectorAll("#header-delivery-link, #delivery-cta, #service-delivery-link").forEach(link => {
    link.hidden = !canDeliver;
    link.setAttribute("aria-disabled", String(!canDeliver));
  });
}

async function loadSettings() {
  let settings = { ...DEFAULT_SETTINGS };
  try {
    if (CFG.demoMode === true || !CFG.supabaseUrl || !CFG.supabaseAnonKey) {
      const saved = JSON.parse(localStorage.getItem(DEMO_KEY) || "null");
      if (saved?.settings) settings = { ...settings, ...saved.settings };
    } else {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await supabase.from("restaurant_settings").select("restaurant_name,address,phone,opening_hours,is_accepting_orders,is_delivery_enabled,delivery_city,delivery_areas,delivery_fee,currency,logo_url").eq("id", true).single();
      if (error) throw error;
      settings = { ...settings, ...data };
    }
  } catch (error) {
    console.error("Couldn't load restaurant settings for the homepage.", error);
    if (CFG.supabaseUrl && CFG.supabaseAnonKey && CFG.demoMode !== true) {
      settings.is_delivery_enabled = false;
      settings.delivery_city = "";
      settings.delivery_areas = [];
    }
  }
  updatePage(settings);
}

loadSettings();
