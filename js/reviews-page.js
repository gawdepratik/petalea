(function () {
  const averageEl = document.getElementById("reviewsAverage");
  const starsEl = document.getElementById("reviewsAverageStars");
  const countEl = document.getElementById("reviewsCount");
  const listEl = document.getElementById("allReviewsList");
  if (!listEl) return;

  function starString(rating) {
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  }

  async function load() {
    try {
      const response = await fetch(`${API_BASE}/api/reviews`);
      if (!response.ok) throw new Error("Request failed");
      const reviews = await response.json();

      if (!reviews.length) {
        averageEl.textContent = "—";
        starsEl.textContent = "";
        countEl.textContent = "No reviews yet — be the first!";
        listEl.innerHTML = "";
        return;
      }

      const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      averageEl.textContent = average.toFixed(1);
      starsEl.textContent = starString(Math.round(average));
      countEl.textContent = `Based on ${reviews.length} review${reviews.length === 1 ? "" : "s"}`;

      listEl.innerHTML = reviews
        .map(
          (r) => `
            <div class="review-item">
              <span class="all-review-product">${r.product_name}</span>
              <div class="review-stars">${starString(r.rating)}</div>
              <strong>${r.customer_name}</strong>
              <p>${r.review_text}</p>
            </div>
          `
        )
        .join("");
    } catch {
      countEl.textContent = "Could not load reviews right now.";
      listEl.innerHTML = "";
    }
  }

  load();
})();
