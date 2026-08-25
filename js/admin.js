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
const productCategory = document.getElementById("productCategory");
const categoryOptions = document.getElementById("categoryOptions");
const productImage = document.getElementById("productImage");
const productImagePreview = document.getElementById("productImagePreview");

const PLACEHOLDER_SWATCHES = {
  "ph-1": "#cfb99e", "ph-2": "#b9c0a6", "ph-3": "#d6c2a8",
  "ph-4": "#c99b85", "ph-5": "#a9a3b3", "ph-6": "#a9b596"
};

function updateImagePreview() {
  const value = productImage.value.trim();
  if (!value) {
    productImagePreview.hidden = true;
    productImagePreview.innerHTML = "";
    return;
  }

  productImagePreview.hidden = false;
  if (PLACEHOLDER_SWATCHES[value]) {
    productImagePreview.innerHTML = `<span class="preview-fallback" style="width:100%;height:100%;display:grid;place-items:center;background:${PLACEHOLDER_SWATCHES[value]};color:#fff;">Placeholder: ${value}</span>`;
  } else {
    productImagePreview.innerHTML = `<img src="${value}" alt="Preview" onerror="this.replaceWith(Object.assign(document.createElement('span'), {className: 'preview-fallback', textContent: 'Image could not be loaded from this URL.'}))">`;
  }
}

productImage.addEventListener("input", updateImagePreview);

const dashboardTitle = document.getElementById("dashboardTitle");
const tabProducts = document.getElementById("tabProducts");
const tabOrders = document.getElementById("tabOrders");
const tabPromo = document.getElementById("tabPromo");
const tabReviews = document.getElementById("tabReviews");
const tabCustomOrders = document.getElementById("tabCustomOrders");
const tabAnalytics = document.getElementById("tabAnalytics");
const productsPanel = document.getElementById("productsPanel");
const ordersPanel = document.getElementById("ordersPanel");
const promoPanel = document.getElementById("promoPanel");
const reviewsPanel = document.getElementById("reviewsPanel");
const customOrdersPanel = document.getElementById("customOrdersPanel");
const analyticsPanel = document.getElementById("analyticsPanel");
const reportFilterForm = document.getElementById("reportFilterForm");
const filterFrom = document.getElementById("filterFrom");
const filterTo = document.getElementById("filterTo");
const filterStatus = document.getElementById("filterStatus");
const exportCsvLink = document.getElementById("exportCsvLink");
const summaryRevenue = document.getElementById("summaryRevenue");
const summaryCount = document.getElementById("summaryCount");
const summaryTopProducts = document.getElementById("summaryTopProducts");
const ordersTableBody = document.getElementById("ordersTableBody");
const productSearch = document.getElementById("productSearch");
const orderSearch = document.getElementById("orderSearch");
const productStock = document.getElementById("productStock");
const toggleDeletedOrders = document.getElementById("toggleDeletedOrders");
const deletedOrdersHint = document.getElementById("deletedOrdersHint");

let allProducts = [];
let allOrders = [];
let viewingDeletedOrders = false;

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
  allProducts = products;

  const term = productSearch.value.trim().toLowerCase();
  const visible = term
    ? products.filter((p) => p.name.toLowerCase().includes(term) || (p.category || "").toLowerCase().includes(term))
    : products;

  productsTableBody.innerHTML = visible.length
    ? visible
        .map(
          (p) => `
        <tr data-id="${p.id}">
          <td>${p.name}</td>
          <td>${p.category || "—"}</td>
          <td>₹${p.price}</td>
          <td>${p.discount_percent > 0 ? p.discount_percent + "%" : "—"}</td>
          <td>${p.stock_quantity === null ? "Unlimited" : `<span class="admin-badge ${p.stock_quantity > 0 ? "on" : ""}">${p.stock_quantity}</span>`}</td>
          <td><span class="admin-badge ${p.featured ? "on" : ""}">${p.featured ? "Featured" : "No"}</span></td>
          <td><span class="admin-badge ${p.active ? "on" : ""}">${p.active ? "Active" : "Hidden"}</span></td>
          <td class="admin-row-actions">
            <button class="link-button" data-action="edit">Edit</button>
            <button class="link-button" data-action="delete">Delete</button>
          </td>
        </tr>
      `
        )
        .join("")
    : `<tr><td colspan="8">No products match your search.</td></tr>`;

  productsTableBody.dataset.products = JSON.stringify(products);

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  categoryOptions.innerHTML = categories.map((c) => `<option value="${c}"></option>`).join("");
}

