class IdeaServiceCard extends HTMLElement {
  connectedCallback() {
    const number = this.getAttribute('number') || '01';
    const title = this.getAttribute('title') || '';
    const description = this.getAttribute('description') || '';
    const accent = this.hasAttribute('accent') ? ' service-card-accent' : '';

    this.outerHTML = `<article class="service-card${accent} reveal">
      <span class="service-number">${number}</span>
      <h3>${title}</h3>
      <p>${description}</p>
      <a href="#contact" aria-label="Learn more about ${title.replace('<br />', ' ')}">↗</a>
    </article>`;
  }
}

customElements.define('idea-service-card', IdeaServiceCard);
