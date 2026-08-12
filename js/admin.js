const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const emailForm = document.getElementById("emailForm");
const emailInput = document.getElementById("emailInput");
const codeForm = document.getElementById("codeForm");
const codeInput = document.getElementById("codeInput");
const codeEmailLabel = document.getElementById("codeEmailLabel");
const resendCode = document.getElementById("resendCode");
const loginError = document.getElementById("loginError");
const adminError = document.getElementById("adminError");
const logoutButton = document.getElementById("logoutButton");
const newProductButton = document.getElementById("newProductButton");
const productsTableBody = document.getElementById("productsTableBody");

const productModal = document.getElementById("productModal");
const productModalOverlay = document.getElementById("productModalOverlay");
const productModalTitle = document.getElementById("productModalTitle");
const productForm = document.getElementById("productForm");
const cancelProductButton = document.getElementById("cancelProductButton");
const toast = document.getElementById("toast");

const dashboardTitle = document.getElementById("dashboardTitle");
const tabProducts = document.getElementById("tabProducts");
const tabOrders = document.getElementById("tabOrders");
const productsPanel = document.getElementById("productsPanel");
const ordersPanel = document.getElementById("ordersPanel");
const reportFilterForm = document.getElementById("reportFilterForm");
const filterFrom = document.getElementById("filterFrom");
const filterTo = document.getElementById("filterTo");
const exportCsvLink = document.getElementById("exportCsvLink");
const summaryRevenue = document.getElementById("summaryRevenue");
const summaryCount = document.getElementById("summaryCount");
const summaryTopProducts = document.getElementById("summaryTopProducts");
const ordersTableBody = document.getElementById("ordersTableBody");

let pendingEmail = "";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function hideError(el) {
  el.hidden = true;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  return response;
}

async function checkSession() {
  const response = await api("/api/admin/products");
  if (response.ok) {
    dashboardView.hidden = false;
    loginView.hidden = true;
    renderProducts(await response.json());
  } else {
    dashboardView.hidden = true;
    loginView.hidden = false;
  }
}

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(loginError);
  pendingEmail = emailInput.value.trim();

  await api("/api/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ email: pendingEmail })
  });

  codeEmailLabel.textContent = pendingEmail;
  emailForm.hidden = true;
  codeForm.hidden = false;
  codeInput.focus();
});

resendCode.addEventListener("click", async () => {
  await api("/api/auth/request-otp", {
    method: "POST",
    body: JSON.stringify({ email: pendingEmail })
  });
  showToast("Code resent.");
});

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(loginError);

  const response = await api("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email: pendingEmail, code: codeInput.value.trim() })
  });

  if (!response.ok) {
    showError(loginError, "Invalid or expired code. Please try again.");
    return;
  }

  emailForm.hidden = false;
  codeForm.hidden = true;
  emailInput.value = "";
  codeInput.value = "";
  await checkSession();
});

logoutButton.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  await checkSession();
});

function renderProducts(products) {
  productsTableBody.innerHTML = products
    .map(
      (p) => `
        <tr data-id="${p.id}">
          <td>${p.name}</td>
          <td>₹${p.price}</td>
          <td>${p.discount_percent > 0 ? p.discount_percent + "%" : "—"}</td>
          <td><span class="admin-badge ${p.featured ? "on" : ""}">${p.featured ? "Featured" : "No"}</span></td>
          <td><span class="admin-badge ${p.active ? "on" : ""}">${p.active ? "Active" : "Hidden"}</span></td>
          <td class="admin-row-actions">
            <button class="link-button" data-action="edit">Edit</button>
            <button class="link-button" data-action="delete">Delete</button>
          </td>
        </tr>
      `
    )
    .join("");

  productsTableBody.dataset.products = JSON.stringify(products);
}

function openProductModal(product) {
  productForm.reset();
  document.getElementById("productId").value = product ? product.id : "";
  document.getElementById("productName").value = product ? product.name : "";
  document.getElementById("productDescription").value = product ? product.description : "";
  document.getElementById("productPrice").value = product ? product.price : "";
  document.getElementById("productDiscount").value = product ? product.discount_percent : 0;
  document.getElementById("productImage").value = product ? product.image_url : "";
  document.getElementById("productFeatured").checked = product ? product.featured : false;
  document.getElementById("productActive").checked = product ? product.active : true;
  productModalTitle.textContent = product ? "Edit product" : "Add product";
  productModal.hidden = false;
}