productSearch.addEventListener("input", () => renderProducts(allProducts));

const productAdditionalImages = document.getElementById("productAdditionalImages");
const addProductImageButton = document.getElementById("addProductImageButton");

function addProductImageRow(value = "") {
  const row = document.createElement("div");
  row.className = "manual-order-item";
  row.innerHTML = `
    <input type="text" class="product-additional-image-input" placeholder="images/example-2.jpg" value="${value}">
    <button type="button" aria-label="Remove image">×</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  productAdditionalImages.appendChild(row);
}

addProductImageButton.addEventListener("click", () => addProductImageRow());

function openProductModal(product) {
  productForm.reset();
  document.getElementById("productId").value = product ? product.id : "";
  document.getElementById("productName").value = product ? product.name : "";
  document.getElementById("productDescription").value = product ? product.description : "";
  productCategory.value = product ? product.category : "";
  document.getElementById("productPrice").value = product ? product.price : "";
  document.getElementById("productDiscount").value = product ? product.discount_percent : 0;
  productStock.value = product && product.stock_quantity !== null ? product.stock_quantity : "";
  document.getElementById("productDimensions").value = product ? product.dimensions || "" : "";
  productImage.value = product ? product.image_url : "";
  document.getElementById("productFeatured").checked = product ? product.featured : false;
  document.getElementById("productActive").checked = product ? product.active : true;
  productModalTitle.textContent = product ? "Edit product" : "Add product";

  productAdditionalImages.innerHTML = "";
  (product && product.additional_images ? product.additional_images : []).forEach((url) => addProductImageRow(url));

  productModal.hidden = false;
  updateImagePreview();
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
    category: productCategory.value.trim(),
    price: Number(document.getElementById("productPrice").value),
    discount_percent: Number(document.getElementById("productDiscount").value) || 0,
    stock_quantity: productStock.value.trim() === "" ? null : Number(productStock.value),
    dimensions: document.getElementById("productDimensions").value.trim(),
    image_url: productImage.value.trim(),
    additional_images: [...productAdditionalImages.querySelectorAll(".product-additional-image-input")]
      .map((input) => input.value.trim())
      .filter(Boolean),
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
  if (filterStatus.value) params.set("status", filterStatus.value);
  return params.toString();
}

function updateExportLink() {
  const query = currentFilterQuery();
  exportCsvLink.href = `${API_BASE}/api/admin/reports/export.csv${query ? "?" + query : ""}`;
}

function switchTab(tab) {
  tabProducts.classList.toggle("active", tab === "products");
  tabOrders.classList.toggle("active", tab === "orders");
  tabPromo.classList.toggle("active", tab === "promo");
  tabReviews.classList.toggle("active", tab === "reviews");
  tabCustomOrders.classList.toggle("active", tab === "customOrders");
  tabAnalytics.classList.toggle("active", tab === "analytics");
  productsPanel.hidden = tab !== "products";
  ordersPanel.hidden = tab !== "orders";
  promoPanel.hidden = tab !== "promo";
  reviewsPanel.hidden = tab !== "reviews";
  customOrdersPanel.hidden = tab !== "customOrders";
  analyticsPanel.hidden = tab !== "analytics";
  dashboardTitle.textContent =
    tab === "orders" ? "Orders & Sales" : tab === "promo" ? "Promo Codes" : tab === "reviews" ? "Reviews" : tab === "customOrders" ? "Custom Orders" : tab === "analytics" ? "Analytics" : "Products";

  if (tab === "orders") loadOrders();
  if (tab === "promo") loadPromoCodes();
  if (tab === "reviews") loadReviews();
  if (tab === "customOrders") loadCustomOrders();
  if (tab === "analytics") loadAnalytics();
}

tabProducts.addEventListener("click", () => switchTab("products"));
tabOrders.addEventListener("click", () => switchTab("orders"));
tabPromo.addEventListener("click", () => switchTab("promo"));
tabReviews.addEventListener("click", () => switchTab("reviews"));
tabCustomOrders.addEventListener("click", () => switchTab("customOrders"));
tabAnalytics.addEventListener("click", () => switchTab("analytics"));

async function loadOrders() {
  const query = currentFilterQuery();
  updateExportLink();

  const ordersQuery = new URLSearchParams(query);
  if (viewingDeletedOrders) ordersQuery.set("deleted", "true");

  const [summaryResponse, ordersResponse] = await Promise.all([
    api(`/api/admin/reports/summary${query ? "?" + query : ""}`),
    api(`/api/admin/orders?${ordersQuery.toString()}`)
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

  const ORDER_STATUSES = ["new", "confirmed", "shipped", "completed", "cancelled"];

  allOrders = await ordersResponse.json();
  renderOrders();
}

function purgeDeadlineLabel(deletedAt) {
  const deadline = new Date(new Date(deletedAt).getTime() + 48 * 60 * 60 * 1000);
  return deadline.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function renderOrders() {
  const ORDER_STATUSES = ["new", "confirmed", "shipped", "completed", "cancelled"];
  const term = orderSearch.value.trim().toLowerCase();
  const orders = term
    ? allOrders.filter((o) =>
        o.customer_name.toLowerCase().includes(term) ||
        o.customer_phone.toLowerCase().includes(term) ||
        o.customer_email.toLowerCase().includes(term) ||
        o.orderRef.toLowerCase().includes(term)
      )
    : allOrders;

  ordersTableBody.innerHTML = orders.length
    ? orders
        .map(
          (o) => `
            <tr data-id="${o.id}">
              <td>${o.orderRef}</td>
              <td>${new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td class="wrap-cell">${o.customer_name}<br><span class="admin-hint">${o.customer_email}<br>${o.customer_phone}${o.ip_address ? `<br>IP: ${o.ip_address}` : ""}</span></td>
              <td class="wrap-cell">${o.items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")}</td>
              <td>${formatPrice(o.total)}</td>
              <td><span class="admin-badge ${o.payment_status === "paid" ? "on" : ""}">${o.payment_status}</span></td>
              <td>${o.payment_method || "—"}</td>
              <td>
                <select class="order-status-select" data-id="${o.id}">
                  ${ORDER_STATUSES.map((s) => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </td>
              <td>${o.delivery_date ? new Date(o.delivery_date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—"}</td>
              <td>${o.tracking_number || "—"}</td>
              <td class="wrap-cell-sm">${o.refund_amount > 0 ? `${formatPrice(o.refund_amount)}${o.refund_note ? `<br><span class="admin-hint">${o.refund_note}</span>` : ""}` : "—"}</td>
              <td><button class="link-button" data-action="notes" data-id="${o.id}">${o.admin_notes ? "Edit notes" : "Add notes"}</button></td>
              <td class="${viewingDeletedOrders ? "wrap-cell-sm" : ""}">${
                viewingDeletedOrders
                  ? `<button class="link-button" data-action="restore-order" data-id="${o.id}">Restore</button>
                     <label class="admin-hint" style="display:block; margin-top:4px; cursor:pointer;">
                       <input type="checkbox" data-action="toggle-purge-protect" data-id="${o.id}" ${o.purge_protected ? "checked" : ""}> Keep
                     </label>
                     <span class="admin-hint">${o.purge_protected ? "Won't auto-delete" : `Auto-deletes ${purgeDeadlineLabel(o.deleted_at)}`}</span>`
                  : `<button class="link-button" data-action="delete-order" data-id="${o.id}" data-ref="${o.orderRef}">Delete</button>`
              }</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="13">${viewingDeletedOrders ? "No deleted orders." : "No orders match."}</td></tr>`;
}

orderSearch.addEventListener("input", renderOrders);

toggleDeletedOrders.addEventListener("click", () => {
  viewingDeletedOrders = !viewingDeletedOrders;
  toggleDeletedOrders.textContent = viewingDeletedOrders ? "Back to active orders" : "View deleted";
  newOrderButton.hidden = viewingDeletedOrders;
  deletedOrdersHint.hidden = !viewingDeletedOrders;
  loadOrders();
});

ordersTableBody.addEventListener("change", async (event) => {
  const purgeCheckbox = event.target.closest("input[data-action='toggle-purge-protect']");
  if (purgeCheckbox) {
    const response = await api(`/api/admin/orders/${purgeCheckbox.dataset.id}/purge-protection`, {
      method: "PUT",
      body: JSON.stringify({ protect: purgeCheckbox.checked })
    });
    if (!response.ok) {
      showError(adminError, "Could not update that setting.");
      purgeCheckbox.checked = !purgeCheckbox.checked;
      return;
    }
    hideError(adminError);
    showToast(purgeCheckbox.checked ? "Order kept — it won't auto-delete." : "Order will auto-delete on the normal schedule.");
    loadOrders();
    return;
  }

  const select = event.target.closest(".order-status-select");
  if (!select) return;

  const id = select.dataset.id;
  const status = select.value;
  let tracking_number = "";
  let refund_amount = 0;
  let refund_note = "";

  if (status === "shipped") {
    tracking_number = (prompt("Enter the tracking/shipping number for this order:") || "").trim();
    if (!tracking_number) {
      showToast("Tracking number is required to mark an order as shipped.");
      loadOrders();
      return;
    }
  }

  if (status === "cancelled") {
    const amountInput = prompt("Refund amount for this cancelled order (₹, leave blank or 0 if none):", "0");
    if (amountInput === null) {
      loadOrders();
      return;
    }
    refund_amount = Number(amountInput) || 0;
    if (refund_amount > 0) {
      refund_note = (prompt("Optional note about the refund (e.g. method, reference):") || "").trim();
    }
  }

  const response = await api(`/api/admin/orders/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, tracking_number, refund_amount, refund_note })
  });

  if (!response.ok) {
    showError(adminError, "Could not update order status.");
    loadOrders();
    return;
  }

  hideError(adminError);
  showToast(`Order marked as ${status}. Customer notified by email.`);
  loadOrders();
});

reportFilterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadOrders();
});

