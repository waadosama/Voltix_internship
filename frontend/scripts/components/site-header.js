import { escapeHtml } from '../lib/html.js';

class IdeaHeader extends HTMLElement {
  connectedCallback() {
    this.render();
    this.bindEvents();
  }

  render() {
    this.innerHTML = `
      <header class="site-header" id="top">
        <a class="brand" href="#top" aria-label="Idea House home">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>IDEA<br />HOUSE</span>
        </a>
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-nav">
          <span></span><span></span>
          <span class="sr-only">Toggle navigation</span>
        </button>
        <nav class="primary-nav" id="primary-nav" aria-label="Primary navigation">
          <a href="#services">What we do</a>
          <a href="#work">Selected work</a>
          <a href="#about">About us</a>
          <a class="admin-link" href="/admin">Admin studio <span aria-hidden="true">↗</span></a>
          <span class="client-auth-nav" id="client-auth-nav"></span>
          <a class="nav-cta" href="#contact">Start a project <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
    `;
    this.updateClientAuthUI();
  }

  bindEvents() {
    window.addEventListener('client-auth-changed', () => this.updateClientAuthUI());
  }

  updateClientAuthUI() {
    const container = this.querySelector('#client-auth-nav');
    if (!container) return;

    const user = window.IdeaClientAuth?.getUser?.();
    if (user) {
      container.innerHTML = `
        <span class="client-user-badge">Hi, ${escapeHtml(user.name || user.email)}</span>
        <button type="button" class="text-button" id="client-logout-btn">Sign out</button>
      `;
      container.querySelector('#client-logout-btn')?.addEventListener('click', () => {
        window.IdeaClientAuth?.logout();
      });
    } else {
      container.innerHTML = `
        <button type="button" class="text-button" id="client-signin-btn">Client sign in</button>
      `;
      container.querySelector('#client-signin-btn')?.addEventListener('click', () => {
        window.IdeaClientAuth?.open('login');
      });
    }
  }

}

customElements.define('idea-header', IdeaHeader);
