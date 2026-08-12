/* ---------------------------------------------------------------------
   Scroll-reveal: fades + lifts sections into view as the user scrolls.
   Respects prefers-reduced-motion by revealing everything immediately.
--------------------------------------------------------------------- */
(function initScrollReveal() {
  const revealEls = document.querySelectorAll(".reveal");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!revealEls.length) return;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(el => el.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });

  revealEls.forEach(el => observer.observe(el));
})();

const cart = [];

const cartButton = document.getElementById("cartButton");
const cartPanel = document.getElementById("cartPanel");
const cartOverlay = document.getElementById("cartOverlay");
const closeCart = document.getElementById("closeCart");
const cartView = document.getElementById("cartView");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const toast = document.getElementById("toast");
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
const checkoutFormView = document.getElementById("checkoutFormView");
const checkoutTotal = document.getElementById("checkoutTotal");
const orderConfirmationView = document.getElementById("orderConfirmationView");
const placeOrderButton = document.getElementById("placeOrderButton");

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function renderCart() {
  cartCount.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (!cart.length) {
    cartItems.innerHTML = '<p class="empty-cart">Your cart is waiting for something beautiful.</p>';
    cartTotal.textContent = "₹0";
    return;
  }

  cartItems.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <div>
        <h3>${item.name}</h3>
        <small>${formatPrice(item.price)} × ${item.quantity}</small>
      </div>
      <button class="remove-item" data-index="${index}">Remove</button>
    </div>
  `).join("");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartTotal.textContent = formatPrice(total);

  document.querySelectorAll(".remove-item").forEach(button => {
    button.addEventListener("click", () => {
      cart.splice(Number(button.dataset.index), 1);
      renderCart();
    });
  });
}

function openCart() {
  cartPanel.classList.add("open");
  cartPanel.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  closeCart.focus();
}

function closeCartDrawer() {
  cartPanel.classList.remove("open");
  cartPanel.setAttribute("aria-hidden", "true");
  showCartView();
  document.body.style.overflow = "";
  cartButton.focus();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".add-cart");
  if (!button) return;

  const id = Number(button.dataset.id);
  const name = button.dataset.product;
  const price = Number(button.dataset.price);
  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ id, name, price, quantity: 1 });
  }

  renderCart();
  showToast(`${name} added to your cart.`);
});

cartButton.addEventListener("click", openCart);
closeCart.addEventListener("click", closeCartDrawer);
cartOverlay.addEventListener("click", closeCartDrawer);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cartPanel.classList.contains("open")) {
    closeCartDrawer();
  }
});

function showCartView() {
  cartView.hidden = false;
  checkoutFormView.hidden = true;
  orderConfirmationView.hidden = true;
}

function showCheckoutForm() {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  checkoutTotal.textContent = formatPrice(total);
  cartView.hidden = true;
  checkoutFormView.hidden = false;
  orderConfirmationView.hidden = true;
}

function showOrderConfirmation() {
  cartView.hidden = true;
  checkoutFormView.hidden = true;
  orderConfirmationView.hidden = false;
}

document.getElementById("checkoutButton").addEventListener("click", () => {
  if (!cart.length) {
    showToast("Your cart is empty.");
    return;
  }
  showCheckoutForm();
});

document.getElementById("backToCart").addEventListener("click", showCartView);

document.getElementById("continueShoppingButton").addEventListener("click", () => {
  closeCartDrawer();
  showCartView();
});

checkoutFormView.addEventListener("submit", async (event) => {
  event.preventDefault();
  placeOrderButton.disabled = true;

  const payload = {
    customer_name: document.getElementById("checkoutName").value.trim(),
    customer_phone: document.getElementById("checkoutPhone").value.trim(),
    customer_email: document.getElementById("checkoutEmail").value.trim(),
    delivery_address: document.getElementById("checkoutAddress").value.trim(),
    notes: document.getElementById("checkoutNotes").value.trim(),
    items: cart.map(item => ({ id: item.id, quantity: item.quantity }))
  };

  try {
    const response = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error("Order failed");

    cart.length = 0;
    renderCart();
    checkoutFormView.reset();
    showOrderConfirmation();
  } catch {
    showToast("Something went wrong placing your order. Please try again.");
  } finally {
    placeOrderButton.disabled = false;
  }
});

function closeMobileNav() {
  mainNav.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open menu");
  document.body.style.overflow = "";
}

menuToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", open);
  menuToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  document.body.style.overflow = open ? "hidden" : "";
});

document.querySelectorAll(".main-nav a").forEach(link => {
  link.addEventListener("click", closeMobileNav);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mainNav.classList.contains("open")) {
    closeMobileNav();
  }
});

const contactForm = document.getElementById("contactForm");
if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      });

      if (response.ok) {
        showToast("Thank you! Your enquiry has been sent.");
        form.reset();
      } else {
        showToast("Something went wrong. Please email us directly.");
      }
    } catch {
      showToast("Something went wrong. Please email us directly.");
    } finally {
      submitButton.disabled = false;
    }
  });
}

renderCart();