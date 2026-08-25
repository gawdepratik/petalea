(function () {
  const form = document.getElementById("customOrderForm");
  const feedback = document.getElementById("customOrderFeedback");
  if (!form) return;

  const deliveryDateInput = document.getElementById("customDeliveryDate");
  if (deliveryDateInput) deliveryDateInput.min = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    feedback.hidden = true;
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;

    const payload = {
      customer_name: document.getElementById("customName").value.trim(),
      customer_email: document.getElementById("customEmail").value.trim(),
      customer_phone: document.getElementById("customPhone").value.trim(),
      occasion: document.getElementById("customOccasion").value,
      flower_preferences: document.getElementById("customPreferences").value.trim(),
      budget_range: document.getElementById("customBudget").value,
      delivery_date: document.getElementById("customDeliveryDate").value || null,
      notes: document.getElementById("customNotes").value.trim()
    };

    try {
      const response = await fetch(`${API_BASE}/api/custom-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      const whatsappLink = document.getElementById("customWhatsappLink");

      if (!response.ok) {
        feedback.textContent = body.error || "Could not send your request. Please try again.";
        feedback.className = "promo-feedback error";
      } else {
        feedback.textContent = "Thank you! We've received your request and will reach out shortly.";
        feedback.className = "promo-feedback success";
        if (whatsappLink && typeof WHATSAPP_NUMBER !== "undefined" && WHATSAPP_NUMBER) {
          const message = encodeURIComponent(
            `Hi! I just sent a custom order request on petalea.in (${payload.customer_name}). I'd love to chat about it.`
          );
          whatsappLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
          whatsappLink.hidden = false;
        }
        form.reset();
        if (deliveryDateInput) deliveryDateInput.min = new Date().toISOString().slice(0, 10);
        if (typeof showToast === "function") showToast("Custom order request sent!");
      }
      feedback.hidden = false;
    } catch {
      feedback.textContent = "Something went wrong. Please try again.";
      feedback.className = "promo-feedback error";
      feedback.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });
})();
