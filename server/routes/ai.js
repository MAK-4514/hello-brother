const express = require('express');
const router = express.Router();

/**
 * AI Smart Assistant Route — Conversational Booking Agent
 * 
 * KEY DESIGN: The AI maintains conversation context by:
 * 1. Receiving the FULL conversation history from the frontend
 * 2. Using conversation state to extract what's been discussed
 * 3. Generating responses that build on prior context (not resetting)
 * 
 * Works with Google Gemini API when key is present,
 * falls back to a context-aware state machine when it's not.
 */

// ─── System Prompt (Persona + Rules) ───────────────────────────
const SYSTEM_PROMPT = `You are **WanderBot**, the friendly AI travel concierge for **WanderLust Rentals** — India's premium self-drive rental and holiday package platform.

## YOUR ROLE
You are a **conversational booking agent**, NOT a menu system. You hold natural, flowing conversations that guide users from interest → planning → booking.

## CONVERSATION RULES (CRITICAL)
1. **NEVER reset the conversation.** If a user has told you their destination, remember it. If they said "Ladakh", all future responses should build on that — ask about duration, group size, vehicle preference, etc.
2. **NEVER show a generic menu of options** unless the user says "start over", "reset", "main menu", or you have ZERO context.
3. **Ask ONE follow-up question at a time.** Don't overwhelm with choices. Guide naturally.
4. **Reference what the user already told you.** For example: "Since you're heading to Ladakh with 4 friends, I'd suggest..."
5. **Be proactive.** Once you know destination + duration + group size, proactively suggest a vehicle AND a package with pricing.
6. **Keep responses concise** — 3-5 short paragraphs max. Use bullet points for options.

## CONVERSATION FLOW
Follow this natural progression:
1. **Greet** → Ask where they want to go
2. **Destination known** → Ask about duration and group size
3. **Duration known** → Suggest specific vehicles and/or packages with prices
4. **Vehicle/package discussed** → Suggest add-ons (cameras, gear) and offer to finalize
5. **Ready to book** → Collect name, dates, and summarize the booking

## OUR INVENTORY & PRICING

**Self-Drive Vehicles:**
| Vehicle | Price/Day | Best For |
|---------|-----------|----------|
| Honda Activa / TVS Ntorq | ₹399-600 | City, beach towns |
| Royal Enfield Classic 350 | ₹800-1,200 | Highway cruising |
| Royal Enfield Himalayan | ₹1,200-1,500 | Mountain passes, Ladakh |
| KTM Duke 390 | ₹1,000-1,800 | Sporty touring |
| Maruti Swift / i20 | ₹1,000-1,800 | City + short drives |
| Honda City / Hyundai Verna | ₹1,500-2,500 | Highway comfort |
| Hyundai Creta / Kia Seltos | ₹2,500-3,500 | Hills, families |
| Mahindra Thar | ₹3,500-4,500 | Offroad, adventure |

**Camera Gear:**
| Gear | Price/Day |
|------|-----------|
| GoPro Hero 12 | ₹800-1,200 |
| Canon EOS R50 Mirrorless Kit | ₹2,000-3,000 |
| Sony Alpha A6400 Kit | ₹2,500-4,000 |
| DJI Mini 4 Pro Drone | ₹2,500-5,000 |
| DSLR Canon 200D Kit | ₹1,500-2,500 |

**Holiday Packages:**
1. **Goa Beach Escape** — 4D/3N, ₹8,999/person (Scooty included, beach hopping itinerary)
2. **Manali Adventure Trail** — 5D/4N, ₹12,999/person (SUV included, Rohtang + Solang + Kasol)
3. **Kerala Backwater Bliss** — 6D/5N, ₹15,999/person (Sedan included, Munnar + Alleppey houseboat)
4. **Ladakh Explorer** — 8D/7N, ₹22,999/person (RE Himalayan, Pangong + Nubra + Khardung La)
5. **Rajasthan Royal Circuit** — 7D/6N, ₹19,999/person (Sedan, Jaipur + Udaipur + Jodhpur + Jaisalmer)
6. **Meghalaya Hidden Gems** — 5D/4N, ₹14,999/person (SUV, Living root bridges + Dawki + Shillong)

**Discounts:**
- 3+ day rental → 10% off
- Vehicle + Camera combo → 15% off
- Early booking (7+ days ahead) → up to 20% off

## TONE
Friendly and enthusiastic but professional. Use emojis sparingly (1-2 per response). Sound like a knowledgeable local travel friend, not a corporate chatbot.`;


