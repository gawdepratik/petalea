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

  async function loadProducts() {
    const featuredGrid = document.getElementById("featured-grid");
    const allGrid = document.getElementById("all-grid");
    if (!featuredGrid && !allGrid) return;

    try {
      const response = await fetch(`${API_BASE}/api/products`);
      if (!response.ok) throw new Error("Request failed");
      const products = await response.json();

      if (featuredGrid) {
        const featured = products.filter((p) => p.featured);
        featuredGrid.innerHTML = featured.map(productCardMarkup).join("");
      }

      if (allGrid) {
        const rest = products.filter((p) => !p.featured);
        allGrid.innerHTML = rest.length
          ? rest.map(productCardMarkup).join("")
          : '<p class="empty-cart">More creations are on their way — check back soon.</p>';
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
