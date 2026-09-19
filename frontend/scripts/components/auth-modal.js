import { apiUrl, parseJson } from '../lib/api.js';
import { clearClientSession, getClientToken, getClientUser, notifyClientAuth, setClientSession } from '../lib/client-auth.js';

class IdeaAuthModal extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <dialog class="auth-modal" id="auth-dialog">
        <div class="auth-modal-content">
          <div class="auth-modal-header">
            <h2 id="auth-modal-title">Client Sign In</h2>
            <button type="button" class="icon-button" id="close-auth-modal" aria-label="Close auth dialog">×</button>
          </div>

          <form id="auth-form" class="auth-form" novalidate>
            <label id="name-field" hidden>
              <span>Full Name</span>
              <input name="name" type="text" autocomplete="name" />
            </label>

            <label>
              <span>Email</span>
              <input name="email" type="email" autocomplete="email" required />
            </label>

            <label>
              <span>Password</span>
              <input name="password" type="password" autocomplete="current-password" required minlength="6" />
            </label>

            <input type="hidden" name="mode" value="login" />

            <button type="submit" class="button button-dark" id="auth-submit">Sign In <span aria-hidden="true">↗</span></button>
            <p class="form-status" id="auth-status" role="alert"></p>

            <div class="auth-toggle">
              <span id="auth-toggle-text">Don't have an account?</span>
              <button type="button" class="text-button" id="auth-toggle-btn">Create account</button>
            </div>
          </form>
        </div>
      </dialog>
    `;

    this.dialog = this.querySelector('#auth-dialog');
    this.form = this.querySelector('#auth-form');
    this.titleEl = this.querySelector('#auth-modal-title');
    this.nameField = this.querySelector('#name-field');
    this.nameInput = this.nameField.querySelector('input');
    this.submitBtn = this.querySelector('#auth-submit');
    this.statusEl = this.querySelector('#auth-status');
    this.toggleText = this.querySelector('#auth-toggle-text');
    this.toggleBtn = this.querySelector('#auth-toggle-btn');
    this.closeBtn = this.querySelector('#close-auth-modal');

    this.closeBtn.addEventListener('click', () => this.close());
    this.toggleBtn.addEventListener('click', () => this.toggleMode());
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Expose client auth methods on window
    window.IdeaClientAuth = {
      open: (mode = 'login') => this.open(mode),
      close: () => this.close(),
      getToken: () => getClientToken(),
      getUser: () => getClientUser(),
      logout: () => this.logout()
    };
  }

  open(mode = 'login') {
    this.setMode(mode);
    this.statusEl.textContent = '';
    this.statusEl.className = 'form-status';
    this.form.reset();
    if (typeof this.dialog.showModal === 'function') {
      this.dialog.showModal();
    } else {
      this.dialog.setAttribute('open', '');
    }
  }

  close() {
    if (typeof this.dialog.close === 'function') {
      this.dialog.close();
    } else {
      this.dialog.removeAttribute('open');
    }
  }

  setMode(mode) {
    const isRegister = mode === 'register';
    this.form.elements.mode.value = mode;
    this.nameField.hidden = !isRegister;
    this.nameInput.required = isRegister;
    this.titleEl.textContent = isRegister ? 'Create Client Account' : 'Client Sign In';
    this.submitBtn.innerHTML = isRegister ? 'Register <span aria-hidden="true">↗</span>' : 'Sign In <span aria-hidden="true">↗</span>';
    this.toggleText.textContent = isRegister ? 'Already have an account?' : "Don't have an account?";
    this.toggleBtn.textContent = isRegister ? 'Sign in' : 'Create account';
  }

  toggleMode() {
    const currentMode = this.form.elements.mode.value;
    this.setMode(currentMode === 'login' ? 'register' : 'login');
  }

  async handleSubmit(event) {
    event.preventDefault();
    const mode = this.form.elements.mode.value;
    const email = this.form.elements.email.value.trim();
    const password = this.form.elements.password.value;
    const name = this.form.elements.name.value.trim();

    this.submitBtn.disabled = true;
    this.statusEl.textContent = '';
    this.statusEl.className = 'form-status';

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = mode === 'register' ? { name, email, password, role: 'client' } : { email, password };

    try {
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await parseJson(response);
      if (!response.ok) {
        throw new Error(result.message || 'Authentication failed.');
      }

      setClientSession(result.token, result.user);

      this.statusEl.classList.add('is-success');
      this.statusEl.textContent = result.message || 'Success!';

      setTimeout(() => {
        this.close();
        notifyClientAuth(result.user);
        const onDashboard = window.location.pathname === '/dashboard' || window.location.pathname === '/dashboard/';
        if (!onDashboard) {
          window.location.assign('/dashboard');
        }
      }, 500);
    } catch (error) {
      this.statusEl.classList.add('is-error');
      this.statusEl.textContent = error.message;
    } finally {
      this.submitBtn.disabled = false;
    }
  }

  logout() {
    clearClientSession();
    notifyClientAuth(null);
  }
}

customElements.define('idea-auth-modal', IdeaAuthModal);
