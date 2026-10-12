import { refreshIcons } from '../utils/icons.js';

const BACKEND_URL = 'http://localhost:3000';
let chatHistory = [];
let isOpen = false;
let isTyping = false;

export function initChatbot() {
  const fab = document.getElementById('chat-fab');
  const panel = document.getElementById('chat-panel');
  const closeBtn = document.getElementById('chat-close');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  if (!fab || !panel) return;

  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    fab.classList.toggle('active', isOpen);
    if (isOpen) input?.focus();
  });

  closeBtn?.addEventListener('click', () => {
    isOpen = false;
    panel.classList.remove('open');
    fab.classList.remove('active');
  });

  sendBtn?.addEventListener('click', sendMessage);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  addBotMessage("Hey! I'm the Rebase AI Assistant. Ask me anything about the system — architecture, pipeline, dependencies, SDKs, live state, or how any feature works.");
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value?.trim();
  if (!text || isTyping) return;

  input.value = '';
  addUserMessage(text);
  chatHistory.push({ role: 'user', content: text });

  setTyping(true);

  try {
    const res = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory.slice(-20) })
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.detail || data.error || 'Something went wrong';
      addBotMessage(`⚠ ${errMsg}`);
    } else {
      addBotMessage(data.reply);
      chatHistory.push({ role: 'assistant', content: data.reply });
    }
  } catch (err) {
    addBotMessage('⚠ Could not reach the backend. Make sure the server is running on port 3000.');
  } finally {
    setTyping(false);
  }
}

function addUserMessage(text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-user';
  msg.innerHTML = `<div class="chat-bubble user">${escapeHtml(text)}</div>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function addBotMessage(text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msg = document.createElement('div');
  msg.className = 'chat-msg chat-msg-bot';
  msg.innerHTML = `<div class="chat-bubble bot">${formatMarkdown(text)}</div>`;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function setTyping(on) {
  isTyping = on;
  const indicator = document.getElementById('chat-typing');
  const sendBtn = document.getElementById('chat-send');
  if (indicator) indicator.classList.toggle('hidden', !on);
  if (sendBtn) sendBtn.disabled = on;

  if (on) {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatMarkdown(text) {
  let html = escapeHtml(text);
  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  // Lists
  html = html.replace(/^- (.+)/gm, '• $1');
  return html;
}
