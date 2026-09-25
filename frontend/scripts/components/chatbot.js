import { apiUrl, parseJson } from '../lib/api.js';

class IdeaChatbot extends HTMLElement {
  connectedCallback() {
    this.isOpen = false;
    this.hasLoaded = false;
    this.render();
    this.bindEvents();
  }

  render() {
    this.innerHTML = `
      <div class="chatbot" id="chatbot">
        <div class="chatbot-panel" id="chatbot-panel" hidden>
          <div class="chatbot-header">
            <div class="chatbot-heading">
              <strong>Chat with Idea House</strong>
              <span>We usually reply fast</span>
            </div>
            <button type="button" class="icon-button" id="chatbot-close" aria-label="Close chat window">&times;</button>
          </div>

          <div class="chatbot-messages" id="chatbot-messages" role="log" aria-live="polite"></div>

          <div class="chatbot-note">
            <p class="chatbot-status" id="chatbot-status" role="status" aria-live="polite"></p>
            <button type="button" class="button button-dark chatbot-signin" id="chatbot-signin" hidden>Sign in to chat <span aria-hidden="true">&#8599;</span></button>
          </div>

          <form class="chatbot-composer" id="chatbot-form" novalidate>
            <label class="sr-only" for="chatbot-input">Message</label>
            <input id="chatbot-input" name="message" type="text" placeholder="Type a message..." autocomplete="off" maxlength="4000" />
            <button type="submit" class="chatbot-send" id="chatbot-send">Send</button>
          </form>
        </div>

        <button type="button" class="chatbot-toggle" id="chatbot-toggle" aria-label="Open chat" aria-expanded="false" aria-controls="chatbot-panel">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z"></path>
          </svg>
        </button>
      </div>
    `;

    this.panel = this.querySelector('#chatbot-panel');
    this.toggleButton = this.querySelector('#chatbot-toggle');
    this.closeButton = this.querySelector('#chatbot-close');
    this.messagesElement = this.querySelector('#chatbot-messages');
    this.statusElement = this.querySelector('#chatbot-status');
    this.signInButton = this.querySelector('#chatbot-signin');
    this.form = this.querySelector('#chatbot-form');
    this.input = this.querySelector('#chatbot-input');
    this.sendButton = this.querySelector('#chatbot-send');
  }

  bindEvents() {
    this.toggleButton.addEventListener('click', () => this.toggle());
    this.closeButton.addEventListener('click', () => this.close());
    this.form.addEventListener('submit', (event) => this.sendMessage(event));
    this.signInButton.addEventListener('click', () => window.IdeaClientAuth?.open('login'));
    window.addEventListener('client-auth-changed', () => {
      this.hasLoaded = false;
      if (!this.token) {
        this.messages = [];
        this.messagesElement.innerHTML = '';
      }
      this.updateAuthState();
      if (this.isOpen && this.token) this.loadMessages();
    });
  }

  get token() {
    return window.IdeaClientAuth?.getToken?.() || null;
  }

  authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` };
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.panel.hidden = false;
    this.toggleButton.setAttribute('aria-expanded', 'true');

    if (!this.hasLoaded) {
      this.loadMessages();
    }
    this.updateAuthState();
  }

  close() {
    this.isOpen = false;
    this.panel.hidden = true;
    this.toggleButton.setAttribute('aria-expanded', 'false');
  }

  updateAuthState() {
    const signedIn = Boolean(this.token);
    this.signInButton.hidden = signedIn;
    this.form.hidden = !signedIn;
    if (!signedIn) {
      this.setStatus('Sign in to chat with the studio.');
    } else if (this.statusElement.textContent === 'Sign in to chat with the studio.') {
      this.setStatus('');
    }
  }

  setStatus(text = '') {
    this.statusElement.textContent = text;
  }

  async loadMessages() {
    if (!this.token) {
      this.hasLoaded = true;
      this.updateAuthState();
      return;
    }

    this.setStatus('Loading messages...');

    try {
      const response = await fetch(apiUrl('/api/chat/messages'), {
        headers: this.authHeaders()
      });

      if (response.status === 401) {
        this.hasLoaded = true;
        this.updateAuthState();
        return;
      }

      const result = await parseJson(response);

      if (!response.ok) {
        throw new Error(result.message || 'Messages could not be loaded.');
      }

      this.messages = Array.isArray(result.messages) ? result.messages : [];
      this.renderMessages();
      this.hasLoaded = true;
      this.setStatus('');
    } catch (error) {
      this.setStatus(error.message || 'Messages could not be loaded.');
    } finally {
      this.updateAuthState();
    }
  }

  async sendMessage(event) {
    event.preventDefault();

    const text = this.input.value.trim();
    if (!text) return;

    if (!this.token) {
      this.updateAuthState();
      return;
    }

    this.sendButton.disabled = true;
    this.setStatus('Sending...');

    try {
      const response = await fetch(apiUrl('/api/chat/messages'), {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ message: text, sender: 'user' })
      });

      if (response.status === 401) {
        this.updateAuthState();
        return;
      }

      const result = await parseJson(response);

      if (!response.ok) {
        throw new Error(result.message || 'Your message could not be sent.');
      }

      if (result.message) this.appendMessage(result.message);
      if (result.reply) this.appendMessage(result.reply);

      this.input.value = '';
      this.input.focus();
      this.setStatus('');
    } catch (error) {
      this.setStatus(error.message || 'Your message could not be sent.');
    } finally {
      this.sendButton.disabled = false;
    }
  }

  appendMessage(message) {
    if (!Array.isArray(this.messages)) this.messages = [];
    this.messages.push(message);

    const element = this.createMessageElement(message);
    if (element) {
      this.messagesElement.appendChild(element);
      this.scrollToBottom();
    }
  }

  renderMessages() {
    if (!this.messages.length) {
      this.messagesElement.innerHTML = '<p class="chatbot-empty">No messages yet. Say hello!</p>';
      return;
    }

    this.messagesElement.innerHTML = '';
    this.messages.forEach((message) => {
      const element = this.createMessageElement(message);
      if (element) this.messagesElement.appendChild(element);
    });
    this.scrollToBottom();
  }

  createMessageElement(message) {
    if (!message || typeof message.message !== 'string') return null;

    const isBot = message.sender === 'bot';
    const row = document.createElement('div');
    row.className = `chatbot-row ${isBot ? 'chatbot-row-bot' : 'chatbot-row-user'}`;

    const bubble = document.createElement('div');
    bubble.className = `chatbot-bubble ${isBot ? 'chatbot-bubble-bot' : 'chatbot-bubble-user'}`;
    bubble.textContent = message.message;

    const time = document.createElement('time');
    time.className = 'chatbot-time';
    time.textContent = this.formatTime(message.timestamp);

    row.appendChild(bubble);
    row.appendChild(time);

    return row;
  }

  formatTime(timestamp) {
    const date = timestamp ? new Date(timestamp) : null;
    if (!date || Number.isNaN(date.getTime())) return '';

    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  scrollToBottom() {
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
  }
}

customElements.define('idea-chatbot', IdeaChatbot);