// ─── Main Chat Endpoint ────────────────────────────────────────
// @route   POST /api/ai/chat
// @desc    Conversational AI chat with full context
// @access  Public
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // ── Try Gemini API first ──
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        const reply = await callGeminiAPI(apiKey, message, conversationHistory);
        return res.json({
          success: true,
          data: { reply, isSimulated: false }
        });
      } catch (apiError) {
        console.error('Gemini API Error:', apiError.message);
        // Fall through to simulated response
      }
    }

    // ── Fallback: Context-aware simulated response ──
    const reply = getContextAwareResponse(message, conversationHistory);
    return res.json({
      success: true,
      data: { reply, isSimulated: true }
    });

  } catch (error) {
    console.error('AI Chat Error:', error);
    // Even on server error, try to return a useful response
    const reply = getContextAwareResponse(req.body.message, req.body.conversationHistory || []);
    res.json({
      success: true,
      data: { reply, isSimulated: true }
    });
  }
});


// ─── Gemini API Caller ─────────────────────────────────────────
async function callGeminiAPI(apiKey, message, conversationHistory) {
  // Build the full conversation for the API — this is the key to context!
  const contents = [];

  // Add ALL prior messages so Gemini sees the full conversation
  for (const msg of conversationHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }

  // Add current user message
  contents.push({
    role: 'user',
    parts: [{ text: message }]
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1024,
          topP: 0.95
        }
      })
    }
  );

  const data = await response.json();

  if (data.candidates && data.candidates[0]) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error('No valid response from Gemini API');
}


// ════════════════════════════════════════════════════════════════
// CONTEXT-AWARE FALLBACK ENGINE (no API key needed)
// ════════════════════════════════════════════════════════════════
//
// This is NOT a keyword matcher. It reads the FULL conversation
// history to understand what has been discussed and generates
// responses that continue the conversation naturally.
// ════════════════════════════════════════════════════════════════

function getContextAwareResponse(message, conversationHistory = []) {
  // Step 1: Extract conversation context from ALL messages
  const context = extractContext(message, conversationHistory);

  // Step 2: Determine what stage of the conversation we're in
  const stage = determineConversationStage(context);

  // Step 3: Generate a response appropriate to the stage
  return generateStageResponse(stage, context, message);
}

/**
 * Scans the entire conversation history + current message
 * to build a context object of everything discussed so far.
 */
