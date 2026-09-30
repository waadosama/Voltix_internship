import { apiUrl, parseJson } from '../lib/api.js';
import { escapeHtml } from '../lib/html.js';

// The request "cart" lives in localStorage so an item added on this detail
// page is waiting for the customer on the shop page (`home.js` reads the
// same key).
const CART_KEY = 'idea-house-cart';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const loadingBox = document.querySelector('#item-loading');
const errorBox = document.querySelector('#item-error');
const card = document.querySelector('#item-card');
const mediaBox = document.querySelector('#item-media');
const categoryBox = document.querySelector('#item-category');
const nameBox = document.querySelector('#item-name');
const blurbBox = document.querySelector('#item-blurb');
const priceBox = document.querySelector('#item-price');
const controlsBox = document.querySelector('#item-controls');
const goRequestLink = document.querySelector('#item-go-request');
const relatedSection = document.querySelector('#related');
const relatedCategory = document.querySelector('#related-category');
const relatedGrid = document.querySelector('#related-grid');

let currentItem = null;

function itemIdFromPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[0] === 'shop' && parts[1] ? decodeURIComponent(parts[1]) : '';
}

function readCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_KEY));
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

function writeCart(cart) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // Storage unavailable (private mode, blocked cookies) - the in-page
    // quantity still works, it just will not survive navigation.
  }
}

function toneOf(product) {
  return product.image ? 'photo' : (product.tone || 'cobalt');
}

function mediaHtml(product) {
  if (product.image) {
    return `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />`;
  }
  return `<span class="product-glyph" aria-hidden="true">${escapeHtml(product.glyph || '✳')}</span>`;
}

function controlsHtml(product) {
  const quantity = Number(readCart()[product.id]) || 0;
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

function renderControls() {
  if (!currentItem || !controlsBox) return;
  controlsBox.innerHTML = controlsHtml(currentItem);
  const quantity = Number(readCart()[currentItem.id]) || 0;
  goRequestLink.hidden = !quantity;
}

function showError(message) {
  loadingBox.hidden = true;
  card.hidden = true;
  relatedSection.hidden = true;
  errorBox.textContent = message;
  errorBox.hidden = false;
  document.title = 'Shop item - Idea House';
}

function renderItem(product) {
  currentItem = product;
  document.title = `${product.name} - Idea House`;
  categoryBox.textContent = product.category || '';
  nameBox.textContent = product.name;
  blurbBox.textContent = product.blurb || '';
  priceBox.textContent = currency.format(product.price);
  mediaBox.className = `item-media product-media--${toneOf(product)}`;
  mediaBox.innerHTML = `${product.badge ? `<span class="product-badge">${escapeHtml(product.badge)}</span>` : ''}${mediaHtml(product)}`;

  loadingBox.hidden = true;
  errorBox.hidden = true;
  card.hidden = false;
  renderControls();
}

function relatedCardHtml(product) {
  const href = `/shop/${encodeURIComponent(product.id)}`;
  return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <a class="product-link" href="${escapeHtml(href)}">
        <div class="product-media product-media--${escapeHtml(toneOf(product))}">
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
        </div>
      </div>
    </article>`;
}

async function loadRelated(product) {
  if (!product.category) return;
  try {
    const response = await fetch(apiUrl(`/api/products?category=${encodeURIComponent(product.category)}`));
    if (!response.ok) throw new Error(String(response.status));
    const { products = [] } = await parseJson(response);
    const others = products.filter((entry) => entry.id !== product.id).slice(0, 3);
    if (!others.length) return;
    relatedCategory.textContent = product.category;
    relatedGrid.innerHTML = others.map(relatedCardHtml).join('');
    relatedSection.hidden = false;
  } catch {
    // The related section is optional - never block the item page on it.
  }
}

controlsBox?.addEventListener('click', (event) => {
  if (!currentItem) return;

  const addButton = event.target.closest('[data-add]');
  if (addButton) {
    const cart = readCart();
    cart[currentItem.id] = (Number(cart[currentItem.id]) || 0) + 1;
    writeCart(cart);
    renderControls();
    return;
  }

  const stepButton = event.target.closest('[data-step]');
  if (!stepButton) return;
  const cart = readCart();
  const nextQuantity = (Number(cart[stepButton.dataset.id]) || 0) + Number(stepButton.dataset.step);
  if (nextQuantity > 0) cart[stepButton.dataset.id] = nextQuantity;
  else delete cart[stepButton.dataset.id];
  writeCart(cart);
  renderControls();
});

async function loadItem() {
  const id = itemIdFromPath();
  if (!id) {
    showError('This item does not exist (yet).');
    return;
  }

  try {
    const response = await fetch(apiUrl(`/api/products/${encodeURIComponent(id)}`));
    if (response.status === 404) {
      showError('This item does not exist (yet).');
      return;
    }
    if (!response.ok) throw new Error(String(response.status));

    const { product } = await parseJson(response);
    if (!product) {
      showError('This item does not exist (yet).');
      return;
    }

    renderItem(product);
    loadRelated(product);
  } catch {
    showError('The item could not be loaded. Please try again.');
  }
}

loadItem();