/* ---------------------------- Internal order notes ---------------------------- */
const notesModal = document.getElementById("notesModal");
const notesModalOverlay = document.getElementById("notesModalOverlay");
const notesForm = document.getElementById("notesForm");
const notesOrderId = document.getElementById("notesOrderId");
const notesText = document.getElementById("notesText");
const cancelNotesButton = document.getElementById("cancelNotesButton");

ordersTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action='notes']");
  if (!button) return;

  const order = allOrders.find((o) => String(o.id) === button.dataset.id);
  notesOrderId.value = order.id;
  notesText.value = order.admin_notes || "";
  notesModal.hidden = false;
});

function closeNotesModal() {
  notesModal.hidden = true;
}
cancelNotesButton.addEventListener("click", closeNotesModal);
notesModalOverlay.addEventListener("click", closeNotesModal);

notesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await api(`/api/admin/orders/${notesOrderId.value}/notes`, {
    method: "PUT",
    body: JSON.stringify({ admin_notes: notesText.value.trim() })
  });

  if (!response.ok) {
    showError(adminError, "Could not save notes.");
    return;
  }
  hideError(adminError);
  closeNotesModal();
  showToast("Notes saved.");
  loadOrders();
});

/* ---------------------------- Delete / restore orders ---------------------------- */
const deleteOrderModal = document.getElementById("deleteOrderModal");
const deleteOrderModalOverlay = document.getElementById("deleteOrderModalOverlay");
const deleteOrderForm = document.getElementById("deleteOrderForm");
const deleteOrderId = document.getElementById("deleteOrderId");
const deleteOrderRefLabel = document.getElementById("deleteOrderRefLabel");
const deleteOrderConfirmInput = document.getElementById("deleteOrderConfirmInput");
const deleteOrderError = document.getElementById("deleteOrderError");
const confirmDeleteOrderButton = document.getElementById("confirmDeleteOrderButton");
const cancelDeleteOrderButton = document.getElementById("cancelDeleteOrderButton");