function extractContext(currentMessage, history) {
  // Combine all messages into one searchable corpus
  const allText = [
    ...history.map(m => m.content),
    currentMessage
  ].join(' ').toLowerCase();

  const userMessages = history
    .filter(m => m.role === 'user')
    .map(m => m.content.toLowerCase());
  userMessages.push(currentMessage.toLowerCase());

  const currentMsg = currentMessage.toLowerCase();

  const ctx = {
    destination: null,
    duration: null,
    groupSize: null,
    vehicleInterest: null,
    cameraInterest: false,
    budgetMentioned: false,
    wantsPackage: false,
    wantsToBook: false,
    isGreeting: false,
    wantsReset: false,
    messageCount: history.length,
    currentMessage: currentMsg,
    allUserMessages: userMessages
  };

  // ── Detect reset intent ──
  if (currentMsg.match(/\b(start over|reset|main menu|go back|new search|begin again)\b/)) {
    ctx.wantsReset = true;
    return ctx;
  }

  // ── Detect greeting (only if it's the first message) ──
  if (ctx.messageCount === 0 && currentMsg.match(/\b(hi|hello|hey|help|start|yo|hola|namaste)\b/)) {
    ctx.isGreeting = true;
    return ctx;
  }

  // ── Scan ALL text for destination ──
  // Use word-boundary regex to avoid partial matches (e.g. "go" matching "goa")
  // Prioritize: scan user messages newest-first, then fall back to full text
  const destinationList = [
    { pattern: /\bladakh\b/, name: 'Ladakh' },
    { pattern: /\bleh\b/, name: 'Ladakh' },
    { pattern: /\bmanali\b/, name: 'Manali' },
    { pattern: /\bgoa\b/, name: 'Goa' },
    { pattern: /\bkerala\b/, name: 'Kerala' },
    { pattern: /\bmunnar\b/, name: 'Munnar' },
    { pattern: /\balleppey\b/, name: 'Kerala' },
    { pattern: /\brajasthan\b/, name: 'Rajasthan' },
    { pattern: /\bjaipur\b/, name: 'Rajasthan' },
    { pattern: /\budaipur\b/, name: 'Rajasthan' },
    { pattern: /\bjodhpur\b/, name: 'Rajasthan' },
    { pattern: /\bjaisalmer\b/, name: 'Rajasthan' },
    { pattern: /\bmeghalaya\b/, name: 'Meghalaya' },
    { pattern: /\bshillong\b/, name: 'Meghalaya' },
    { pattern: /\bcheerapunji\b/, name: 'Meghalaya' },
    { pattern: /\bcoorg\b/, name: 'Coorg' },
    { pattern: /\booty\b/, name: 'Ooty' },
    { pattern: /\bkodaikanal\b/, name: 'Kodaikanal' },
    { pattern: /\bandaman\b/, name: 'Andaman' },
    { pattern: /\brishikesh\b/, name: 'Rishikesh' },
    { pattern: /\bdarjeeling\b/, name: 'Darjeeling' },
    { pattern: /\bspiti\b/, name: 'Spiti Valley' },
    { pattern: /\bkasol\b/, name: 'Kasol' },
    { pattern: /\bmcleodganj\b/, name: 'McLeodganj' },
    { pattern: /\bshimla\b/, name: 'Shimla' },
    { pattern: /\bmussoorie\b/, name: 'Mussoorie' },
    { pattern: /\bnainital\b/, name: 'Nainital' },
    { pattern: /\bvaranasi\b/, name: 'Varanasi' },
    { pattern: /\bhampi\b/, name: 'Hampi' },
    { pattern: /\bpondicherry\b/, name: 'Pondicherry' }
  ];

  // Scan user messages newest-first to pick up the most recent destination
  const userTextsNewestFirst = [...userMessages].reverse();
  for (const userText of userTextsNewestFirst) {
    for (const { pattern, name } of destinationList) {
      if (pattern.test(userText)) {
        ctx.destination = name;
        break;
      }
    }
    if (ctx.destination) break;
  }

  // ── Scan USER messages only for duration (avoid bot messages like "8D/7N") ──
  const userText = userMessages.join(' ');
  const durationMatch = userText.match(/(\d+)\s*(?:days?|nights?|d\/|d\s*[\/\-]\s*\d+\s*n)/i);
  if (durationMatch) {
    ctx.duration = parseInt(durationMatch[1]);
  }
  // Natural language durations (user messages only)
  if (userText.match(/\b(weekend|2\s*days?|short trip)\b/)) ctx.duration = ctx.duration || 2;
  if (userText.match(/\b(week|7\s*days?|one week)\b/)) ctx.duration = ctx.duration || 7;
  if (userText.match(/\b(long weekend|3\s*days?|4\s*days?)\b/)) ctx.duration = ctx.duration || 4;

  // ── Scan USER messages only for group size ──
  const groupMatch = userText.match(/(\d+)\s*(?:people|persons?|friends?|of us|members?|pax)/i);
  if (groupMatch) ctx.groupSize = parseInt(groupMatch[1]) + (groupMatch[0].includes('friend') ? 1 : 0); // +1 for the user themselves
  if (userText.match(/\b(solo|alone|myself)\b/)) ctx.groupSize = 1;
  if (userText.match(/\b(couple|two of us|partner|wife|husband|girlfriend|boyfriend)\b/)) ctx.groupSize = 2;
  if (userText.match(/\b(family|parents|kids|children)\b/)) ctx.groupSize = ctx.groupSize || 4;

  // ── Scan for vehicle interest (user messages only to avoid bot suggestions) ──
  if (userText.match(/\b(car|suv|sedan|hatchback|thar|creta|four wheel|4x4)\b/)) ctx.vehicleInterest = 'car';
  if (userText.match(/\b(bike|motorcycle|enfield|bullet|himalayan|ktm|duke)\b/)) ctx.vehicleInterest = 'bike';
  if (userText.match(/\b(scooty|scooter|activa|ntorq|vespa|two wheeler)\b/)) ctx.vehicleInterest = 'scooty';

  // ── Camera interest ──
  ctx.cameraInterest = !!allText.match(/\b(camera|photo|video|gopro|drone|dslr|mirrorless|shoot|photography|vlog)\b/);

  // ── Budget interest ──
  ctx.budgetMentioned = !!allText.match(/\b(price|cost|budget|cheap|expensive|afford|how much|rate|₹)\b/);

  // ── Package interest ──
  ctx.wantsPackage = !!allText.match(/\b(package|holiday|itinerary|plan|trip plan|tour|all.?inclusive)\b/);

  // ── Booking intent ──
  ctx.wantsToBook = !!allText.match(/\b(book|reserve|confirm|finalize|proceed|payment|whatsapp|call)\b/);

  return ctx;
}

