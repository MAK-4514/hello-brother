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
const SYSTEM_PROMPT = `You are **BrotherBot**, the friendly AI travel concierge for **Hello Brother** — India's premium self-drive rental and holiday package platform.

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
    const reply = getContextAwareResponse(req.body.message, req.body.conversationHistory || []);
    res.json({
      success: true,
      data: { reply, isSimulated: true }
    });
  }
});


// ─── Gemini API Caller ─────────────────────────────────────────
async function callGeminiAPI(apiKey, message, conversationHistory) {
  const contents = [];
  for (const msg of conversationHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.8, maxOutputTokens: 1024, topP: 0.95 }
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

function getContextAwareResponse(message, conversationHistory = []) {
  const context = extractContext(message, conversationHistory);
  const stage = determineConversationStage(context);
  return generateStageResponse(stage, context, message);
}

/**
 * Extract conversation context from ALL messages.
 */
function extractContext(currentMessage, history) {
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
    specificVehicle: null,
    cameraInterest: false,
    budgetMentioned: false,
    wantsPackage: false,
    wantsToBook: false,
    isGreeting: false,
    wantsReset: false,
    currentIntent: null,
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

  // ── Comprehensive destination list (150+ Indian destinations) ──
  const destinationList = [
    // States
    { pattern: /\bgujarat\b/, name: 'Gujarat' },
    { pattern: /\brajasthan\b/, name: 'Rajasthan' },
    { pattern: /\bkerala\b/, name: 'Kerala' },
    { pattern: /\bgoa\b/, name: 'Goa' },
    { pattern: /\bhimachal\b/, name: 'Himachal Pradesh' },
    { pattern: /\buttarakhand\b/, name: 'Uttarakhand' },
    { pattern: /\bsikkim\b/, name: 'Sikkim' },
    { pattern: /\bmeghalaya\b/, name: 'Meghalaya' },
    { pattern: /\bassam\b/, name: 'Assam' },
    { pattern: /\bnagaland\b/, name: 'Nagaland' },
    { pattern: /\barunachal\b/, name: 'Arunachal Pradesh' },
    { pattern: /\bkarnataka\b/, name: 'Karnataka' },
    { pattern: /\btamil\s*nadu\b/, name: 'Tamil Nadu' },
    { pattern: /\bmaharashtra\b/, name: 'Maharashtra' },
    { pattern: /\btelangana\b/, name: 'Telangana' },
    { pattern: /\bandhra\b/, name: 'Andhra Pradesh' },
    { pattern: /\bodisha\b/, name: 'Odisha' },
    { pattern: /\bwest\s*bengal\b/, name: 'West Bengal' },
    { pattern: /\bmadhya\s*pradesh\b/, name: 'Madhya Pradesh' },
    { pattern: /\buttar\s*pradesh\b/, name: 'Uttar Pradesh' },
    { pattern: /\bpunjab\b/, name: 'Punjab' },
    { pattern: /\bjammu\b/, name: 'Jammu & Kashmir' },
    { pattern: /\bkashmir\b/, name: 'Kashmir' },
    // Gujarat Cities
    { pattern: /\bahmedabad\b/, name: 'Ahmedabad' },
    { pattern: /\bkutch\b/, name: 'Kutch' },
    { pattern: /\brann\b/, name: 'Rann of Kutch' },
    { pattern: /\bdwarka\b/, name: 'Dwarka' },
    { pattern: /\bsomnath\b/, name: 'Somnath' },
    { pattern: /\bgir\b/, name: 'Gir' },
    { pattern: /\bsurat\b/, name: 'Surat' },
    { pattern: /\bvadodara\b/, name: 'Vadodara' },
    { pattern: /\brajkot\b/, name: 'Rajkot' },
    { pattern: /\bsaputara\b/, name: 'Saputara' },
    { pattern: /\bdiu\b/, name: 'Diu' },
    { pattern: /\bdaman\b/, name: 'Daman' },
    { pattern: /\bstatue of unity\b/, name: 'Statue of Unity' },
    // Ladakh / J&K
    { pattern: /\bladakh\b/, name: 'Ladakh' },
    { pattern: /\bleh\b/, name: 'Ladakh' },
    { pattern: /\bsrinagar\b/, name: 'Srinagar' },
    { pattern: /\bpahalgam\b/, name: 'Pahalgam' },
    { pattern: /\bgulmarg\b/, name: 'Gulmarg' },
    { pattern: /\bsonmarg\b/, name: 'Sonmarg' },
    // Himachal
    { pattern: /\bmanali\b/, name: 'Manali' },
    { pattern: /\bshimla\b/, name: 'Shimla' },
    { pattern: /\bkasol\b/, name: 'Kasol' },
    { pattern: /\bmcleodganj\b/, name: 'McLeodganj' },
    { pattern: /\bdharamshala\b/, name: 'Dharamshala' },
    { pattern: /\bspiti\b/, name: 'Spiti Valley' },
    { pattern: /\bkullu\b/, name: 'Kullu' },
    { pattern: /\bdalhousie\b/, name: 'Dalhousie' },
    // Uttarakhand
    { pattern: /\brishikesh\b/, name: 'Rishikesh' },
    { pattern: /\bharidwar\b/, name: 'Haridwar' },
    { pattern: /\bnainital\b/, name: 'Nainital' },
    { pattern: /\bmussoorie\b/, name: 'Mussoorie' },
    { pattern: /\bdehradun\b/, name: 'Dehradun' },
    { pattern: /\bjim\s*corbett\b/, name: 'Jim Corbett' },
    { pattern: /\bauli\b/, name: 'Auli' },
    // Rajasthan Cities
    { pattern: /\bjaipur\b/, name: 'Jaipur' },
    { pattern: /\budaipur\b/, name: 'Udaipur' },
    { pattern: /\bjodhpur\b/, name: 'Jodhpur' },
    { pattern: /\bjaisalmer\b/, name: 'Jaisalmer' },
    { pattern: /\bpushkar\b/, name: 'Pushkar' },
    { pattern: /\bmount\s*abu\b/, name: 'Mount Abu' },
    { pattern: /\branthambore\b/, name: 'Ranthambore' },
    { pattern: /\bbikaner\b/, name: 'Bikaner' },
    // Kerala Cities
    { pattern: /\bmunnar\b/, name: 'Munnar' },
    { pattern: /\balleppey\b/, name: 'Alleppey' },
    { pattern: /\bkovalam\b/, name: 'Kovalam' },
    { pattern: /\bvarkala\b/, name: 'Varkala' },
    { pattern: /\bkochi\b/, name: 'Kochi' },
    { pattern: /\bwayanad\b/, name: 'Wayanad' },
    // Karnataka
    { pattern: /\bcoorg\b/, name: 'Coorg' },
    { pattern: /\bhampi\b/, name: 'Hampi' },
    { pattern: /\bmysore\b/, name: 'Mysore' },
    { pattern: /\bbangalore\b/, name: 'Bangalore' },
    { pattern: /\bgokarna\b/, name: 'Gokarna' },
    { pattern: /\bchikmagalur\b/, name: 'Chikmagalur' },
    // Tamil Nadu
    { pattern: /\booty\b/, name: 'Ooty' },
    { pattern: /\bkodaikanal\b/, name: 'Kodaikanal' },
    { pattern: /\bchennai\b/, name: 'Chennai' },
    { pattern: /\brameshwaram\b/, name: 'Rameshwaram' },
    { pattern: /\bkanyakumari\b/, name: 'Kanyakumari' },
    { pattern: /\bmadurai\b/, name: 'Madurai' },
    // Maharashtra
    { pattern: /\bmumbai\b/, name: 'Mumbai' },
    { pattern: /\bpune\b/, name: 'Pune' },
    { pattern: /\blonavala\b/, name: 'Lonavala' },
    { pattern: /\bmahabaleshwar\b/, name: 'Mahabaleshwar' },
    { pattern: /\bnashik\b/, name: 'Nashik' },
    { pattern: /\baurangabad\b/, name: 'Aurangabad' },
    // Northeast
    { pattern: /\bshillong\b/, name: 'Shillong' },
    { pattern: /\bcherrapunji\b/, name: 'Cherrapunji' },
    { pattern: /\btawang\b/, name: 'Tawang' },
    { pattern: /\bkaziranga\b/, name: 'Kaziranga' },
    { pattern: /\bdarjeeling\b/, name: 'Darjeeling' },
    { pattern: /\bgangtok\b/, name: 'Gangtok' },
    // Islands
    { pattern: /\bandaman\b/, name: 'Andaman' },
    { pattern: /\blakshadweep\b/, name: 'Lakshadweep' },
    // Others
    { pattern: /\bvaranasi\b/, name: 'Varanasi' },
    { pattern: /\bagra\b/, name: 'Agra' },
    { pattern: /\blucknow\b/, name: 'Lucknow' },
    { pattern: /\bpondicherry\b/, name: 'Pondicherry' },
    { pattern: /\bdelhi\b/, name: 'Delhi' },
    { pattern: /\bchandigarh\b/, name: 'Chandigarh' },
    { pattern: /\bamritsar\b/, name: 'Amritsar' },
    { pattern: /\bhyderabad\b/, name: 'Hyderabad' },
    { pattern: /\bvizag\b/, name: 'Visakhapatnam' },
    { pattern: /\btirupati\b/, name: 'Tirupati' },
    { pattern: /\bkolkata\b/, name: 'Kolkata' },
    { pattern: /\bpuri\b/, name: 'Puri' },
    { pattern: /\bbhopal\b/, name: 'Bhopal' },
    { pattern: /\bindore\b/, name: 'Indore' }
  ];

  // Scan user messages newest-first for destination
  const userTextsNewestFirst = [...userMessages].reverse();
  for (const uText of userTextsNewestFirst) {
    for (const { pattern, name } of destinationList) {
      if (pattern.test(uText)) {
        ctx.destination = name;
        break;
      }
    }
    if (ctx.destination) break;
  }

  // ── CATCH-ALL: Extract destination from natural phrases ──
  if (!ctx.destination) {
    const catchAllPatterns = [
      /(?:go\s+to|visit|travel\s+to|trip\s+to|heading\s+to|going\s+to|explore|planning\s+(?:for|to\s+go\s+to))\s+([a-z][a-z\s]{1,30}?)(?:\s*[.,!?]|$)/i,
      /(?:i\s+(?:want|like|love|prefer)|let'?s\s+go)\s+(?:to\s+)?([a-z][a-z\s]{1,25}?)(?:\s*[.,!?]|$)/i
    ];
    for (const p of catchAllPatterns) {
      const match = currentMsg.match(p);
      if (match) {
        let extracted = match[1].trim();
        const nonDestWords = ['there', 'somewhere', 'anywhere', 'a trip', 'a place', 'some place', 'beach', 'mountain', 'hill', 'the'];
        if (!nonDestWords.includes(extracted.toLowerCase())) {
          ctx.destination = extracted.replace(/\b\w/g, c => c.toUpperCase());
          break;
        }
      }
    }
  }

  // ── Duration (user messages only) ──
  const userText = userMessages.join(' ');
  const durationMatch = userText.match(/(\d+)\s*(?:days?|nights?|d\/|d\s*[\/\-]\s*\d+\s*n)/i);
  if (durationMatch) ctx.duration = parseInt(durationMatch[1]);
  if (userText.match(/\b(weekend|2\s*days?|short trip)\b/)) ctx.duration = ctx.duration || 2;
  if (userText.match(/\b(week|7\s*days?|one week)\b/)) ctx.duration = ctx.duration || 7;
  if (userText.match(/\b(long weekend|3\s*days?|4\s*days?)\b/)) ctx.duration = ctx.duration || 4;

  // ── Group size (user messages only) ──
  const groupMatch = userText.match(/(\d+)\s*(?:people|persons?|friends?|of us|members?|pax)/i);
  if (groupMatch) ctx.groupSize = parseInt(groupMatch[1]) + (groupMatch[0].includes('friend') ? 1 : 0);
  if (userText.match(/\b(solo|alone|myself)\b/)) ctx.groupSize = 1;
  if (userText.match(/\b(couple|two of us|partner|wife|husband|girlfriend|boyfriend)\b/)) ctx.groupSize = 2;
  if (userText.match(/\b(family|parents|kids|children)\b/)) ctx.groupSize = ctx.groupSize || 4;

  // ── Specific Vehicle Detection (full vehicle catalog) ──
  // Priority: detect SPECIFIC vehicle name first, then fall back to category
  const vehicleCatalog = [
    { pattern: /\b(?:mahindra\s*)?thar\b/i, name: 'Mahindra Thar', category: 'car', price: 3500, emoji: '🚗' },
    { pattern: /\b(?:hyundai\s*)?creta\b/i, name: 'Hyundai Creta', category: 'car', price: 2500, emoji: '🚗' },
    { pattern: /\b(?:kia\s*)?seltos\b/i, name: 'Kia Seltos', category: 'car', price: 2800, emoji: '🚗' },
    { pattern: /\b(?:honda\s*)?city\b/i, name: 'Honda City', category: 'car', price: 1500, emoji: '🚗' },
    { pattern: /\b(?:hyundai\s*)?verna\b/i, name: 'Hyundai Verna', category: 'car', price: 2000, emoji: '🚗' },
    { pattern: /\b(?:maruti\s*)?swift\b/i, name: 'Maruti Swift', category: 'car', price: 1200, emoji: '🚗' },
    { pattern: /\b(?:hyundai\s*)?i20\b/i, name: 'Hyundai i20', category: 'car', price: 1400, emoji: '🚗' },
    { pattern: /\bhimalayan\b/i, name: 'Royal Enfield Himalayan', category: 'bike', price: 1200, emoji: '🏍️' },
    { pattern: /\b(?:re\s*)?classic\s*350\b/i, name: 'Royal Enfield Classic 350', category: 'bike', price: 800, emoji: '🏍️' },
    { pattern: /\bbullet\b/i, name: 'Royal Enfield Bullet', category: 'bike', price: 800, emoji: '🏍️' },
    { pattern: /\b(?:royal\s*)?enfield\b/i, name: 'Royal Enfield', category: 'bike', price: 1000, emoji: '🏍️' },
    { pattern: /\bktm(?:\s*duke)?\b/i, name: 'KTM Duke 390', category: 'bike', price: 1200, emoji: '🏍️' },
    { pattern: /\bduke\b/i, name: 'KTM Duke 390', category: 'bike', price: 1200, emoji: '🏍️' },
    { pattern: /\bactiva\b/i, name: 'Honda Activa', category: 'scooty', price: 399, emoji: '🛵' },
    { pattern: /\bntorq\b/i, name: 'TVS Ntorq', category: 'scooty', price: 500, emoji: '🛵' },
    { pattern: /\bvespa\b/i, name: 'Vespa', category: 'scooty', price: 600, emoji: '🛵' }
  ];

  // Scan CURRENT message first for specific vehicle (most recent intent)
  for (const v of vehicleCatalog) {
    if (v.pattern.test(currentMsg)) {
      ctx.specificVehicle = v;
      ctx.vehicleInterest = v.category;
      break;
    }
  }

  // If not found in current message, scan all user messages
  if (!ctx.specificVehicle) {
    for (const v of vehicleCatalog) {
      if (v.pattern.test(userText)) {
        ctx.specificVehicle = v;
        ctx.vehicleInterest = v.category;
        break;
      }
    }
  }

  // Fallback: detect broad category if no specific vehicle found
  if (!ctx.vehicleInterest) {
    if (userText.match(/\b(car|suv|sedan|hatchback|four wheel|4x4)\b/)) ctx.vehicleInterest = 'car';
    if (userText.match(/\b(bike|motorcycle)\b/)) ctx.vehicleInterest = 'bike';
    if (userText.match(/\b(scooty|scooter|two wheeler)\b/)) ctx.vehicleInterest = 'scooty';
  }

  // ── Camera interest (user messages only) ──
  ctx.cameraInterest = !!userText.match(/\b(camera|photo|video|gopro|drone|dslr|mirrorless|shoot|photography|vlog)\b/);

  // ── Budget interest (user messages only) ──
  ctx.budgetMentioned = !!userText.match(/\b(price|cost|budget|cheap|expensive|afford|how much|rate)\b/);

  // ── Package interest (user messages only) ──
  ctx.wantsPackage = !!userText.match(/\b(package|holiday|itinerary|plan my|trip plan|tour|all.?inclusive)\b/);

  // ── Booking intent (ONLY current message) ──
  ctx.wantsToBook = !!currentMsg.match(/\b(book|reserve|confirm|finalize|proceed|payment|whatsapp|call me|let'?s do it|lock it in)\b/);

  // ── Current turn intent analysis ──
  // Detect what the user is SPECIFICALLY asking for RIGHT NOW
  const isVehicleSelection = !!currentMsg.match(/\b(i\s+(?:need|want|prefer|choose|pick|select|go\s+with|take)|give\s+me|let'?s\s+go\s+with|i'?ll\s+take)\b/) && ctx.specificVehicle && currentMsg.match(ctx.specificVehicle.pattern);
  const isVehicleMention = !!currentMsg.match(/\b(thar|creta|seltos|city|verna|swift|himalayan|classic|bullet|enfield|ktm|duke|activa|ntorq)\b/i);
  const isDestChange = ctx.destination && ctx.messageCount > 0 && !!currentMsg.match(/\b(actually|instead|change|switch|rather|no\s+i\s+want|let'?s\s+go\s+to|how\s+about)\b/);

  if (isVehicleSelection || (isVehicleMention && ctx.destination && ctx.duration)) {
    ctx.currentIntent = 'VEHICLE_SELECTION';
  }
  if (isDestChange) {
    ctx.currentIntent = 'DESTINATION_CHANGE';
  }

  return ctx;
}

/**
 * Determine conversation stage based on current message intent + accumulated context.
 */
function determineConversationStage(ctx) {
  if (ctx.wantsReset) return 'RESET';
  if (ctx.isGreeting) return 'GREETING';

  const currentMsg = ctx.currentMessage;
  const isCameraQuestion = !!currentMsg.match(/\b(camera|photo|video|gopro|drone|dslr|mirrorless|shoot|photography|vlog|lens)\b/);
  const isPriceQuestion = !!currentMsg.match(/\b(price|cost|budget|cheap|expensive|afford|how much|rate)\b/);
  const isGreetingNow = !!currentMsg.match(/^(hi|hello|hey|yo|hola|namaste|sup)\b/);

  // ── Priority 1: Mid-conversation greeting ──
  if (isGreetingNow && ctx.messageCount > 0 && ctx.destination) return 'MID_GREETING';

  // ── Priority 2: Current-turn specific intents (what user is asking RIGHT NOW) ──
  if (ctx.currentIntent === 'VEHICLE_SELECTION' && ctx.destination) return 'VEHICLE_SELECTION';
  if (ctx.currentIntent === 'DESTINATION_CHANGE') return 'ASK_DURATION';

  // ── Priority 3: Topic-specific questions ──
  if (isCameraQuestion) return ctx.destination ? 'CAMERA_WITH_DEST' : 'CAMERA_NO_DEST';
  if (isPriceQuestion) return 'PRICING';
  if (ctx.wantsToBook && ctx.destination) return 'BOOKING';

  // ── Priority 4: Conversation progression ──
  if (ctx.destination && ctx.duration && (ctx.vehicleInterest || ctx.wantsPackage)) return 'RECOMMEND';
  if (ctx.destination && ctx.duration) return 'ASK_VEHICLE';
  if (ctx.destination) return 'ASK_DURATION';
  if (ctx.vehicleInterest && !ctx.destination) return 'VEHICLE_NO_DEST';
  if (ctx.budgetMentioned) return 'PRICING';
  if (ctx.messageCount === 0) return 'GREETING';
  return 'CLARIFY';
}

/**
 * Generate response for the conversation stage.
 */
function generateStageResponse(stage, ctx, rawMessage) {

  const packageData = {
    'Goa': { name: 'Goa Beach Escape', days: '4D/3N', price: '₹8,999', vehicle: 'Honda Activa scooty', highlights: 'Beach hopping, Old Goa heritage, Dudhsagar Falls, water sports' },
    'Manali': { name: 'Manali Adventure Trail', days: '5D/4N', price: '₹12,999', vehicle: 'Hyundai Creta SUV', highlights: 'Solang Valley, Rohtang Pass, Kasol, Old Manali' },
    'Kerala': { name: 'Kerala Backwater Bliss', days: '6D/5N', price: '₹15,999', vehicle: 'Honda City sedan', highlights: 'Munnar tea gardens, Alleppey houseboat, Kovalam beach' },
    'Munnar': { name: 'Kerala Backwater Bliss', days: '6D/5N', price: '₹15,999', vehicle: 'Honda City sedan', highlights: 'Tea plantations, Eravikulam Park, Mattupetty Dam' },
    'Ladakh': { name: 'Ladakh Explorer', days: '8D/7N', price: '₹22,999', vehicle: 'Royal Enfield Himalayan', highlights: 'Khardung La, Pangong Lake, Nubra Valley, Turtuk' },
    'Rajasthan': { name: 'Rajasthan Royal Circuit', days: '7D/6N', price: '₹19,999', vehicle: 'Hyundai Verna sedan', highlights: 'Jaipur forts, Udaipur lakes, Jaisalmer desert safari' },
    'Meghalaya': { name: 'Meghalaya Hidden Gems', days: '5D/4N', price: '₹14,999', vehicle: 'Kia Seltos SUV', highlights: 'Living root bridges, Dawki river, Laitlum Canyon' },
    'Gujarat': { name: 'Gujarat Heritage Trail', days: '6D/5N', price: '₹14,999', vehicle: 'Hyundai Creta SUV', highlights: 'Rann of Kutch, Gir National Park, Somnath Temple, Dwarka, Statue of Unity' },
    'Kutch': { name: 'Rann of Kutch Experience', days: '4D/3N', price: '₹10,999', vehicle: 'Mahindra Thar', highlights: 'White Rann, Kutch Desert Wildlife, Bhuj handicraft villages, Kalo Dungar' },
    'Rann of Kutch': { name: 'Rann of Kutch Experience', days: '4D/3N', price: '₹10,999', vehicle: 'Mahindra Thar', highlights: 'White Rann full moon night, desert safari, Kutch handicrafts' },
    'Dwarka': { name: 'Dwarka Spiritual Circuit', days: '3D/2N', price: '₹7,999', vehicle: 'Honda City sedan', highlights: 'Dwarkadhish Temple, Nageshwar Jyotirlinga, Bet Dwarka' },
    'Gir': { name: 'Gir Safari Adventure', days: '3D/2N', price: '₹9,999', vehicle: 'Mahindra Thar', highlights: 'Asiatic Lion safari, Kamleshwar Dam, Somnath Temple' },
    'Ahmedabad': { name: 'Ahmedabad Culture Walk', days: '3D/2N', price: '₹6,999', vehicle: 'Honda City sedan', highlights: 'Sabarmati Ashram, Adalaj Stepwell, heritage old city walk, street food' },
    'Statue of Unity': { name: 'Statue of Unity Weekend', days: '2D/1N', price: '₹5,999', vehicle: 'Hyundai Creta SUV', highlights: 'Statue of Unity, Valley of Flowers, Sardar Sarovar Dam' },
    'Diu': { name: 'Diu Island Escape', days: '3D/2N', price: '₹7,999', vehicle: 'Honda Activa scooty', highlights: 'Diu Fort, Nagoa Beach, Naida Caves' },
    'Kashmir': { name: 'Kashmir Paradise', days: '6D/5N', price: '₹18,999', vehicle: 'Hyundai Creta SUV', highlights: 'Dal Lake shikara, Gulmarg gondola, Pahalgam valley, Sonmarg' },
    'Srinagar': { name: 'Srinagar Houseboat Stay', days: '4D/3N', price: '₹12,999', vehicle: 'Hyundai Creta SUV', highlights: 'Dal Lake houseboat, Nishat Bagh, Mughal Gardens' },
    'Gulmarg': { name: 'Gulmarg Snow Adventure', days: '3D/2N', price: '₹11,999', vehicle: 'Mahindra Thar', highlights: 'Gondola ride, skiing, Alpather Lake' },
    'Sikkim': { name: 'Sikkim Himalayan Explorer', days: '6D/5N', price: '₹16,999', vehicle: 'Kia Seltos SUV', highlights: 'Gangtok, Nathula Pass, Tsomgo Lake, Pelling' },
    'Gangtok': { name: 'Gangtok Discovery', days: '4D/3N', price: '₹12,999', vehicle: 'Kia Seltos SUV', highlights: 'MG Marg, Rumtek Monastery, Tsomgo Lake' },
    'Andaman': { name: 'Andaman Island Hopper', days: '6D/5N', price: '₹19,999', vehicle: 'Honda Activa scooty', highlights: 'Radhanagar Beach, scuba diving, Ross Island, Cellular Jail' },
    'Rishikesh': { name: 'Rishikesh Adventure Camp', days: '3D/2N', price: '₹6,999', vehicle: 'Royal Enfield Classic', highlights: 'River rafting, bungee jumping, Laxman Jhula, camping' },
    'Varanasi': { name: 'Varanasi Spiritual Walk', days: '3D/2N', price: '₹7,999', vehicle: 'Honda City sedan', highlights: 'Ganga Aarti, Kashi Vishwanath, Sarnath, boat ride' },
    'Jaipur': { name: 'Jaipur Royal Heritage', days: '3D/2N', price: '₹8,999', vehicle: 'Hyundai Verna sedan', highlights: 'Amber Fort, Hawa Mahal, City Palace, Nahargarh' },
    'Udaipur': { name: 'Udaipur Lake City', days: '3D/2N', price: '₹9,999', vehicle: 'Hyundai Verna sedan', highlights: 'City Palace, Lake Pichola, Monsoon Palace' },
    'Shimla': { name: 'Shimla Hill Retreat', days: '4D/3N', price: '₹10,999', vehicle: 'Hyundai Creta SUV', highlights: 'Mall Road, Kufri, Jakhu Temple, toy train' },
    'Darjeeling': { name: 'Darjeeling Tea Trail', days: '4D/3N', price: '₹11,999', vehicle: 'Kia Seltos SUV', highlights: 'Tiger Hill sunrise, tea gardens, Batasia Loop' },
    'Coorg': { name: 'Coorg Coffee Country', days: '3D/2N', price: '₹9,999', vehicle: 'Hyundai Creta SUV', highlights: 'Abbey Falls, coffee plantations, Dubare elephant camp' },
    'Hampi': { name: 'Hampi Heritage Trail', days: '3D/2N', price: '₹7,999', vehicle: 'Royal Enfield Classic', highlights: 'Virupaksha Temple, stone chariot, Hampi bazaar ruins' },
    'Pondicherry': { name: 'Pondicherry French Quarter', days: '3D/2N', price: '₹7,999', vehicle: 'Honda Activa scooty', highlights: 'French Quarter, Auroville, Paradise Beach' },
    'Ooty': { name: 'Ooty Nilgiri Bliss', days: '3D/2N', price: '₹8,999', vehicle: 'Hyundai Creta SUV', highlights: 'Botanical Garden, Ooty Lake, Doddabetta Peak' },
    'Amritsar': { name: 'Amritsar Golden Experience', days: '3D/2N', price: '₹7,999', vehicle: 'Honda City sedan', highlights: 'Golden Temple, Wagah Border, Jallianwala Bagh' },
    'Agra': { name: 'Agra Heritage Trip', days: '2D/1N', price: '₹4,999', vehicle: 'Hyundai Verna sedan', highlights: 'Taj Mahal, Agra Fort, Fatehpur Sikri' },
    'Spiti Valley': { name: 'Spiti Valley Expedition', days: '8D/7N', price: '₹24,999', vehicle: 'Royal Enfield Himalayan', highlights: 'Key Monastery, Chandratal Lake, Kunzum Pass' }
  };

  // Helper: categorize destination type for dynamic responses
  function getDestinationType(dest) {
    const d = dest.toLowerCase();
    const mountains = ['himachal pradesh','uttarakhand','shimla','manali','kasol','mcleodganj','dharamshala','kullu','dalhousie','mussoorie','nainital','auli','ladakh','spiti valley','srinagar','gulmarg','pahalgam','sonmarg','kashmir','jammu & kashmir','sikkim','gangtok','pelling','darjeeling','tawang','ooty','kodaikanal','coorg','chikmagalur','mount abu','saputara','lonavala','mahabaleshwar','munnar','wayanad'];
    const beaches = ['goa','gokarna','andaman','lakshadweep','kovalam','varkala','alleppey','pondicherry','diu','daman','rameshwaram','kanyakumari','puri','visakhapatnam'];
    const heritage = ['rajasthan','jaipur','udaipur','jodhpur','jaisalmer','pushkar','bikaner','varanasi','agra','lucknow','hampi','mysore','madurai','delhi','aurangabad','amritsar','kolkata','ahmedabad'];
    const wildlife = ['gir','ranthambore','jim corbett','kaziranga','thekkady'];
    const spiritual = ['dwarka','somnath','varanasi','rishikesh','haridwar','tirupati','amritsar','rameshwaram','kanyakumari'];
    const desert = ['kutch','rann of kutch','jaisalmer'];
    if (desert.includes(d)) return 'desert';
    if (wildlife.includes(d)) return 'wildlife';
    if (spiritual.includes(d)) return 'spiritual';
    if (mountains.includes(d)) return 'mountain';
    if (beaches.includes(d)) return 'beach';
    if (heritage.includes(d)) return 'heritage';
    return 'general';
  }

  switch (stage) {

    case 'GREETING':
      return `👋 Hey there! I'm **BrotherBot**, your personal travel planner!\n\nI'd love to help you plan an amazing trip. To get started — **where are you dreaming of going?**\n\nSome popular picks right now:\n🏖️ Goa • 🏔️ Manali • 🏔️ Ladakh • 🌿 Kerala • 🏜️ Rajasthan • 🌄 Gujarat\n\nOr just tell me what vibe you're looking for — beaches, mountains, desert, adventure, or culture! 🗺️`;

    case 'RESET':
      return `🔄 No problem, let's start fresh!\n\nSo, **where would you like to go?** Tell me a destination or what kind of trip you're in the mood for — I'll take it from there! ✨`;

    case 'MID_GREETING': {
      const dest = ctx.destination;
      const sv = ctx.specificVehicle;
      return `👋 Hey again! Still working on your **${dest}** trip plan? 😊\n\nHere's what I have so far:\n📍 Destination: **${dest}**${ctx.duration ? `\n📅 Duration: **${ctx.duration} days**` : ''}${ctx.groupSize ? `\n👥 Group: **${ctx.groupSize} people**` : ''}${sv ? `\n${sv.emoji} Vehicle: **${sv.name}**` : ctx.vehicleInterest ? `\n🚗 Vehicle: **${ctx.vehicleInterest}**` : ''}\n\nWhat else would you like to know? I can help with vehicle options, camera gear, pricing, or finalize a booking! 🗺️`;
    }

    case 'CAMERA_WITH_DEST': {
      const dest = ctx.destination;
      const dtype = getDestinationType(dest);
      let response = `📸 Great idea to capture your **${dest}** trip! Here's what I'd recommend:\n\n`;

      if (dtype === 'mountain') {
        response += `• **GoPro Hero 12** (₹800/day) — Must-have for mountain passes & adventure\n• **DJI Mini 4 Pro Drone** (₹2,500/day) — Aerial shots of valleys & peaks\n• **Sony A6400 Kit** (₹2,500/day) — Stunning landscape photography\n\n💡 **Pro tip for ${dest}:** Extra batteries are a must — cold weather drains them fast!`;
      } else if (dtype === 'beach') {
        response += `• **GoPro Hero 12** (₹800/day) — Waterproof for beach & water sports\n• **Canon EOS R50** (₹2,000/day) — Beautiful sunset & portrait shots\n• **DJI Mini 4 Pro Drone** (₹2,500/day) — Stunning coastline aerials\n\n💡 **Pro tip for ${dest}:** Get a waterproof bag — humidity can damage gear!`;
      } else if (dtype === 'desert') {
        response += `• **Canon EOS R50** (₹2,000/day) — Capture the vast desert landscape\n• **DJI Mini 4 Pro Drone** (₹2,500/day) — Desert from above is breathtaking\n• **GoPro Hero 12** (₹800/day) — Camel safari & camping shots\n\n💡 **Pro tip for ${dest}:** Bring a dustproof bag — sand gets everywhere!`;
      } else if (dtype === 'wildlife') {
        response += `• **Canon EOS R50 + 70-300mm Lens** (₹3,000/day) — Wildlife zoom shots\n• **Sony A6400** (₹2,500/day) — Fast autofocus for animals\n• **GoPro Hero 12** (₹800/day) — Safari POV footage\n\n💡 **Pro tip for ${dest}:** Early morning safaris = best lighting!`;
      } else {
        response += `• **Canon EOS R50 Kit** (₹2,000/day) — Versatile travel photography\n• **GoPro Hero 12** (₹800/day) — Action & adventure shots\n• **DJI Mini 4 Pro Drone** (₹2,500/day) — Aerial masterpieces`;
      }

      response += `\n\n🎁 **Combo deal:** Vehicle + Camera = **15% off** total rental!\n\nWant me to add any of these to your **${dest}** trip? 🎬`;
      return response;
    }

    case 'ASK_DURATION': {
      const dest = ctx.destination;
      const pkg = packageData[dest];
      let response = `🎯 **${dest}** — great choice!`;

      if (pkg) {
        response += ` We have an amazing **${pkg.name}** package (${pkg.days}) that covers ${pkg.highlights}.`;
      } else {
        const dtype = getDestinationType(dest);
        const vibes = { mountain: 'The mountain views and adventure there are incredible!', beach: 'The beaches and coastal vibes there are absolutely stunning!', heritage: 'The history and architecture there is awe-inspiring!', desert: 'The desert landscape and culture there is truly unique!', wildlife: 'The wildlife and nature there is spectacular!', spiritual: 'The spiritual energy and temples there are deeply moving!', general: 'That sounds like an amazing destination!' };
        response += ` ${vibes[dtype] || vibes.general} We can arrange a self-drive vehicle for you to explore at your own pace.`;
      }

      response += `\n\n**How many days** are you planning for? And is this a solo trip, couple's getaway, or a group adventure?`;
      return response;
    }

    case 'ASK_VEHICLE': {
      const dest = ctx.destination;
      const pkg = packageData[dest];
      const days = ctx.duration;
      const group = ctx.groupSize;
      const dtype = getDestinationType(dest);

      let response = `Perfect — **${days} days in ${dest}**`;
      if (group) response += ` with ${group} ${group === 1 ? 'person' : 'people'}`;
      response += `! Here's what I'd recommend:\n\n`;

      if (dtype === 'mountain') {
        response += `🏍️ **Royal Enfield Himalayan** (₹1,200/day) — Built for high-altitude passes\n`;
        if (group && group > 2) response += `🚗 **Mahindra Thar** (₹3,500/day) — If your group prefers 4 wheels on mountain roads\n`;
        response += `🚗 **Hyundai Creta** (₹2,500/day) — Comfortable SUV for mountain highways\n`;
      } else if (dtype === 'beach') {
        response += `🛵 **Honda Activa** (₹399/day) — Zip around beaches effortlessly\n🏍️ **RE Classic 350** (₹800/day) — Cruise the coastal roads in style\n`;
        if (group && group > 2) response += `🚗 **Swift** (₹1,200/day) — Great for group beach hopping\n`;
      } else if (dtype === 'desert') {
        response += `🚗 **Mahindra Thar** (₹3,500/day) — The ultimate desert machine\n🚗 **Hyundai Creta** (₹2,500/day) — Comfortable SUV for long desert stretches\n`;
      } else if (dtype === 'wildlife') {
        response += `🚗 **Mahindra Thar** (₹3,500/day) — Perfect for safari terrain\n🚗 **Kia Seltos** (₹2,800/day) — Comfortable SUV with great ground clearance\n`;
      } else if (group && group > 3) {
        response += `🚗 **Hyundai Creta** (₹2,500/day) — Spacious SUV for your group\n🚗 **Mahindra Thar** (₹3,500/day) — If you want the offroad experience\n`;
      } else {
        response += `🚗 **Honda City** (₹1,500/day) — Smooth highway comfort\n🚗 **Hyundai Creta** (₹2,500/day) — SUV for versatile terrain\n🏍️ **RE Classic 350** (₹800/day) — For the two-wheel adventurers\n`;
      }

      if (pkg) {
        response += `\n📦 Or grab our **${pkg.name}** package (${pkg.days}) at **${pkg.price}/person** — includes a ${pkg.vehicle}!\n`;
      }

      response += `\nWhich option sounds good? Or would you like me to suggest camera gear too? 📸`;
      return response;
    }

    case 'VEHICLE_SELECTION': {
      const dest = ctx.destination;
      const days = ctx.duration;
      const sv = ctx.specificVehicle;
      const pkg = packageData[dest];

      let response = `${sv.emoji} Great choice! **${sv.name}** it is!\n\n`;
      response += `Here's your updated trip summary:\n\n`;
      response += `📍 **Destination:** ${dest}\n`;
      if (days) response += `📅 **Duration:** ${days} days\n`;
      if (ctx.groupSize) response += `👥 **Group:** ${ctx.groupSize} people\n`;
      response += `${sv.emoji} **Vehicle:** ${sv.name} — ₹${sv.price.toLocaleString('en-IN')}/day\n`;

      if (ctx.cameraInterest) {
        response += `📸 **Camera:** GoPro Hero 12 — ₹800/day\n`;
      }

      if (days) {
        const vehicleTotal = sv.price * days;
        const cameraTotal = ctx.cameraInterest ? 800 * days : 0;
        response += `\n💰 **Estimated Cost:** ₹${(vehicleTotal + cameraTotal).toLocaleString('en-IN')} (${days}-day rental)`;
      }

      if (pkg) {
        response += `\n\n💡 **Pro tip:** Our **${pkg.name}** package at **${pkg.price}/person** includes vehicle, accommodation & itinerary — even better value!`;
      }

      response += `\n\nShall I **finalize this booking** for you? I'll just need your preferred dates! 🗓️`;
      return response;
    }

    case 'RECOMMEND': {
      const dest = ctx.destination;
      const days = ctx.duration;
      const pkg = packageData[dest];
      const sv = ctx.specificVehicle;

      let response = `Awesome, here's your trip summary! 📋\n\n`;
      response += `📍 **Destination:** ${dest}\n`;
      response += `📅 **Duration:** ${days} days\n`;
      if (ctx.groupSize) response += `👥 **Group:** ${ctx.groupSize} people\n`;

      // Use SPECIFIC vehicle if user named one, otherwise use category default
      if (sv) {
        response += `${sv.emoji} **Vehicle:** ${sv.name} — ₹${sv.price.toLocaleString('en-IN')}/day\n`;
      } else if (ctx.vehicleInterest === 'bike') {
        response += `🏍️ **Vehicle:** Royal Enfield Himalayan — ₹1,200/day\n`;
      } else if (ctx.vehicleInterest === 'scooty') {
        response += `🛵 **Vehicle:** Honda Activa — ₹399/day\n`;
      } else if (ctx.vehicleInterest === 'car') {
        response += `🚗 **Vehicle:** Hyundai Creta SUV — ₹2,500/day\n`;
      }

      if (ctx.cameraInterest) {
        response += `📸 **Camera:** GoPro Hero 12 — ₹800/day\n`;
      }

      const vPrice = sv ? sv.price : (ctx.vehicleInterest === 'bike' ? 1200 : ctx.vehicleInterest === 'scooty' ? 399 : 2500);
      const vehicleTotal = vPrice * days;
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
      return `💰 Here's our complete pricing:\n\n**🛵 Two-Wheelers:**\nActiva/Ntorq: ₹399-600/day\nRE Classic 350: ₹800-1,200/day\nRE Himalayan: ₹1,200-1,500/day\n\n**🚗 Cars:**\nSwift/i20: ₹1,000-1,800/day\nCity/Verna: ₹1,500-2,500/day\nCreta/Seltos: ₹2,500-3,500/day\nThar: ₹3,500-4,500/day\n\n**📸 Cameras:**\nGoPro: ₹800/day | DSLR Kit: ₹1,500/day | Drone: ₹2,500/day\n\n🎁 **3+ days = 10% off | Vehicle + Camera = 15% off**\n\nWant a quote for a specific trip? Tell me your destination! 🗺️`;

    case 'CLARIFY':
    default: {
      const msg = ctx.currentMessage;

      if (msg.match(/^(yes|yeah|yep|sure|ok|okay|sounds good|go ahead|let'?s do it|absolutely|definitely)/)) {
        if (ctx.destination) return generateStageResponse('RECOMMEND', ctx, rawMessage);
        return `Great! So, what destination are you thinking about? 🗺️`;
      }

      if (msg.match(/^(no|nah|not really|nope|skip|maybe later)/)) {
        if (ctx.destination) return `No worries! Is there anything else about your **${ctx.destination}** trip I can help with? Maybe camera gear, route suggestions, or booking details? 😊`;
        return `No problem! Whenever you're ready to plan a trip, I'm here. Just tell me a destination or what you're looking for! ✨`;
      }

      if (msg.match(/\b(thank|thanks|thx|tysm|appreciate)\b/)) {
        return `You're welcome! 😊 If you need anything else for your trip planning, I'm always here. Have an amazing journey! 🌟`;
      }

      if (ctx.destination) {
        return `I'd love to help more with your **${ctx.destination}** plans! Could you tell me:\n\n• How many **days** you're planning for?\n• How many **people** in your group?\n• Interested in a **vehicle rental** or a **complete holiday package**?\n\nI'll put together a personalized recommendation! 🎯`;
      }

      return `I'd love to help you plan something awesome! 🌟\n\nYou can tell me:\n• A **destination** (like "Ladakh" or "Gujarat")\n• What you need (car, bike, camera, holiday package)\n• Or just describe your dream trip!\n\nI'll take it from there! 🗺️`;
    }
  }
}


// ─── Itinerary Generator ───────────────────────────────────────
router.post('/itinerary', async (req, res) => {
  try {
    const { destination, duration, interests, groupSize, budget } = req.body;

    if (!destination || !duration) {
      return res.status(400).json({ success: false, message: 'Destination and duration are required' });
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
- Stay: [Accommodation suggestion]
- Must-try food: [Local dish]

Also recommend:
- Best vehicle for this trip
- Camera gear suggestions
- Budget estimate per person`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return res.json({ success: true, data: { itinerary: getSimulatedItinerary(destination, duration), isSimulated: true } });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: { temperature: 0.9, maxOutputTokens: 2048 }
        })
      }
    );

    const data = await response.json();
    if (data.candidates && data.candidates[0]) {
      return res.json({ success: true, data: { itinerary: data.candidates[0].content.parts[0].text, isSimulated: false } });
    }
    throw new Error('No response from AI');
  } catch (error) {
    console.error('AI Itinerary Error:', error);
    res.json({ success: true, data: { itinerary: getSimulatedItinerary(req.body.destination, req.body.duration), isSimulated: true } });
  }
});

function getSimulatedItinerary(destination, duration) {
  return `# 🗺️ ${duration}-Day ${destination} Itinerary\n\n## Day 1: Arrival & Local Exploration\n- **Morning:** Arrive and check into your hotel\n- **Afternoon:** Visit local markets and landmarks\n- **Evening:** Sunset viewpoint & local cuisine\n- 🏨 Stay: Boutique hotel near city center\n- 🍽️ Must-try: Local street food tour\n\n## Day 2: Adventure Day\n- **Morning:** Nature trek or water sports\n- **Afternoon:** Visit heritage sites\n- **Evening:** Cultural show & dinner\n\n---\n\n### 🚗 Recommended Vehicle\nSUV (e.g., Thar or Creta) for versatile terrain\n\n### 📸 Camera Suggestions\nMirrorless camera + wide-angle lens + GoPro for action shots\n\n### 💰 Budget Estimate\n~₹5,000-8,000 per person/day (including vehicle rental)\n\n*Contact us to customize this itinerary!*`;
}


// ─── Smart Recommendations ─────────────────────────────────────
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
    recommendations.vehicle.push({ type: 'Sedan', suggestion: 'Honda City or Hyundai Verna', reason: 'Comfortable for highway drives', priceRange: '₹1,500 - ₹2,500/day' });
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
