(function () {
  const modal = document.getElementById("productDetailModal");
  if (!modal) return;

  const overlay = document.getElementById("productDetailOverlay");
  const closeButton = document.getElementById("closeProductDetail");
  const detailImage = document.getElementById("detailImage");
  const detailCategory = document.getElementById("detailCategory");
  const detailName = document.getElementById("detailName");
  const detailDescription = document.getElementById("detailDescription");
  const detailPrice = document.getElementById("detailPrice");
  const detailAction = document.getElementById("detailAction");
  const reviewsList = document.getElementById("detailReviewsList");
  const toggleReviewForm = document.getElementById("toggleReviewForm");
  const reviewForm = document.getElementById("reviewForm");
  const reviewFeedback = document.getElementById("reviewFeedback");

  let products = [];
  let currentProductId = null;

  document.addEventListener("products:loaded", (event) => {
    products = event.detail || [];
  });

  function formatPrice(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value);
  }

  function starString(rating) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  async function loadReviews(productId) {
    reviewsList.innerHTML = "<p class=\"admin-hint\">Loading reviews…</p>";
    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}/reviews`);
      const reviews = await response.json();

      reviewsList.innerHTML = reviews.length
        ? reviews
            .map(
              (r) => `
                <div class="review-item">
                  <div class="review-stars">${starString(r.rating)}</div>
                  <strong>${r.customer_name}</strong>
                  <p>${r.review_text}</p>
                </div>
              `
            )
            .join("")
        : "<p class=\"admin-hint\">No reviews yet — be the first!</p>";
    } catch {
      reviewsList.innerHTML = "<p class=\"admin-hint\">Could not load reviews right now.</p>";
    }
  }

  function openModal(productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    currentProductId = productId;
    reviewForm.hidden = true;
    reviewForm.reset();
    reviewFeedback.hidden = true;

    detailImage.innerHTML = product.image_url && product.image_url.startsWith("ph-")
      ? `<div class="product-placeholder ${product.image_url}"><span>PETALÉA</span></div>`
      : `<img src="${product.image_url}" alt="${product.name}">`;
    detailCategory.textContent = product.category || "";
    detailName.textContent = product.name;
    detailDescription.textContent = product.description;

    const hasDiscount = product.discount_percent > 0;
    const finalPrice = hasDiscount
      ? Math.round(product.price * (1 - product.discount_percent / 100))
      : product.price;
    detailPrice.innerHTML = hasDiscount
      ? `<strong>${formatPrice(finalPrice)}</strong> <span class="price-original">${formatPrice(product.price)}</span>`
      : `<strong>${formatPrice(product.price)}</strong>`;

    const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;
    detailAction.innerHTML = outOfStock
      ? `<form class="notify-form" data-product-id="${product.id}">
          <input type="email" required placeholder="Email me when back">
          <button type="submit">Notify me</button>
        </form>`
      : `<button class="add-cart" data-id="${product.id}" data-product="${product.name}" data-price="${finalPrice}">Add to cart</button>`;

    modal.hidden = false;
    loadReviews(productId);
  }

  function closeModal() {
    modal.hidden = true;
    currentProductId = null;
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".product-detail-trigger");
    if (!trigger) return;
    const card = trigger.closest(".product-card");
    if (!card) return;
    openModal(Number(card.dataset.id));
  });

  overlay.addEventListener("click", closeModal);
  closeButton.addEventListener("click", closeModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  toggleReviewForm.addEventListener("click", () => {
    reviewForm.hidden = !reviewForm.hidden;
  });

  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    reviewFeedback.hidden = true;
    const submitButton = reviewForm.querySelector("button[type='submit']");
    submitButton.disabled = true;

    const payload = {
      customer_name: document.getElementById("reviewName").value.trim(),
      customer_email: document.getElementById("reviewEmail").value.trim(),
      rating: Number(document.getElementById("reviewRating").value),
      review_text: document.getElementById("reviewText").value.trim()
    };

    try {
      const response = await fetch(`${API_BASE}/api/products/${currentProductId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();

      if (!response.ok) {
        reviewFeedback.textContent = body.error || "Could not submit your review.";
        reviewFeedback.className = "promo-feedback error";
      } else {
        reviewFeedback.textContent = "Thank you! Your review will appear once approved.";
        reviewFeedback.className = "promo-feedback success";
        reviewForm.reset();
        reviewForm.hidden = true;
      }
      reviewFeedback.hidden = false;
    } catch {
      reviewFeedback.textContent = "Something went wrong. Please try again.";
      reviewFeedback.className = "promo-feedback error";
      reviewFeedback.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });
})();