function openDeleteOrderModal(id, ref) {
  deleteOrderForm.reset();
  hideError(deleteOrderError);
  confirmDeleteOrderButton.disabled = true;
  deleteOrderId.value = id;
  deleteOrderId.dataset.ref = ref;
  deleteOrderRefLabel.textContent = ref;
  deleteOrderModal.hidden = false;
  deleteOrderConfirmInput.focus();
}

function closeDeleteOrderModal() {
  deleteOrderModal.hidden = true;
}
cancelDeleteOrderButton.addEventListener("click", closeDeleteOrderModal);
deleteOrderModalOverlay.addEventListener("click", closeDeleteOrderModal);

deleteOrderConfirmInput.addEventListener("input", () => {
  const expected = deleteOrderId.dataset.ref || "";
  confirmDeleteOrderButton.disabled = deleteOrderConfirmInput.value.trim().toUpperCase() !== expected;
});

deleteOrderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await api(`/api/admin/orders/${deleteOrderId.value}`, {
    method: "DELETE",
    body: JSON.stringify({ confirm: deleteOrderConfirmInput.value.trim() })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    showError(deleteOrderError, body.error || "Could not delete that order.");
    return;
  }
  closeDeleteOrderModal();
  hideError(adminError);
  showToast(`${deleteOrderId.dataset.ref} deleted. You can restore it from "View deleted".`);
  loadOrders();
});

