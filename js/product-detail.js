(function () {
  const modal = document.getElementById("productDetailModal");
  const writeReviewModal = document.getElementById("writeReviewModal");
  if (!modal && !writeReviewModal) return;

  const overlay = document.getElementById("productDetailOverlay");
  const closeButton = document.getElementById("closeProductDetail");
  const detailImage = document.getElementById("detailImage");
  const detailThumbs = document.getElementById("detailThumbs");
  const detailCategory = document.getElementById("detailCategory");
  const detailName = document.getElementById("detailName");
  const detailDescription = document.getElementById("detailDescription");
  const detailDimensions = document.getElementById("detailDimensions");
  const detailPrice = document.getElementById("detailPrice");
  const detailAction = document.getElementById("detailAction");
  const reviewsList = document.getElementById("detailReviewsList");

  const openWriteReviewButton = document.getElementById("openWriteReview");
  const writeReviewOverlay = document.getElementById("writeReviewOverlay");
  const closeWriteReviewButton = document.getElementById("closeWriteReview");
  const reviewProductInput = document.getElementById("reviewProductId");
  const reviewProductOptions = document.getElementById("reviewProductOptions");
  const reviewForm = document.getElementById("reviewForm");
  const reviewFeedback = document.getElementById("reviewFeedback");

  let products = [];

  document.addEventListener("products:loaded", (event) => {
    products = event.detail || [];
    if (reviewProductOptions) {
      reviewProductOptions.innerHTML = products
        .map((p) => `<option value="${p.name}"></option>`)
        .join("");
    }
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

  function imageMarkup(url, alt) {
    return url && url.startsWith("ph-")
      ? `<div class="product-placeholder ${url}"><span>PETALÉA</span></div>`
      : `<img src="${url}" alt="${alt}">`;
  }

  function showMainImage(url, alt) {
    detailImage.innerHTML = imageMarkup(url, alt);
  }

  function openModal(productId) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const gallery = [product.image_url, ...(product.additional_images || [])].filter(Boolean);
    showMainImage(product.image_url, product.name);

    if (gallery.length > 1) {
      detailThumbs.innerHTML = gallery
        .map((url, i) => {
          const thumb = url.startsWith("ph-")
            ? `<div class="product-placeholder ${url}"></div>`
            : `<img src="${url}" alt="${product.name} view ${i + 1}">`;
          return `<button type="button" class="product-thumb${i === 0 ? " active" : ""}" data-url="${url}">${thumb}</button>`;
        })
        .join("");
      detailThumbs.hidden = false;
    } else {
      detailThumbs.innerHTML = "";
      detailThumbs.hidden = true;
    }

    detailCategory.textContent = product.category || "";
    detailName.textContent = product.name;
    detailDescription.textContent = product.description;

    if (product.dimensions) {
      detailDimensions.textContent = `Dimensions: ${product.dimensions}`;
      detailDimensions.hidden = false;
    } else {
      detailDimensions.hidden = true;
    }

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
  }

  if (modal) {
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

    detailThumbs.addEventListener("click", (event) => {
      const thumb = event.target.closest(".product-thumb");
      if (!thumb) return;
      detailThumbs.querySelectorAll(".product-thumb").forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");
      showMainImage(thumb.dataset.url, detailName.textContent);
    });
  }

  function openWriteReviewModal() {
    reviewForm.reset();
    reviewFeedback.hidden = true;
    writeReviewModal.hidden = false;
  }

  function closeWriteReviewModal() {
    writeReviewModal.hidden = true;
  }

  if (writeReviewModal) {
    if (openWriteReviewButton) {
      openWriteReviewButton.addEventListener("click", openWriteReviewModal);
    }
    writeReviewOverlay.addEventListener("click", closeWriteReviewModal);
    closeWriteReviewButton.addEventListener("click", closeWriteReviewModal);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !writeReviewModal.hidden) closeWriteReviewModal();
    });

    reviewForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      reviewFeedback.hidden = true;

      const typedName = reviewProductInput.value.trim().toLowerCase();
      const matchedProduct = products.find((p) => p.name.toLowerCase() === typedName);
      if (!matchedProduct) {
        reviewFeedback.textContent = "Please select a valid product from the list.";
        reviewFeedback.className = "promo-feedback error";
        reviewFeedback.hidden = false;
        return;
      }

      const submitButton = reviewForm.querySelector("button[type='submit']");
      submitButton.disabled = true;

      const productId = matchedProduct.id;
      const payload = {
        customer_name: document.getElementById("reviewName").value.trim(),
        customer_email: document.getElementById("reviewEmail").value.trim(),
        rating: Number(document.getElementById("reviewRating").value),
        review_text: document.getElementById("reviewText").value.trim()
      };

      try {
        const response = await fetch(`${API_BASE}/api/products/${productId}/reviews`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const body = await response.json();

        if (!response.ok) {
          reviewFeedback.textContent = body.error || "Could not submit your review.";
          reviewFeedback.className = "promo-feedback error";
          reviewFeedback.hidden = false;
          if (typeof showToast === "function") showToast(body.error || "Could not submit your review.");
        } else {
          reviewFeedback.textContent = "Thank you! Your review will appear once approved.";
          reviewFeedback.className = "promo-feedback success";
          reviewFeedback.hidden = false;
          if (typeof showToast === "function") showToast("Review submitted! It will appear once approved.");
          reviewForm.reset();
          setTimeout(closeWriteReviewModal, 900);
        }
      } catch {
        reviewFeedback.textContent = "Something went wrong. Please try again.";
        reviewFeedback.className = "promo-feedback error";
        reviewFeedback.hidden = false;
        if (typeof showToast === "function") showToast("Something went wrong. Please try again.");
      } finally {
        submitButton.disabled = false;
      }
    });
  }
})();
