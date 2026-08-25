const API_BASE = "https://petalea.onrender.com";

// Set this to the business WhatsApp number (digits only, with country code,
// e.g. "919226990668") to activate the floating WhatsApp button.
// Leave empty to keep the button hidden.
const WHATSAPP_NUMBER = "919702613861";

// Google Analytics 4 measurement ID. Only loads after a visitor accepts
// the cookie banner. Leave empty to disable analytics entirely.
const GA_MEASUREMENT_ID = "G-HVDZH2T6RP";

// Minimum number of days ahead a customer can pick as their preferred
// delivery date, since each piece is handmade to order. Doesn't apply to
// orders admins create manually — those are already agreed with the customer.
const MIN_DELIVERY_LEAD_DAYS = 7;

function earliestDeliveryDate() {
  const date = new Date();
  date.setDate(date.getDate() + MIN_DELIVERY_LEAD_DAYS);
  return date.toISOString().slice(0, 10);
}

// Looks up the city/state/localities for an Indian PIN code via India Post's
// free public API. A single 6-digit pincode often covers several distinct
// post offices (localities) - e.g. Mumbai 400001 covers ~7 - so this returns
// the full list of area names alongside the coarser city/state, letting
// callers offer a locality picker for precision beyond just the city.
// Returns null on any failure (invalid pincode, network error, no match) so
// callers can just leave the fields for manual entry.
async function lookupCityFromPincode(pincode) {
  if (!/^\d{6}$/.test(pincode)) return null;
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    const postOffices = data?.[0]?.PostOffice || [];
    if (!postOffices.length) return null;
    return {
      city: postOffices[0].District || postOffices[0].Name || "",
      state: postOffices[0].State || "",
      areas: postOffices.map((po) => po.Name).filter(Boolean)
    };
  } catch {
    return null;
  }
}