ordersTableBody.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("button[data-action='delete-order']");
  if (deleteButton) {
    openDeleteOrderModal(deleteButton.dataset.id, deleteButton.dataset.ref);
    return;
  }

  const restoreButton = event.target.closest("button[data-action='restore-order']");
  if (!restoreButton) return;

  const response = await api(`/api/admin/orders/${restoreButton.dataset.id}/restore`, { method: "POST" });
  if (!response.ok) {
    showError(adminError, "Could not restore that order.");
    return;
  }
  hideError(adminError);
  showToast("Order restored.");
  loadOrders();
});

/* ---------------------------- Manual order entry ---------------------------- */
const newOrderButton = document.getElementById("newOrderButton");
const orderModal = document.getElementById("orderModal");
const orderModalOverlay = document.getElementById("orderModalOverlay");
const orderForm = document.getElementById("orderForm");
const cancelOrderButton = document.getElementById("cancelOrderButton");
const manualOrderItems = document.getElementById("manualOrderItems");
const addOrderItemButton = document.getElementById("addOrderItemButton");
const manualOrderTotal = document.getElementById("manualOrderTotal");

function addManualOrderItemRow() {
  const row = document.createElement("div");
  row.className = "manual-order-item";
  row.innerHTML = `
    <select class="manual-item-product">
      ${allProducts.filter((p) => p.active).map((p) => `<option value="${p.id}" data-price="${p.price}" data-discount="${p.discount_percent}">${p.name} — ₹${p.price}</option>`).join("")}
    </select>
    <input type="number" class="manual-item-qty" min="1" value="1">
    <button type="button" aria-label="Remove item">×</button>
  `;
  row.querySelector("button").addEventListener("click", () => {
    row.remove();
    updateManualOrderTotal();
  });
  row.querySelector(".manual-item-product").addEventListener("change", updateManualOrderTotal);
  row.querySelector(".manual-item-qty").addEventListener("input", updateManualOrderTotal);
  manualOrderItems.appendChild(row);
  updateManualOrderTotal();
}

function updateManualOrderTotal() {
  let total = 0;
  manualOrderItems.querySelectorAll(".manual-order-item").forEach((row) => {
    const select = row.querySelector(".manual-item-product");
    const option = select.options[select.selectedIndex];
    if (!option) return;
    const price = Number(option.dataset.price);
    const discount = Number(option.dataset.discount);
    const qty = Number(row.querySelector(".manual-item-qty").value) || 1;
    total += Math.round(price * (1 - discount / 100)) * qty;
  });
  manualOrderTotal.textContent = `Total: ${formatPrice(total)}`;
}

addOrderItemButton.addEventListener("click", addManualOrderItemRow);

newOrderButton.addEventListener("click", () => {
  orderForm.reset();
  manualOrderItems.innerHTML = "";
  addManualOrderItemRow();
  orderModal.hidden = false;
});

function closeOrderModal() {
  orderModal.hidden = true;
}
cancelOrderButton.addEventListener("click", closeOrderModal);
orderModalOverlay.addEventListener("click", closeOrderModal);

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const items = [...manualOrderItems.querySelectorAll(".manual-order-item")].map((row) => ({
    id: Number(row.querySelector(".manual-item-product").value),
    quantity: Number(row.querySelector(".manual-item-qty").value) || 1
  }));

  if (!items.length) {
    showToast("Add at least one item to the order.");
    return;
  }

  const payload = {
    customer_name: document.getElementById("orderName").value.trim(),
    customer_phone: document.getElementById("orderPhone").value.trim(),
    customer_email: document.getElementById("orderEmail").value.trim(),
    delivery_address: document.getElementById("orderAddress").value.trim(),
    delivery_date: document.getElementById("orderDeliveryDate").value || null,
    notes: document.getElementById("orderCustomerNotes").value.trim(),
    payment_status: document.getElementById("orderPaymentStatus").value,
    items
  };

  const response = await api("/api/admin/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    showError(adminError, body.error || "Could not create order.");
    return;
  }

  hideError(adminError);
  closeOrderModal();
  showToast("Order created.");
  loadOrders();
});

