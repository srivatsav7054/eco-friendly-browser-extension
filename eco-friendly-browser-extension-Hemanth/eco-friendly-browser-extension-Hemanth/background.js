// background.js 🌱
// Multi-API + smart material-based eco score system with massive product detection
// FIXED VERSION with proper Ollama JSON handling

const OLLAMA_API_URL = "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = "llama3.2";

// ====================================================================
// MAIN MESSAGE HANDLER
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ================================
  // 1️⃣ Sustainability fetch handler
  if (message.action === "fetchSustainability") {

    const query = (message.product || "").trim();
    console.log("🔍 Fetching sustainability data for:", query);

    Promise.all([
      fetchOpenFoodFacts(query),
      estimateMaterialFootprint(query),
      Promise.resolve(buildAlternatives(query)),
    ])
      .then(([food, material, fallback]) => {

        const carbon = food.co2 ?? material.co2;

        const scoreParts = [
          food.score,
          material.score,
          fallback.score
        ].filter(n => n > 0);

        const avgScore =
          scoreParts.length > 0
            ? Math.round(scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length)
            : 0;

        sendResponse({
          productName: query,
          carbonFootprint: carbon ? `${carbon.toFixed(2)} kg CO₂` : "Unknown",
          greenLevel: avgScore,
          betterAlternative: `Try greener ${fallback.detected || "products"}:`,
          alternatives: fallback.alternatives,
        });

      })
      .catch(err => {

        console.error("❌ Sustainability error:", err);

        sendResponse({
          productName: query,
          carbonFootprint: "N/A",
          greenLevel: 0,
          betterAlternative: "Error fetching data",
          alternatives: [],
        });

      });

    return true;
  }

  // ================================
  // 2️⃣ AI Eco Score handler (FIXED)
  if (message.action === "generateEcoScore") {

    const prompt = `
You are an environmental sustainability expert.

Return ONLY valid JSON. No explanation. No text outside JSON.

{
  "ecoScore": number (0-10),
  "color": "green"|"yellow"|"red",
  "greenLevel": number (0-100),
  "reasons": [string, string],
  "tip": string,
  "alternatives": [
    {"name": string, "greenScore": number},
    {"name": string, "greenScore": number}
  ]
}

Product: ${message.product}
Category: ${message.category || "general"}
`;

    (async () => {
      try {
        let responseText = null;
        let lastError = null;
        let maxRetries = 2;

        // Retry logic: attempt up to 2 times
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            responseText = await callOllama(prompt);
            const parsedData = extractJSON(responseText);
            validateEcoScore(parsedData);
            
            // Success - send as JSON string
            sendResponse({
              success: true,
              data: JSON.stringify(parsedData)
            });
            return;

          } catch (error) {
            lastError = error;
            console.warn(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
            
            if (attempt < maxRetries) {
              // Wait 500ms before retry
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }

        // All retries exhausted
        throw lastError || new Error("Failed after all retries");

      } catch (error) {
        console.error("❌ EcoScore generation error:", error);
        
        // Always use fallback if LLM fails
        console.log("🔄 Using fallback scoring");
        const fallback = generateEcoScoreFallback(message.product);
        sendResponse({
          success: true,
          data: JSON.stringify(fallback)
        });
      }
    })();

    return true;
  }

});


// ====================================================================
// Helper: Call Ollama with timeout and error handling
async function callOllama(prompt, retries = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2,
          top_p: 0.9
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.response) {
      throw new Error("Empty response from Ollama");
    }

    return data.response.trim();

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Ollama request timeout (10s)");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// ====================================================================
// Helper: Extract JSON from text
function extractJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || start > end) {
    throw new Error("No valid JSON found in response");
  }

  const jsonString = text.substring(start, end + 1);
  return JSON.parse(jsonString);
}