/**
 * Based on what we know so far, determine the conversation stage.
 */
function determineConversationStage(ctx) {
  if (ctx.wantsReset) return 'RESET';
  if (ctx.isGreeting) return 'GREETING';
  if (ctx.wantsToBook && ctx.destination) return 'BOOKING';
  if (ctx.destination && ctx.duration && (ctx.vehicleInterest || ctx.wantsPackage)) return 'RECOMMEND';
  if (ctx.destination && ctx.duration) return 'ASK_VEHICLE';
  if (ctx.destination) return 'ASK_DURATION';
  if (ctx.vehicleInterest && !ctx.destination) return 'VEHICLE_NO_DEST';
  if (ctx.cameraInterest && !ctx.destination) return 'CAMERA_NO_DEST';
  if (ctx.budgetMentioned) return 'PRICING';
  if (ctx.messageCount === 0) return 'GREETING';
  return 'CLARIFY';
}

/**
 * Generate a response appropriate to the conversation stage.
 * Each response naturally leads to the next question.
 */
function generateStageResponse(stage, ctx, rawMessage) {

  const packageData = {
    'Goa': { name: 'Goa Beach Escape', days: '4D/3N', price: '₹8,999', vehicle: 'Honda Activa scooty', highlights: 'Beach hopping, Old Goa heritage, Dudhsagar Falls, water sports' },
    'Manali': { name: 'Manali Adventure Trail', days: '5D/4N', price: '₹12,999', vehicle: 'Hyundai Creta SUV', highlights: 'Solang Valley, Rohtang Pass, Kasol, Old Manali' },
    'Kerala': { name: 'Kerala Backwater Bliss', days: '6D/5N', price: '₹15,999', vehicle: 'Honda City sedan', highlights: 'Munnar tea gardens, Alleppey houseboat, Kovalam beach' },
    'Munnar': { name: 'Kerala Backwater Bliss', days: '6D/5N', price: '₹15,999', vehicle: 'Honda City sedan', highlights: 'Tea plantations, Eravikulam Park, Mattupetty Dam' },
    'Ladakh': { name: 'Ladakh Explorer', days: '8D/7N', price: '₹22,999', vehicle: 'Royal Enfield Himalayan', highlights: 'Khardung La, Pangong Lake, Nubra Valley, Turtuk' },
    'Rajasthan': { name: 'Rajasthan Royal Circuit', days: '7D/6N', price: '₹19,999', vehicle: 'Hyundai Verna sedan', highlights: 'Jaipur forts, Udaipur lakes, Jaisalmer desert safari' },
    'Meghalaya': { name: 'Meghalaya Hidden Gems', days: '5D/4N', price: '₹14,999', vehicle: 'Kia Seltos SUV', highlights: 'Living root bridges, Dawki river, Laitlum Canyon' }
  };

  switch (stage) {

    case 'GREETING':
      return `👋 Hey there! I'm **WanderBot**, your personal travel planner!

I'd love to help you plan an amazing trip. To get started — **where are you dreaming of going?**

Some popular picks right now:
🏖️ Goa • 🏔️ Manali • 🏔️ Ladakh • 🌿 Kerala • 🏜️ Rajasthan • 🌄 Meghalaya

Or just tell me what vibe you're looking for — beaches, mountains, adventure, or culture! 🗺️`;

    case 'RESET':
      return `🔄 No problem, let's start fresh!

So, **where would you like to go?** Tell me a destination or what kind of trip you're in the mood for — I'll take it from there! ✨`;

    case 'ASK_DURATION': {
      const dest = ctx.destination;
      const pkg = packageData[dest];
      let response = `🎯 **${dest}** — great choice!`;

      if (pkg) {
        response += ` We have an amazing **${pkg.name}** package (${pkg.days}) that covers ${pkg.highlights}.`;
      }

      response += `\n\n**How many days** are you planning for? And is this a solo trip, couple's getaway, or a group adventure?`;
      return response;
    }

    case 'ASK_VEHICLE': {
      const dest = ctx.destination;
      const pkg = packageData[dest];
      const days = ctx.duration;
      const group = ctx.groupSize;

      let response = `Perfect — **${days} days in ${dest}**`;
      if (group) response += ` with ${group} ${group === 1 ? 'person' : 'people'}`;
      response += `! Here's what I'd recommend:\n\n`;

      // Smart vehicle suggestion based on destination + group
      if (dest === 'Ladakh' || dest === 'Spiti Valley') {
        response += `🏍️ **Royal Enfield Himalayan** (₹1,200/day) — The classic Ladakh ride, built for high-altitude passes\n`;
        if (group && group > 2) response += `🚗 **Mahindra Thar** (₹3,500/day) — If your group prefers 4 wheels on those mountain roads\n`;
      } else if (dest === 'Goa') {
        response += `🛵 **Honda Activa** (₹399/day) — Zip around beaches effortlessly\n🏍️ **RE Classic 350** (₹800/day) — Cruise the coastal roads in style\n`;
      } else if (group && group > 3) {
        response += `🚗 **Hyundai Creta** (₹2,500/day) — Spacious SUV for your group\n🚗 **Mahindra Thar** (₹3,500/day) — If you want the offroad experience\n`;
      } else {
        response += `🚗 **Honda City** (₹1,500/day) — Smooth highway comfort\n🚗 **Hyundai Creta** (₹2,500/day) — SUV for hill routes\n`;
      }

      if (pkg) {
        response += `\n📦 Or grab our **${pkg.name}** package (${pkg.days}) at **${pkg.price}/person** — includes a ${pkg.vehicle}!\n`;
      }

      response += `\nWhich option sounds good? Or would you like me to suggest camera gear too? 📸`;
      return response;
    }

    case 'RECOMMEND': {
      const dest = ctx.destination;
      const days = ctx.duration;
      const pkg = packageData[dest];
      const vehicle = ctx.vehicleInterest;

      let response = `Awesome, here's your trip summary! 📋\n\n`;
      response += `📍 **Destination:** ${dest}\n`;
      response += `📅 **Duration:** ${days} days\n`;
      if (ctx.groupSize) response += `👥 **Group:** ${ctx.groupSize} people\n`;

      if (vehicle === 'bike') {
        response += `🏍️ **Vehicle:** Royal Enfield Himalayan — ₹1,200/day\n`;
      } else if (vehicle === 'scooty') {
        response += `🛵 **Vehicle:** Honda Activa — ₹399/day\n`;
      } else if (vehicle === 'car') {
        response += `🚗 **Vehicle:** Hyundai Creta SUV — ₹2,500/day\n`;
      }

      if (ctx.cameraInterest) {
        response += `📸 **Camera:** GoPro Hero 12 — ₹800/day\n`;
      }

      const vehicleTotal = vehicle === 'bike' ? 1200 * days : vehicle === 'scooty' ? 399 * days : 2500 * days;
      const cameraTotal = ctx.cameraInterest ? 800 * days : 0;
      response += `\n💰 **Estimated Cost:** ₹${(vehicleTotal + cameraTotal).toLocaleString('en-IN')} (${days}-day rental)`;

      if (pkg) {
        response += `\n\n💡 **Pro tip:** Our **${pkg.name}** package at **${pkg.price}/person** includes the vehicle, accommodation & guided itinerary — better value!\n`;
      }

      response += `\n\nShall I **finalize this booking** for you? I'll just need your preferred dates! 🗓️`;
      return response;
    }

    case 'BOOKING': {
      const dest = ctx.destination;
      return `🎉 Let's lock in your **${dest}** trip!\n\nTo confirm your booking, you can:\n\n📱 **WhatsApp us:** +91-98765-43210 (instant confirmation)\n📞 **Call:** +91-98765-43210\n📧 **Email:** hello@wanderlustrentals.in\n\nOr share your **preferred dates** and **name** right here, and our team will reach out within 30 minutes!\n\n**10% early-bird discount** if you book 7+ days in advance! 🎁`;
    }

    case 'VEHICLE_NO_DEST': {
      const v = ctx.vehicleInterest;
      const vehicleNames = { car: 'self-drive car', bike: 'bike', scooty: 'scooty' };
      return `Great, you're looking for a **${vehicleNames[v] || 'vehicle'}**! 🚗\n\nTo suggest the perfect one, I need to know — **where are you headed?** Different terrains need different rides:\n\n🏔️ Mountains → SUV or RE Himalayan\n🏖️ Beaches → Scooty or hatchback\n🛣️ Highway → Sedan or cruiser bike\n\nTell me your destination and I'll match you with the ideal ride!`;
    }

    case 'CAMERA_NO_DEST':
      return `📸 Camera gear — love it! Here's our lineup:\n\n• **GoPro Hero 12** (₹800/day) — Waterproof, action shots\n• **Canon EOS R50** (₹2,000/day) — Travel photography\n• **Sony A6400** (₹2,500/day) — Vlogs & cinematic\n• **DJI Mini 4 Pro** (₹2,500/day) — Drone aerials\n\n**Where are you traveling?** I can suggest the perfect kit for your destination! 🎬`;

    case 'PRICING':
      return `💰 Here's our complete pricing:\n\n**🛵 Two-Wheelers:**\nActiva/Ntorq: ₹399-600/day\nRE Classic 350: ₹800-1,200/day\nRE Himalayan: ₹1,200-1,500/day\nKTM Duke: ₹1,000-1,800/day\n\n**🚗 Cars:**\nSwift/i20: ₹1,000-1,800/day\nCity/Verna: ₹1,500-2,500/day\nCreta/Seltos: ₹2,500-3,500/day\nThar: ₹3,500-4,500/day\n\n**📸 Cameras:**\nGoPro: ₹800/day | DSLR Kit: ₹1,500/day | Drone: ₹2,500/day\n\n🎁 **3+ days = 10% off | Vehicle + Camera = 15% off**\n\nWant a quote for a specific trip? Tell me your destination! 🗺️`;

    case 'CLARIFY':
    default: {
      // Check if the user seems to be answering a question naturally
      const msg = ctx.currentMessage;

      // Short affirmative responses
      if (msg.match(/^(yes|yeah|yep|sure|ok|okay|sounds good|go ahead|let'?s do it|absolutely|definitely)/)) {
        if (ctx.destination) {
          return generateStageResponse('RECOMMEND', ctx, rawMessage);
        }
        return `Great! So, what destination are you thinking about? 🗺️`;
      }

      // Negative responses  
      if (msg.match(/^(no|nah|not really|nope|skip|maybe later)/)) {
        if (ctx.destination) {
          return `No worries! Is there anything else about your **${ctx.destination}** trip I can help with? Maybe camera gear, route suggestions, or booking details? 😊`;
        }
        return `No problem! Whenever you're ready to plan a trip, I'm here. Just tell me a destination or what you're looking for! ✨`;
      }

      // "Thank you" type messages
      if (msg.match(/\b(thank|thanks|thx|tysm|appreciate)\b/)) {
        return `You're welcome! 😊 If you need anything else for your trip planning, I'm always here. Have an amazing journey! 🌟`;
      }

      // The user said something we can't parse — but DON'T reset!
      // Try to continue based on whatever context we have
      if (ctx.destination) {
        return `I'd love to help more with your **${ctx.destination}** plans! Could you tell me:\n\n• How many **days** you're planning for?\n• How many **people** in your group?\n• Interested in a **vehicle rental** or a **complete holiday package**?\n\nI'll put together a personalized recommendation! 🎯`;
      }

      return `I'd love to help you plan something awesome! 🌟\n\nYou can tell me:\n• A **destination** (like "Ladakh" or "Goa")\n• What you need (car, bike, camera, holiday package)\n• Or just describe your dream trip!\n\nI'll take it from there! 🗺️`;
    }
  }
}


// ─── Itinerary Generator ───────────────────────────────────────
// @route   POST /api/ai/itinerary
router.post('/itinerary', async (req, res) => {
  try {
    const { destination, duration, interests, groupSize, budget } = req.body;

    if (!destination || !duration) {
      return res.status(400).json({
        success: false,
        message: 'Destination and duration are required'
      });
    }

    const prompt = `Create a detailed ${duration}-day travel itinerary for ${destination}.
Group size: ${groupSize || '2 people'}
Budget: ${budget || 'moderate'}
Interests: ${interests || 'sightseeing, local food, adventure'}

Format each day as:
**Day X: [Title]**
- Morning: [Activity]
- Afternoon: [Activity]  
- Evening: [Activity]
- 🏨 Stay: [Accommodation suggestion]
- 🍽️ Must-try food: [Local dish]

Also recommend:
- Best vehicle for this trip from our fleet
- Camera gear suggestions
- Packing essentials
- Budget estimate per person`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.json({
        success: true,
        data: {
          itinerary: getSimulatedItinerary(destination, duration),
          isSimulated: true
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

    if (data.candidates && data.candidates[0]) {
      return res.json({
        success: true,
        data: {
          itinerary: data.candidates[0].content.parts[0].text,
          isSimulated: false
        }
      });
    }

    throw new Error('No response from AI');
  } catch (error) {
    console.error('AI Itinerary Error:', error);
    res.json({
      success: true,
      data: {
        itinerary: getSimulatedItinerary(req.body.destination, req.body.duration),
        isSimulated: true
      }
    });
  }
});

function getSimulatedItinerary(destination, duration) {
  return `# 🗺️ ${duration}-Day ${destination} Itinerary\n\n## Day 1: Arrival & Local Exploration\n- **Morning:** Arrive and check into your hotel\n- **Afternoon:** Visit local markets and landmarks\n- **Evening:** Sunset viewpoint & local cuisine\n- 🏨 Stay: Boutique hotel near city center\n- 🍽️ Must-try: Local street food tour\n\n## Day 2: Adventure Day\n- **Morning:** Nature trek or water sports\n- **Afternoon:** Visit heritage sites\n- **Evening:** Cultural show & dinner\n\n## Day 3: Scenic Drive\n- **Morning:** Self-drive to scenic spots\n- **Afternoon:** Photography session at viewpoints\n- **Evening:** Bonfire & stargazing\n\n---\n\n### 🚗 Recommended Vehicle\nSUV (e.g., Thar or Creta) for versatile terrain\n\n### 📸 Camera Suggestions\nMirrorless camera + wide-angle lens + GoPro for action shots\n\n### 💰 Budget Estimate\n~₹5,000-8,000 per person/day (including vehicle rental)\n\n*Contact us to customize this itinerary!*`;
}


// ─── Smart Recommendations ─────────────────────────────────────
// @route   POST /api/ai/recommend
router.post('/recommend', async (req, res) => {
  try {
    const { tripType, destination, duration, groupSize, terrain, budget } = req.body;
    const recommendations = getSmartRecommendations({ tripType, destination, duration, groupSize, terrain, budget });
    res.json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function getSmartRecommendations({ tripType, destination, duration, groupSize, terrain, budget }) {
  const recommendations = { vehicle: [], camera: [], tips: [] };

  const group = parseInt(groupSize) || 2;
  if (group > 4 || terrain === 'mountain' || terrain === 'offroad') {
    recommendations.vehicle.push({ type: 'SUV', suggestion: 'Mahindra Thar or Hyundai Creta', reason: 'Best for rough terrain and larger groups', priceRange: '₹2,500 - ₹4,500/day' });
  }
  if (group <= 4 && terrain !== 'offroad') {
    recommendations.vehicle.push({ type: 'Sedan', suggestion: 'Honda City or Hyundai Verna', reason: 'Comfortable for highway drives with good mileage', priceRange: '₹1,500 - ₹2,500/day' });
  }
  if (group <= 2) {
    recommendations.vehicle.push({ type: 'Bike', suggestion: 'Royal Enfield Himalayan', reason: 'Ultimate freedom for duo trips', priceRange: '₹800 - ₹1,500/day' });
  }

  recommendations.camera.push({ type: 'DSLR Kit', suggestion: 'Canon EOS 200D with 18-55mm + 55-250mm', reason: 'Versatile kit for landscapes, portraits, and wildlife' });
  if (tripType === 'adventure' || tripType === 'water') {
    recommendations.camera.push({ type: 'Action Camera', suggestion: 'GoPro Hero 12', reason: 'Waterproof and perfect for action shots' });
  }

  recommendations.tips = [
    'Book 3+ days for 10% discount on vehicle rentals',
    'Combo deal: Vehicle + Camera at 15% off',
    'Early booking (7+ days ahead) saves up to 20%'
  ];

  return recommendations;
}

module.exports = router;
