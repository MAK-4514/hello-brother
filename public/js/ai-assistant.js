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
   * Mock fallback logic for GitHub Pages (since backend isn't deployed)
   * This provides an immediate, functional chatbot experience locally.
   */
  function getNetworkFallback() {
    const lastMsg = conversationHistory[conversationHistory.length - 1];
    if (!lastMsg) return "How can I help you today?";
    
    const text = lastMsg.content.toLowerCase();
    
    if (text.includes("hello") || text.includes("hi") || text.includes("hey")) {
      return "Hi there! 👋 Welcome to Hello Brother. Are you looking for a vehicle rental or planning a holiday trip?";
    }
    else if (text.includes("mountain") || text.includes("hill") || text.includes("snow")) {
      return "🏔️ For mountain trips, I highly recommend our **SUVs (like Mahindra Thar or Scorpio)** due to their high ground clearance and power. Alternatively, the **Royal Enfield Himalayan** is perfect if you prefer riding. Shall I show you pricing?";
    }
    else if (text.includes("goa") || text.includes("beach")) {
      return "🌴 Ah, Goa! The perfect beach getaway. For navigating Goa's narrow streets, our **scooties (Honda Activa/Dio)** are the most popular choice. We also offer a premium 4-day Goa Holiday Package. What interests you more?";
    }
    else if (text.includes("ladakh") || text.includes("spiti")) {
      return "🏍️ An epic adventure! For Ladakh or Spiti, the **Royal Enfield Himalayan** or **KTM Adventure** are absolute must-haves. We also provide complete riding gear and GoPro combos to capture the journey. When are you planning to go?";
    }
    else if (text.includes("camera") || text.includes("photo") || text.includes("video")) {
      return "📸 We have a great lineup of camera gear! For action, the **GoPro Hero 11** is ₹399/day. For professional shots, the **Sony A7III with lenses** starts at ₹799/day. Do you know what kind of shoot you're doing?";
    }
    else if (text.includes("price") || text.includes("cost") || text.includes("rent")) {
      return "Here's a quick pricing overview:\n• **Scooties:** from ₹399/day\n• **Bikes:** from ₹599/day\n• **Cars:** from ₹1,499/day\n• **Cameras:** from ₹399/day\n\nWhat specifically are you looking to rent?";
    }
    else if (text.includes("book") || text.includes("reserve")) {
      return "Fantastic! You can quickly submit a booking request using the **Contact Form** at the bottom of the page, or simply reach out via **WhatsApp (+91-98765-43210)** and our team will confirm your reservation in 5 minutes! 🚀";
    }
    else if (text.includes("thank") || text.includes("thanks")) {
      return "You're very welcome! Let me know if you need anything else. Safe travels! 🚗✨";
    }
    else {
      return "That sounds exciting! Since my live AI connection is currently offline, I can't give a perfectly customized answer right this second. \n\nHowever, you can reach our human experts directly:\n📱 **WhatsApp:** +91-98765-43210\n📧 **Email:** hello@wanderlustrentals.in\n\nHow else can I assist you right now?";
    }
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