function closeProductModal() {
  productModal.hidden = true;
}

newProductButton.addEventListener("click", () => openProductModal(null));
cancelProductButton.addEventListener("click", closeProductModal);
productModalOverlay.addEventListener("click", closeProductModal);

productsTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const row = button.closest("tr");
  const id = row.dataset.id;
  const products = JSON.parse(productsTableBody.dataset.products || "[]");
  const product = products.find((p) => String(p.id) === id);

  if (button.dataset.action === "edit") {
    openProductModal(product);
  } else if (button.dataset.action === "delete") {
    deleteProduct(id, product.name);
  }
});

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? This can't be undone.`)) return;

  const response = await api(`/api/admin/products/${id}`, { method: "DELETE" });
  if (!response.ok) {
    showError(adminError, "Could not delete that product.");
    return;
  }
  hideError(adminError);
  showToast(`${name} deleted.`);
  checkSession();
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(adminError);

  const id = document.getElementById("productId").value;
  const payload = {
    name: document.getElementById("productName").value.trim(),
    description: document.getElementById("productDescription").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    discount_percent: Number(document.getElementById("productDiscount").value) || 0,
    image_url: document.getElementById("productImage").value.trim(),
    featured: document.getElementById("productFeatured").checked,
    active: document.getElementById("productActive").checked
  };

  const response = await api(id ? `/api/admin/products/${id}` : "/api/admin/products", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    showError(adminError, "Could not save that product. Check the fields and try again.");
    return;
  }

  closeProductModal();
  showToast(id ? "Product updated." : "Product added.");
  checkSession();
});

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function currentFilterQuery() {
  const params = new URLSearchParams();
  if (filterFrom.value) params.set("from", filterFrom.value);
  if (filterTo.value) params.set("to", filterTo.value);
  return params.toString();
}

function updateExportLink() {
  const query = currentFilterQuery();
  exportCsvLink.href = `${API_BASE}/api/admin/reports/export.csv${query ? "?" + query : ""}`;
}

function switchTab(tab) {
  const showOrders = tab === "orders";
  tabOrders.classList.toggle("active", showOrders);
  tabProducts.classList.toggle("active", !showOrders);
  ordersPanel.hidden = !showOrders;
  productsPanel.hidden = showOrders;
  dashboardTitle.textContent = showOrders ? "Orders & Sales" : "Products";

  if (showOrders) loadOrders();
}

tabProducts.addEventListener("click", () => switchTab("products"));
tabOrders.addEventListener("click", () => switchTab("orders"));

async function loadOrders() {
  const query = currentFilterQuery();
  updateExportLink();

  const [summaryResponse, ordersResponse] = await Promise.all([
    api(`/api/admin/reports/summary${query ? "?" + query : ""}`),
    api(`/api/admin/orders${query ? "?" + query : ""}`)
  ]);

  if (!summaryResponse.ok || !ordersResponse.ok) {
    showError(adminError, "Could not load orders.");
    return;
  }
  hideError(adminError);

  const summary = await summaryResponse.json();
  summaryRevenue.textContent = formatPrice(summary.total_revenue);
  summaryCount.textContent = summary.order_count;
  summaryTopProducts.innerHTML = summary.topProducts.length
    ? summary.topProducts
        .map((p) => `<li>${p.product_name} <span>${p.quantity} sold · ${formatPrice(p.revenue)}</span></li>`)
        .join("")
    : "<li>No sales yet.</li>";

  const orders = await ordersResponse.json();
  ordersTableBody.innerHTML = orders.length
    ? orders
        .map(
          (o) => `
            <tr>
              <td>${new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td>${o.customer_name}<br><span class="admin-hint">${o.customer_phone}</span></td>
              <td>${o.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}</td>
              <td>${formatPrice(o.total)}</td>
              <td><span class="admin-badge ${o.payment_status === "paid" ? "on" : ""}">${o.payment_status}</span></td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="5">No orders in this range yet.</td></tr>`;
}

reportFilterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadOrders();
});

checkSession();
