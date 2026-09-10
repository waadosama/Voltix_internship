class IdeaContactForm extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <form class="contact-form" id="contact-form">
        <label><span>Name</span><input name="name" type="text" autocomplete="name" required /></label>
        <label><span>Email</span><input name="email" type="email" autocomplete="email" required /></label>
        <label><span>Company</span><input name="company" type="text" autocomplete="organization" /></label>
        <label class="form-message"><span>Tell us a little about it</span><textarea name="message" rows="3" required></textarea></label>
        <button class="button button-light" type="submit">Send inquiry <span aria-hidden="true">↗</span></button>
        <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
      </form>
    `;

    this.querySelector('form').addEventListener('submit', (event) => this.submitForm(event));
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
    formStatus.classList.remove('is-error');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message);
      formStatus.textContent = result.message;
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
