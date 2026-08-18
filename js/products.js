(function () {
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

  function ratingMarkup(product) {
    if (!product.review_count) return "";
    return `
      <div class="card-rating">
        <span class="review-stars">${starString(Math.round(product.avg_rating))}</span>
        <span class="card-rating-count">(${product.review_count})</span>
      </div>
    `;
  }

  function productImageMarkup(product) {
    if (product.image_url && product.image_url.startsWith("ph-")) {
      return `<div class="product-placeholder ${product.image_url}"><span>PETALÉA</span></div>`;
    }
    return `<img src="${product.image_url}" alt="${product.name}">`;
  }

  function productCardMarkup(product) {
    const hasDiscount = product.discount_percent > 0;
    const finalPrice = hasDiscount
      ? Math.round(product.price * (1 - product.discount_percent / 100))
      : product.price;

    const priceMarkup = hasDiscount
      ? `<strong>${formatPrice(finalPrice)}</strong> <span class="price-original">${formatPrice(product.price)}</span>`
      : `<strong>${formatPrice(product.price)}</strong>`;

    const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0;
    const actionMarkup = outOfStock
      ? `<form class="notify-form" data-product-id="${product.id}">
          <input type="email" required placeholder="Email me when back">
          <button type="submit">Notify me</button>
        </form>`
      : `<button class="add-cart" data-id="${product.id}" data-product="${product.name}" data-price="${finalPrice}">Add to cart</button>`;

    return `
      <article class="product-card${outOfStock ? " is-out-of-stock" : ""}" data-id="${product.id}">
        <div class="product-detail-trigger">${productImageMarkup(product)}</div>
        <div class="product-info">
          <h3 class="product-detail-trigger">${product.name}</h3>
          ${ratingMarkup(product)}
          <p>${product.description}</p>
          <div class="product-bottom">
            <span class="product-price">${priceMarkup}</span>
            ${actionMarkup}
          </div>
        </div>
      </article>
    `;
  }

  function renderGrid(grid, products) {
    grid.innerHTML = products.length
      ? products.map(productCardMarkup).join("")
      : '<p class="empty-cart">More creations are on their way — check back soon.</p>';
  }

  function injectStructuredData(list) {
    if (!list.length) return;
    let script = document.getElementById("productsJsonLd");
    if (!script) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "productsJsonLd";
      document.head.appendChild(script);
    }

    const itemListElement = list.map((p, i) => {
      const finalPrice = p.discount_percent > 0
        ? Math.round(p.price * (1 - p.discount_percent / 100))
        : p.price;

      return {
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Product",
          name: p.name,
          description: p.description,
          image: p.image_url && !p.image_url.startsWith("ph-") ? p.image_url : undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: finalPrice,
            availability: p.stock_quantity === null || p.stock_quantity > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock"
          },
          aggregateRating: p.review_count > 0
            ? { "@type": "AggregateRating", ratingValue: p.avg_rating.toFixed(1), reviewCount: p.review_count }
            : undefined
        }
      };
    });

    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement
    });
  }

  function setupCollectionControls(filterBar, allGrid, products) {
    const searchInput = document.getElementById("collectionSearch");
    const sortSelect = document.getElementById("collectionSort");
    const state = { category: "All", search: "", sort: "default" };

    function apply() {
      let list = state.category === "All" ? products : products.filter((p) => p.category === state.category);

      if (state.search) {
        const term = state.search.toLowerCase();
        list = list.filter((p) => p.name.toLowerCase().includes(term));
      }

      if (state.sort === "price-asc") {
        list = [...list].sort((a, b) => a.price - b.price);
      } else if (state.sort === "price-desc") {
        list = [...list].sort((a, b) => b.price - a.price);
      } else if (state.sort === "newest") {
        list = [...list].sort((a, b) => b.id - a.id);
      }

      renderGrid(allGrid, list);
    }

    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
    if (categories.length) {
      filterBar.hidden = false;
      filterBar.innerHTML = ["All", ...categories]
        .map((c, i) => `<button class="category-filter-btn${i === 0 ? " active" : ""}" data-category="${c}">${c}</button>`)
        .join("");

      filterBar.addEventListener("click", (event) => {
        const button = event.target.closest(".category-filter-btn");
        if (!button) return;
        filterBar.querySelectorAll(".category-filter-btn").forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        state.category = button.dataset.category;
        apply();
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.search = searchInput.value.trim();
        apply();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        state.sort = sortSelect.value;
        apply();
      });
    }
  }

  async function loadProducts() {
    const featuredGrid = document.getElementById("featured-grid");
    const allGrid = document.getElementById("all-grid");
    const categoryFilters = document.getElementById("categoryFilters");
    if (!featuredGrid && !allGrid) return;

    try {
      const response = await fetch(`${API_BASE}/api/products`);
      if (!response.ok) throw new Error("Request failed");
      const products = await response.json();

      if (featuredGrid) {
        const featured = products.filter((p) => p.featured);
        renderGrid(featuredGrid, featured);
        injectStructuredData(featured);
      }

      if (allGrid) {
        const rest = products.filter((p) => !p.featured);
        renderGrid(allGrid, rest);
        if (categoryFilters) setupCollectionControls(categoryFilters, allGrid, rest);
        injectStructuredData(rest);
      }

      document.dispatchEvent(new CustomEvent("products:loaded", { detail: products }));
    } catch (err) {
      const message = '<p class="empty-cart">Unable to load products right now. Please refresh the page.</p>';
      if (featuredGrid) featuredGrid.innerHTML = message;
      if (allGrid) allGrid.innerHTML = message;
    }
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest(".notify-form");
    if (!form) return;
    event.preventDefault();

    const email = form.querySelector("input[type='email']").value.trim();
    const button = form.querySelector("button");
    button.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/api/products/${form.dataset.productId}/notify-restock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!response.ok) throw new Error("Request failed");
      form.innerHTML = `<span class="out-of-stock">We'll email you when it's back.</span>`;
    } catch {
      button.disabled = false;
      button.textContent = "Try again";
    }
  });

  loadProducts();
})();
