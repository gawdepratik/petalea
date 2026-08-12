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

    return `
      <article class="product-card">
        ${productImageMarkup(product)}
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <div class="product-bottom">
            <span class="product-price">${priceMarkup}</span>
            <button class="add-cart" data-id="${product.id}" data-product="${product.name}" data-price="${finalPrice}">Add to cart</button>
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

  function setupCategoryFilters(filterBar, allGrid, products) {
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
    if (!categories.length) {
      filterBar.hidden = true;
      return;
    }

    filterBar.hidden = false;
    filterBar.innerHTML = ["All", ...categories]
      .map((c, i) => `<button class="category-filter-btn${i === 0 ? " active" : ""}" data-category="${c}">${c}</button>`)
      .join("");

    filterBar.addEventListener("click", (event) => {
      const button = event.target.closest(".category-filter-btn");
      if (!button) return;

      filterBar.querySelectorAll(".category-filter-btn").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");

      const category = button.dataset.category;
      const filtered = category === "All" ? products : products.filter((p) => p.category === category);
      renderGrid(allGrid, filtered);
    });
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
        if (categoryFilters) setupCategoryFilters(categoryFilters, allGrid, rest);
      }

      document.dispatchEvent(new CustomEvent("products:loaded"));
    } catch (err) {
      const message = '<p class="empty-cart">Unable to load products right now. Please refresh the page.</p>';
      if (featuredGrid) featuredGrid.innerHTML = message;
      if (allGrid) allGrid.innerHTML = message;
    }
  }

  loadProducts();
})();
