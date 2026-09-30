import { apiUrl, parseJson } from '../lib/api.js';
import { escapeHtml } from '../lib/html.js';

const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('.primary-nav');
const searchInput = document.querySelector('#shop-search');

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const productGrid = document.querySelector('#product-grid');
const shopEmpty = document.querySelector('#shop-empty');
const shopFilters = document.querySelector('#shop-filters');
const cartCount = document.querySelector('#cart-count');
const cartTotal = document.querySelector('#cart-total');
const cartClear = document.querySelector('#cart-clear');
const cartRequest = document.querySelector('#cart-request');

const cart = new Map();
const CART_KEY = 'idea-house-cart';
let visibleProducts = [];
let categories = ['All'];
let activeCategory = categories[0];
let searchDebounce = null;

function loadStoredCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY));
    if (!stored || typeof stored !== 'object') return;
    Object.entries(stored).forEach(([id, quantity]) => {
      const qty = Number(quantity);
      if (Number.isInteger(qty) && qty > 0) cart.set(id, qty);
    });
  } catch {
    // Ignore corrupt or unavailable storage - the cart simply starts empty.
  }
}

function saveStoredCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(Object.fromEntries(cart)));
  } catch {
    // Storage unavailable - the cart stays in memory for this page only.
  }
}

loadStoredCart();

menuToggle?.addEventListener('click', () => {
  const isOpen = primaryNav.classList.toggle('is-open');
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

primaryNav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    primaryNav.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
  });
});

function mediaHtml(product) {
  if (product.image) {
    return `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`;
  }
  return `<span class="product-glyph" aria-hidden="true">${escapeHtml(product.glyph || '✳')}</span>`;
}

function controlsHtml(product) {
  const quantity = cart.get(product.id) || 0;
  if (!quantity) {
    return `<button class="product-add" type="button" data-add="${escapeHtml(product.id)}">Add to request <span aria-hidden="true">+</span></button>`;
  }
  return `
    <div class="product-qty">
      <button type="button" data-step="-1" data-id="${escapeHtml(product.id)}" aria-label="Remove one ${escapeHtml(product.name)}">−</button>
      <span>${quantity}</span>
      <button type="button" data-step="1" data-id="${escapeHtml(product.id)}" aria-label="Add one ${escapeHtml(product.name)}">+</button>
    </div>`;
}

function productCardHtml(product) {
  const tone = product.image ? 'photo' : (product.tone || 'cobalt');
  const href = `/shop/${encodeURIComponent(product.id)}`;
  return `
    <article class="product-card reveal" data-product-id="${escapeHtml(product.id)}" data-category="${escapeHtml(product.category)}">
      <a class="product-link" href="${escapeHtml(href)}" aria-label="View ${escapeHtml(product.name)}">
        <div class="product-media product-media--${escapeHtml(tone)}">
          ${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ''}
          ${mediaHtml(product)}
        </div>
      </a>
      <div class="product-body">
        <p class="product-category">${escapeHtml(product.category)}</p>
        <h3><a class="product-link" href="${escapeHtml(href)}">${escapeHtml(product.name)}</a></h3>
        <p class="product-blurb">${escapeHtml(product.blurb)}</p>
        <div class="product-footer">
          <span class="product-price">${currency.format(product.price)}</span>
          <div class="product-controls" data-controls="${escapeHtml(product.id)}">${controlsHtml(product)}</div>
        </div>
      </div>
    </article>`;
}

function cartEntries() {
  return [...cart.entries()]
    .map(([id, quantity]) => ({ product: findProduct(id), quantity }))
    .filter((entry) => entry.product);
}

function findProduct(id) {
  return visibleProducts.find((product) => product.id === id);
}

function cartTotalValue() {
  return cartEntries().reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
}

function renderCart() {
  const count = cartEntries().reduce((sum, entry) => sum + entry.quantity, 0);
  cartCount.textContent = count ? `${count} ${count === 1 ? 'item' : 'items'} in your request` : 'Your request is empty';
  cartTotal.textContent = currency.format(cartTotalValue());
  cartClear.hidden = !count;
  cartRequest.hidden = !count;
  saveStoredCart();
}

function renderControls(id) {
  const product = findProduct(id);
  const holder = productGrid?.querySelector(`[data-controls="${id}"]`);
  if (product && holder) holder.innerHTML = controlsHtml(product);
}

function renderFilters() {
  if (!shopFilters) return;
  shopFilters.innerHTML = categories.map((category) => `
    <button class="shop-filter${category === activeCategory ? ' is-active' : ''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${category === activeCategory}">${escapeHtml(category)}</button>
  `).join('');
}

