class IdeaContactForm extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <form class="contact-form" id="contact-form" novalidate>
        <label><span>Name</span><input name="name" type="text" autocomplete="name" required /></label>
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required /></label>
        <label class="form-subject"><span>Subject</span><input name="subject" type="text" required /></label>
        <label class="form-message"><span>Message</span><textarea name="message" rows="3" required></textarea></label>
        <button class="button button-light" type="submit">Send inquiry <span aria-hidden="true">↗</span></button>
        <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
      </form>
    `;

    this.querySelector('form').addEventListener('submit', (event) => this.submitForm(event));
  }

  apiUrl() {
    const { hostname, port } = window.location;
    const usingFrontendDevServer = hostname === '127.0.0.1' || hostname === 'localhost';

    if (usingFrontendDevServer && port && port !== '3000') {
      return 'http://localhost:3000/api/contact';
    }

    return '/api/contact';
  }

  async submitForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');
    const formStatus = form.querySelector('.form-status');
    const payload = Object.fromEntries(new FormData(form).entries());

    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    formStatus.textContent = '';
    formStatus.classList.remove('is-error', 'is-success');

    try {
      const response = await fetch(this.apiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Please check the form and try again.');
      }

      formStatus.classList.add('is-success');
      formStatus.textContent = result.message || 'Thanks. Your inquiry has been received.';
      form.reset();
    } catch (error) {
      formStatus.classList.add('is-error');
      formStatus.textContent = error.message || 'Something went wrong. Please try again.';
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = 'Send inquiry <span aria-hidden="true">↗</span>';
    }
  }
}

customElements.define('idea-contact-form', IdeaContactForm);
