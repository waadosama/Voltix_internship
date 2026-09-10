class IdeaHeader extends HTMLElement {
  connectedCallback() {
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
          <a class="nav-cta" href="#contact">Start a project <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
    `;
  }
}

customElements.define('idea-header', IdeaHeader);
