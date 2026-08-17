(function () {
  function formatPrice(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value);
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
          <p>${product.description}</p>
          <div class="product-bottom">
            <span class="product-price">${priceMarkup}</span>
            ${actionMarkup}
          </div>
          <button type="button" class="card-review-link write-review-trigger" data-id="${product.id}">Write a review</button>
        </div>
      </article>
    `;
  }

  function renderGrid(grid, products) {
    grid.innerHTML = products.length
      ? products.map(productCardMarkup).join("")
      : '<p class="empty-cart">More creations are on their way — check back soon.</p>';
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
      }

      if (allGrid) {
        const rest = products.filter((p) => !p.featured);
        renderGrid(allGrid, rest);
        if (categoryFilters) setupCollectionControls(categoryFilters, allGrid, rest);
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
