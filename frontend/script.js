const menuToggle = document.querySelector('.menu-toggle');
const primaryNav = document.querySelector('.primary-nav');

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

  const { hostname, port } = window.location;
  const apiBase = (hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '3000'
    ? 'http://localhost:3000'
    : '';

  try {
    const response = await fetch(`${apiBase}/api/published-content`);
    if (!response.ok) return;
    const { items } = await response.json();
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

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

loadPublishedContent();