function applyFilter() {
  if (!productGrid) return;
  const showEverything = activeCategory === categories[0];
  let visible = 0;
  productGrid.querySelectorAll('.product-card').forEach((card) => {
    const matches = showEverything || card.dataset.category === activeCategory;
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  if (shopEmpty) shopEmpty.hidden = visible > 0;
}

function renderShop() {
  if (!productGrid) return;
  productGrid.innerHTML = visibleProducts.map(productCardHtml).join('');
  renderFilters();
  applyFilter();
  productGrid.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
}

async function loadCatalogue() {
  try {
    const response = await fetch(apiUrl('/api/products'));
    if (!response.ok) throw new Error(response.status);
    const { products: items = [] } = await parseJson(response);
    visibleProducts = items;
    categories = ['All', ...new Set(items.map((product) => product.category))];
    activeCategory = categories[0];
  } catch {
    visibleProducts = [];
    categories = ['All'];
    activeCategory = categories[0];
  }

  renderShop();
}

async function loadProducts() {
  const query = searchInput?.value.trim() || '';
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (activeCategory !== categories[0]) params.set('category', activeCategory);
  const url = `${apiUrl('/api/products')}${params ? '?' + params : ''}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(response.status);
    const { products: items = [] } = await parseJson(response);
    visibleProducts = items;
  } catch {
    visibleProducts = [];
  }

  renderShop();
}

function fillRequestForm() {
  const form = document.querySelector('#contact-form');
  if (!form || !cart.size) return;
  const lines = cartEntries().map((entry) => `- ${entry.quantity} × ${entry.product.name} — ${currency.format(entry.product.price * entry.quantity)}`);
  form.elements.subject.value = 'Item request';
  form.elements.message.value = [
    'Hi Idea House,',
    '',
    'I would like to request these items:',
    ...lines,
    '',
    `Total: ${currency.format(cartTotalValue())}`,
    '',
    'Thanks!'
  ].join('\n');
}

searchInput?.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadProducts, 220);
});

shopFilters?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  shopFilters.querySelectorAll('.shop-filter').forEach((chip) => {
    const isActive = chip.dataset.category === activeCategory;
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', String(isActive));
  });
  loadProducts();
});

loadCatalogue().then(() => {
  renderCart();
  // Arriving from a /shop/:id "Request items" link (or a #contact nav link)
  // with a stocked cart should hand the customer a pre-filled request form.
  if (location.hash === '#contact' && cartEntries().length) fillRequestForm();
});

productGrid?.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add]');
  if (addButton) {
    const id = addButton.dataset.add;
    cart.set(id, (cart.get(id) || 0) + 1);
    renderControls(id);
    renderCart();
    return;
  }

  const stepButton = event.target.closest('[data-step]');
  if (!stepButton) return;
  const id = stepButton.dataset.id;
  const nextQuantity = (cart.get(id) || 0) + Number(stepButton.dataset.step);
  if (nextQuantity > 0) cart.set(id, nextQuantity);
  else cart.delete(id);
  renderControls(id);
  renderCart();
});

cartClear?.addEventListener('click', () => {
  const selectedIds = [...cart.keys()];
  cart.clear();
  selectedIds.forEach(renderControls);
  renderCart();
});

cartRequest?.addEventListener('click', fillRequestForm);

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.14 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const sectionObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-loaded');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.08 });

document.querySelectorAll('.scroll-load').forEach((section) => sectionObserver.observe(section));

async function loadPublishedContent() {
  const section = document.querySelector('#managed-content');
  const grid = document.querySelector('#managed-content-grid');
  if (!section || !grid) return;

  try {
    const response = await fetch(apiUrl('/api/published-content'));
    if (!response.ok) return;
    const { items } = await parseJson(response);
    if (!items.length) return;

    grid.innerHTML = items.map((item) => `
      <article class="managed-content-item reveal">
        <p class="eyebrow">Published / ${escapeHtml(item.slug)}</p>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
      </article>
    `).join('');
    section.hidden = false;
    sectionObserver.observe(section);
    grid.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
  } catch {
    // Keep the public site usable if the CMS API is unavailable.
  }
}

loadPublishedContent();

if (new URLSearchParams(window.location.search).has('signin')) {
  window.addEventListener('DOMContentLoaded', () => {
    window.IdeaClientAuth?.open('login');
  });
  window.setTimeout(() => window.IdeaClientAuth?.open('login'), 0);
}