/* ---------------------------- Promo codes ---------------------------- */
const promoTableBody = document.getElementById("promoTableBody");
const newPromoButton = document.getElementById("newPromoButton");
const promoModal = document.getElementById("promoModal");
const promoModalOverlay = document.getElementById("promoModalOverlay");
const promoModalTitle = document.getElementById("promoModalTitle");
const promoForm = document.getElementById("promoForm");
const cancelPromoButton = document.getElementById("cancelPromoButton");

async function loadPromoCodes() {
  const response = await api("/api/admin/promo-codes");
  if (!response.ok) {
    showError(adminError, "Could not load promo codes.");
    return;
  }
  hideError(adminError);
  const codes = await response.json();

  promoTableBody.innerHTML = codes.length
    ? codes
        .map((c) => {
          const discountLabel = c.discount_type === "flat" ? `₹${c.discount_value} off` : `${c.discount_value}% off`;
          const usesLabel = c.max_uses ? `${c.used_count} / ${c.max_uses}` : `${c.used_count} / ∞`;
          const expiryLabel = c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-IN") : "Never";
          return `
            <tr data-id="${c.id}">
              <td>${c.code}</td>
              <td>${discountLabel}</td>
              <td>${usesLabel}</td>
              <td>${expiryLabel}</td>
              <td><span class="admin-badge ${c.active ? "on" : ""}">${c.active ? "Active" : "Inactive"}</span></td>
              <td class="admin-row-actions">
                <button class="link-button" data-action="edit">Edit</button>
                <button class="link-button" data-action="delete">Delete</button>
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6">No promo codes yet.</td></tr>`;

  promoTableBody.dataset.codes = JSON.stringify(codes);
}

function openPromoModal(promo) {
  promoForm.reset();
  document.getElementById("promoId").value = promo ? promo.id : "";
  document.getElementById("promoCode").value = promo ? promo.code : "";
  document.getElementById("promoType").value = promo ? promo.discount_type : "percent";
  document.getElementById("promoValue").value = promo ? promo.discount_value : "";
  document.getElementById("promoMaxUses").value = promo && promo.max_uses ? promo.max_uses : "";
  document.getElementById("promoExpiry").value = promo && promo.expires_at ? promo.expires_at.slice(0, 10) : "";
  document.getElementById("promoActive").checked = promo ? promo.active : true;
  promoModalTitle.textContent = promo ? "Edit promo code" : "Add promo code";
  promoModal.hidden = false;
}

function closePromoModal() {
  promoModal.hidden = true;
}

newPromoButton.addEventListener("click", () => openPromoModal(null));
cancelPromoButton.addEventListener("click", closePromoModal);
promoModalOverlay.addEventListener("click", closePromoModal);

promoTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const row = button.closest("tr");
  const id = row.dataset.id;
  const codes = JSON.parse(promoTableBody.dataset.codes || "[]");
  const promo = codes.find((c) => String(c.id) === id);

  if (button.dataset.action === "edit") {
    openPromoModal(promo);
  } else if (button.dataset.action === "delete") {
    deletePromoCode(id, promo.code);
  }
});

async function deletePromoCode(id, code) {
  if (!confirm(`Delete promo code "${code}"? This can't be undone.`)) return;

  const response = await api(`/api/admin/promo-codes/${id}`, { method: "DELETE" });
  if (!response.ok) {
    showError(adminError, "Could not delete that promo code.");
    return;
  }
  hideError(adminError);
  showToast(`${code} deleted.`);
  loadPromoCodes();
}

promoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideError(adminError);

  const id = document.getElementById("promoId").value;
  const expiry = document.getElementById("promoExpiry").value;
  const payload = {
    code: document.getElementById("promoCode").value.trim(),
    discount_type: document.getElementById("promoType").value,
    discount_value: Number(document.getElementById("promoValue").value),
    max_uses: document.getElementById("promoMaxUses").value ? Number(document.getElementById("promoMaxUses").value) : null,
    expires_at: expiry ? new Date(`${expiry}T23:59:59`).toISOString() : null,
    active: document.getElementById("promoActive").checked
  };

  const response = await api(id ? `/api/admin/promo-codes/${id}` : "/api/admin/promo-codes", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    showError(adminError, body.error || "Could not save that promo code.");
    return;
  }

  closePromoModal();
  showToast(id ? "Promo code updated." : "Promo code created.");
  loadPromoCodes();
});

/* ---------------------------- Reviews ---------------------------- */
const reviewsTableBody = document.getElementById("reviewsTableBody");

