/**
 * AI Assistant Chat Widget — Conversational Agent
 * 
 * KEY CHANGE: The frontend now ALWAYS sends the full conversation history
 * to the backend, and TRUSTS the backend response. The old keyword-based
 * fallback is removed. The only local fallback is for when the server
 * is completely unreachable (network error).
 */
(function() {
  const toggle = document.getElementById('ai-toggle');
  const chatWindow = document.getElementById('ai-chat-window');
  const closeBtn = document.getElementById('ai-chat-close');
  const messagesContainer = document.getElementById('ai-chat-messages');
  const chatInput = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-send-btn');
  const quickActions = document.querySelectorAll('.ai-quick-btn');
  const heroAiBtn = document.getElementById('hero-ai-btn');
  const ctaAiBtn = document.getElementById('cta-ai-btn');

  // ── Conversation State ──
  // This array persists across messages and is sent to the server each time
  let conversationHistory = [];
  let isOpen = false;
  let isSending = false;

  // ── Chat Window Toggle ──
  function openChat() {
    chatWindow.classList.add('open');
    isOpen = true;
    chatInput.focus();
  }

  function closeChat() {
    chatWindow.classList.remove('open');
    isOpen = false;
  }

  toggle.addEventListener('click', () => {
    isOpen ? closeChat() : openChat();
  });

  closeBtn.addEventListener('click', closeChat);
  if (heroAiBtn) heroAiBtn.addEventListener('click', openChat);
  if (ctaAiBtn) ctaAiBtn.addEventListener('click', openChat);

  // ── Message Rendering ──
  function addMessage(text, type = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-message ${type}`;

    if (type === 'bot') {
      msgDiv.innerHTML = formatBotMessage(text);
    } else {
      msgDiv.textContent = text;
    }

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msgDiv;
  }

  function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message bot typing';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById('typing-indicator');
    if (typing) typing.remove();
  }

  function formatBotMessage(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>')
      .replace(/•/g, '&bull;');
  }

  // ── Core: Send Message with Full History ──
  async function sendMessage(text) {
    if (!text.trim() || isSending) return;

    isSending = true;
    const userText = text.trim();

    // 1. Show user message in UI
    addMessage(userText, 'user');
    chatInput.value = '';
    showTyping();

    // 2. Add to conversation history BEFORE sending
    conversationHistory.push({ role: 'user', content: userText });

    try {
      // 3. Send the FULL history to the backend (last 20 messages for context)
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          conversationHistory: conversationHistory.slice(-20)
        })
      });

      const data = await response.json();
      hideTyping();

      // 4. Extract the reply — trust the server response
      let reply = null;

      if (data.success && data.data && data.data.reply) {
        reply = data.data.reply;
      } else if (data.data && data.data.reply) {
        // Server returned 500 but still included a reply (graceful fallback)
        reply = data.data.reply;
      }

      if (reply) {
        addMessage(reply, 'bot');
        conversationHistory.push({ role: 'assistant', content: reply });
      } else {
        // Server returned no usable reply
        const fallback = getNetworkFallback();
        addMessage(fallback, 'bot');
        conversationHistory.push({ role: 'assistant', content: fallback });
      }

    } catch (error) {
      hideTyping();
      console.warn('AI Chat network error:', error);

      // ONLY use local fallback when server is completely unreachable
      const fallback = getNetworkFallback();
      addMessage(fallback, 'bot');
      conversationHistory.push({ role: 'assistant', content: fallback });
    }

    isSending = false;
  }

  /**
   * Minimal fallback — only used when server is unreachable.
   * Unlike the old system, this does NOT try to keyword-match.
   * It simply acknowledges the issue and suggests alternatives.
   */
  function getNetworkFallback() {
    return `⚠️ I'm having trouble connecting right now. But don't worry!\n\nYou can reach us directly:\n📱 **WhatsApp:** +91-98765-43210\n📞 **Call:** +91-98765-43210\n📧 **Email:** hello@wanderlustrentals.in\n\nOr try again in a moment — I'll be right back! 🔄`;
  }

  // ── Event Listeners ──
  sendBtn.addEventListener('click', () => {
    sendMessage(chatInput.value);
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput.value);
    }
  });

  // Quick action buttons — send as a natural message
  quickActions.forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.getAttribute('data-msg');
      if (msg) sendMessage(msg);
    });
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

})();