// ====================================================================
// Helper: Validate EcoScore object structure
function validateEcoScore(obj) {
  const required = ["ecoScore", "color", "greenLevel", "reasons", "tip", "alternatives"];
  
  for (const key of required) {
    if (!(key in obj)) {
      throw new Error(`Missing required field: ${key}`);
    }
  }

  if (typeof obj.ecoScore !== "number" || obj.ecoScore < 0 || obj.ecoScore > 10) {
    throw new Error("Invalid ecoScore: must be number 0-10");
  }

  if (!["green", "yellow", "red"].includes(obj.color)) {
    throw new Error("Invalid color: must be green, yellow, or red");
  }

  if (typeof obj.greenLevel !== "number" || obj.greenLevel < 0 || obj.greenLevel > 100) {
    throw new Error("Invalid greenLevel: must be number 0-100");
  }

  if (!Array.isArray(obj.reasons) || obj.reasons.length === 0) {
    throw new Error("Invalid reasons: must be non-empty array");
  }

  if (typeof obj.tip !== "string" || obj.tip.length === 0) {
    throw new Error("Invalid tip: must be non-empty string");
  }

  if (!Array.isArray(obj.alternatives)) {
    throw new Error("Invalid alternatives: must be array");
  }

  return true;
}

// ====================================================================
// Fallback: Eco score without LLM when memory constrained
function generateEcoScoreFallback(product) {
  const text = product.toLowerCase();
  
  const ecoKeywords = {
    high: ["organic", "recycled", "eco", "natural", "sustainable", "vegan", "bamboo", "biodegradable"],
    medium: ["cotton", "glass", "steel", "certified"],
    low: ["plastic", "leather", "polyester", "synthetic"]
  };
  
  let score = 5;
  let reasons = [];
  
  for (const keyword of ecoKeywords.high) {
    if (text.includes(keyword)) {
      score = Math.min(10, score + 2);
      reasons.push(`Contains "${keyword}" - eco-friendly material`);
    }
  }
  
  for (const keyword of ecoKeywords.low) {
    if (text.includes(keyword)) {
      score = Math.max(1, score - 2);
      reasons.push(`Contains "${keyword}" - higher carbon footprint`);
    }
  }
  
  if (reasons.length === 0) {
    reasons = ["Standard product - estimated eco score"];
  }
  
  const color = score >= 7 ? "green" : score >= 5 ? "yellow" : "red";
  
  return {
    ecoScore: score,
    color: color,
    greenLevel: score * 10,
    reasons: reasons.slice(0, 2),
    tip: "Tip: Look for certifications like FSC, Fair Trade, or organic labels",
    alternatives: [
      { name: "Eco-friendly version", greenScore: 85 },
      { name: "Sustainable alternative", greenScore: 80 }
    ]
  };
}

// ====================================================================
async function fetchOpenFoodFacts(q) {

  try {

    const url =
      `https://world.openfoodfacts.org/api/v2/search?fields=ecoscore_score,ecoscore_data&search_terms=${encodeURIComponent(q)}&page_size=1`;

    const res = await fetch(url);

    const data = await res.json();

    const p = data.products?.[0];

    return {
      score: p?.ecoscore_score || 0,
      co2: p?.ecoscore_data?.agribalyse?.co2_total || null,
    };

  } catch {

    return {
      score: 0,
      co2: null
    };

  }

}


// ====================================================================
// Material estimation
async function estimateMaterialFootprint(q) {

  const text = q.toLowerCase();

  if (text.includes("vegan leather"))
    return { score: 70, co2: 7 };

  if (text.includes("recycled"))
    return { score: 85, co2: 4 };

  if (text.includes("organic cotton"))
    return { score: 90, co2: 4 };

  const table = [

    { key: "cotton", co2: 5, score: 85 },
    { key: "polyester", co2: 9, score: 65 },
    { key: "leather", co2: 17, score: 40 },
    { key: "plastic", co2: 12, score: 55 },
    { key: "steel", co2: 7, score: 70 },
    { key: "glass", co2: 6, score: 75 },
    { key: "bamboo", co2: 3, score: 90 },

  ];

  const match = table.find(m => text.includes(m.key));

  if (match) return match;

  return {
    score: 50,
    co2: 8
  };

}


// ====================================================================
// Alternative suggestions
function buildAlternatives(q) {

  const detected = "product";

  const ecoTerms = [

    `eco friendly ${detected}`,
    `sustainable ${detected}`,
    `recycled ${detected}`,
    `biodegradable ${detected}`

  ];

  const alternatives = ecoTerms.map((term, i) => ({

    name: term,
    greenScore: 90 - i * 5,
    url: `https://www.amazon.in/s?k=${encodeURIComponent(term)}`

  }));

  return {

    score: 80,
    detected,
    alternatives

  };

}
