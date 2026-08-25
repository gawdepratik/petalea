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

// Looks up the city/state for an Indian PIN code via India Post's free public
// API. Returns null on any failure (invalid pincode, network error, no match)
// so callers can just leave the city field for manual entry.
async function lookupCityFromPincode(pincode) {
  if (!/^\d{6}$/.test(pincode)) return null;
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    const postOffice = data?.[0]?.PostOffice?.[0];
    if (!postOffice) return null;
    return { city: postOffice.District || postOffice.Name || "", state: postOffice.State || "" };
  } catch {
    return null;
  }
}
