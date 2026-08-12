const lookupForm = document.getElementById("lookupForm");
const lookupError = document.getElementById("lookupError");
const lookupResult = document.getElementById("lookupResult");

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

const STATUS_LABELS = {
  new: "Order received",
  confirmed: "Confirmed",
  shipped: "Shipped",
  completed: "Delivered",
  cancelled: "Cancelled"
};

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  lookupError.hidden = true;
  lookupResult.hidden = true;

  const ref = document.getElementById("lookupRef").value.trim();
  const email = document.getElementById("lookupEmail").value.trim();

  try {
    const response = await fetch(
      `${API_BASE}/api/orders/lookup?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      lookupError.textContent = body.error || "Could not find that order.";
      lookupError.hidden = false;
      return;
    }

    const order = await response.json();

    document.getElementById("resultRef").textContent = order.orderRef;
    document.getElementById("resultStatus").textContent = STATUS_LABELS[order.status] || order.status;

    const trackingEl = document.getElementById("resultTracking");
    if (order.status === "shipped" && order.tracking_number) {
      trackingEl.textContent = `Tracking number: ${order.tracking_number}`;
      trackingEl.hidden = false;
    } else {
      trackingEl.hidden = true;
    }

    const refundEl = document.getElementById("resultRefund");
    if (order.refund_amount > 0) {
      refundEl.textContent = `Refund: ${formatPrice(order.refund_amount)} (${order.refund_status})`;
      refundEl.hidden = false;
    } else {
      refundEl.hidden = true;
    }

    document.getElementById("resultItems").innerHTML = order.items
      .map((i) => `<li>${i.product_name} × ${i.quantity}</li>`)
      .join("");

    document.getElementById("resultTotal").textContent = formatPrice(order.total);

    lookupResult.hidden = false;
  } catch {
    lookupError.textContent = "Something went wrong. Please try again.";
    lookupError.hidden = false;
  }
});