function starString(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

async function loadReviews() {
  const response = await api("/api/admin/reviews");
  if (!response.ok) {
    showError(adminError, "Could not load reviews.");
    return;
  }
  hideError(adminError);
  const reviews = await response.json();

  reviewsTableBody.innerHTML = reviews.length
    ? reviews
        .map((r) => {
          const actions = [];
          if (r.status !== "approved") actions.push(`<button class="link-button" data-action="approved" data-id="${r.id}">Approve</button>`);
          if (r.status !== "rejected") actions.push(`<button class="link-button" data-action="rejected" data-id="${r.id}">Reject</button>`);
          if (r.status === "approved") actions.push(`<button class="link-button" data-action="pending" data-id="${r.id}">Unpublish</button>`);
          actions.push(`<button class="link-button" data-action="delete" data-id="${r.id}">Delete</button>`);

          return `
            <tr>
              <td>${r.product_name}</td>
              <td>${r.customer_name}<br><span class="admin-hint">${r.customer_email}${r.ip_address ? `<br>IP: ${r.ip_address}` : ""}</span></td>
              <td>${starString(r.rating)}</td>
              <td class="wrap-cell">${r.review_text}</td>
              <td><span class="admin-badge ${r.status === "approved" ? "on" : ""}">${r.status}</span></td>
              <td class="admin-row-actions">${actions.join("")}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6">No reviews yet.</td></tr>`;
}

reviewsTableBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  if (button.dataset.action === "delete") {
    if (!confirm("Delete this review? This can't be undone.")) return;

    const response = await api(`/api/admin/reviews/${button.dataset.id}`, { method: "DELETE" });
    if (!response.ok) {
      showError(adminError, "Could not delete that review.");
      return;
    }
    hideError(adminError);
    showToast("Review deleted.");
    loadReviews();
    return;
  }

  const response = await api(`/api/admin/reviews/${button.dataset.id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status: button.dataset.action })
  });

  if (!response.ok) {
    showError(adminError, "Could not update that review.");
    return;
  }
  hideError(adminError);
  showToast("Review updated.");
  loadReviews();
});

/* ---------------------------- Custom Orders ---------------------------- */
const customOrdersTableBody = document.getElementById("customOrdersTableBody");
const CUSTOM_ORDER_STATUSES = ["new", "contacted", "completed"];
const toggleDeletedCustomOrders = document.getElementById("toggleDeletedCustomOrders");
const deletedCustomOrdersHint = document.getElementById("deletedCustomOrdersHint");
let viewingDeletedCustomOrders = false;
let allCustomOrders = [];

async function loadCustomOrders() {
  const response = await api(`/api/admin/custom-orders${viewingDeletedCustomOrders ? "?deleted=true" : ""}`);
  if (!response.ok) {
    showError(adminError, "Could not load custom order requests.");
    return;
  }
  hideError(adminError);
  allCustomOrders = await response.json();
  renderCustomOrders();
}

function renderCustomOrders() {
  const requests = allCustomOrders;

  customOrdersTableBody.innerHTML = requests.length
    ? requests
        .map(
          (r) => `
            <tr data-id="${r.id}">
              <td>${new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td class="wrap-cell">${r.customer_name}<br><span class="admin-hint">${r.customer_email}<br>${r.customer_phone}${r.ip_address ? `<br>IP: ${r.ip_address}` : ""}</span></td>
              <td>${r.occasion || "—"}</td>
              <td>${r.budget_range || "—"}</td>
              <td>${r.delivery_date ? new Date(r.delivery_date).toLocaleDateString("en-IN") : "—"}</td>
              <td class="wrap-cell">${r.flower_preferences || "—"}</td>
              <td class="wrap-cell">${r.notes || "—"}</td>
              <td>
                <select class="order-status-select custom-order-status-select" data-id="${r.id}" ${viewingDeletedCustomOrders ? "disabled" : ""}>
                  ${CUSTOM_ORDER_STATUSES.map((s) => `<option value="${s}" ${r.status === s ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </td>
              <td class="${viewingDeletedCustomOrders ? "wrap-cell-sm" : ""}">${
                viewingDeletedCustomOrders
                  ? `<button class="link-button" data-action="restore-custom-order" data-id="${r.id}">Restore</button>
                     <label class="admin-hint" style="display:block; margin-top:4px; cursor:pointer;">
                       <input type="checkbox" data-action="toggle-custom-order-purge-protect" data-id="${r.id}" ${r.purge_protected ? "checked" : ""}> Keep
                     </label>
                     <span class="admin-hint">${r.purge_protected ? "Won't auto-delete" : `Auto-deletes ${purgeDeadlineLabel(r.deleted_at)}`}</span>`
                  : `<button class="link-button" data-action="delete-custom-order" data-id="${r.id}">Delete</button>`
              }</td>
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="9">${viewingDeletedCustomOrders ? "No deleted requests." : "No custom order requests yet."}</td></tr>`;
}

toggleDeletedCustomOrders.addEventListener("click", () => {
  viewingDeletedCustomOrders = !viewingDeletedCustomOrders;
  toggleDeletedCustomOrders.textContent = viewingDeletedCustomOrders ? "Back to active requests" : "View deleted";
  deletedCustomOrdersHint.hidden = !viewingDeletedCustomOrders;
  loadCustomOrders();
});

customOrdersTableBody.addEventListener("change", async (event) => {
  const purgeCheckbox = event.target.closest("input[data-action='toggle-custom-order-purge-protect']");
  if (purgeCheckbox) {
    const response = await api(`/api/admin/custom-orders/${purgeCheckbox.dataset.id}/purge-protection`, {
      method: "PUT",
      body: JSON.stringify({ protect: purgeCheckbox.checked })
    });
    if (!response.ok) {
      showError(adminError, "Could not update that setting.");
      purgeCheckbox.checked = !purgeCheckbox.checked;
      return;
    }
    hideError(adminError);
    showToast(purgeCheckbox.checked ? "Request kept — it won't auto-delete." : "Request will auto-delete on the normal schedule.");
    loadCustomOrders();
    return;
  }

  const select = event.target.closest(".custom-order-status-select");
  if (!select) return;

  const response = await api(`/api/admin/custom-orders/${select.dataset.id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status: select.value })
  });

  if (!response.ok) {
    showError(adminError, "Could not update that request.");
    return;
  }
  hideError(adminError);
  showToast("Custom order request updated.");
});

customOrdersTableBody.addEventListener("click", async (event) => {
  const deleteButton = event.target.closest("button[data-action='delete-custom-order']");
  if (deleteButton) {
    if (!confirm("Delete this custom order request? It moves to \"View deleted\" and is permanently removed after 48 hours unless kept.")) return;

    const response = await api(`/api/admin/custom-orders/${deleteButton.dataset.id}`, { method: "DELETE" });
    if (!response.ok) {
      showError(adminError, "Could not delete that request.");
      return;
    }
    hideError(adminError);
    showToast("Request deleted.");
    loadCustomOrders();
    return;
  }

  const restoreButton = event.target.closest("button[data-action='restore-custom-order']");
  if (!restoreButton) return;

  const response = await api(`/api/admin/custom-orders/${restoreButton.dataset.id}/restore`, { method: "POST" });
  if (!response.ok) {
    showError(adminError, "Could not restore that request.");
    return;
  }
  hideError(adminError);
  showToast("Request restored.");
  loadCustomOrders();
});

/* ---------------------------- Analytics ---------------------------- */
const analyticsUsers = document.getElementById("analyticsUsers");
const analyticsSessions = document.getElementById("analyticsSessions");
const analyticsPageViews = document.getElementById("analyticsPageViews");
const analyticsTopPagesBody = document.getElementById("analyticsTopPagesBody");

async function loadAnalytics() {
  analyticsUsers.textContent = "—";
  analyticsSessions.textContent = "—";
  analyticsPageViews.textContent = "—";
  analyticsTopPagesBody.innerHTML = `<tr><td colspan="2">Loading…</td></tr>`;

  const response = await api("/api/admin/analytics/summary");
  if (!response.ok) {
    showError(adminError, "Could not load analytics right now. Check the server's Google Analytics setup.");
    analyticsTopPagesBody.innerHTML = `<tr><td colspan="2">Could not load analytics.</td></tr>`;
    return;
  }
  hideError(adminError);

  const data = await response.json();
  analyticsUsers.textContent = data.activeUsers7d;
  analyticsSessions.textContent = data.sessions7d;
  analyticsPageViews.textContent = data.pageViews7d;

  analyticsTopPagesBody.innerHTML = data.topPages.length
    ? data.topPages.map((p) => `<tr><td>${p.title}</td><td>${p.views}</td></tr>`).join("")
    : `<tr><td colspan="2">No traffic recorded yet.</td></tr>`;
}

checkSession();
