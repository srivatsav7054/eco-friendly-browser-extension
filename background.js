// background.js 🌱
// Multi-API + smart material-based eco score system with massive product detection

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== "fetchSustainability") return;

  const query = (message.product || "").trim();
  console.log("🔍 Fetching sustainability data for:", query);

  Promise.all([
    fetchOpenFoodFacts(query),
    estimateMaterialFootprint(query),
    Promise.resolve(buildAlternatives(query)),
  ])
    .then(([food, material, fallback]) => {
      const carbon = food.co2 ?? material.co2;
      const scoreParts = [food.score, material.score, fallback.score].filter((n) => n > 0);
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
    .catch((err) => {
      console.error("❌ API error:", err);
      sendResponse({
        productName: query,
        carbonFootprint: "N/A",
        greenLevel: 0,
        betterAlternative: "Error fetching data",
        alternatives: [],
      });
    });

  return true; // Keep message port open
});

// ====================================================================
// 🧠 1️⃣ OpenFoodFacts — Fetch ecoscore and CO₂ data when available
async function fetchOpenFoodFacts(q) {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/search?fields=ecoscore_score,ecoscore_data&search_terms=${encodeURIComponent(
      q
    )}&page_size=1`;
    const res = await fetch(url);
    const data = await res.json();
    const p = data.products?.[0];
    return {
      score: p?.ecoscore_score || 0,
      co2: p?.ecoscore_data?.agribalyse?.co2_total || null,
    };
  } catch {
    return { score: 0, co2: null };
  }
}

// ====================================================================
// 🌿 2️⃣ Material-based CO₂ estimation + eco keywords
async function estimateMaterialFootprint(q) {
  const text = q.toLowerCase();

  // 🧩 Special cases for vegan/recycled/organic
  if (text.includes("vegan leather") || text.includes("faux leather") || text.includes("pu leather"))
    return { score: 70, co2: 7 };
  if (text.includes("recycled polyester") || text.includes("rpet"))
    return { score: 80, co2: 5 };
  if (text.includes("organic cotton"))
    return { score: 90, co2: 4 };
  if (text.includes("hemp"))
    return { score: 92, co2: 3 };
  if (text.includes("linen"))
    return { score: 88, co2: 4 };

  // 🧮 Material reference table
  const table = [
    { key: "cotton", co2: 5, score: 85 },
    { key: "polyester", co2: 9, score: 65 },
    { key: "leather", co2: 17, score: 40 },
    { key: "nylon", co2: 10, score: 60 },
    { key: "plastic", co2: 12, score: 55 },
    { key: "steel", co2: 7, score: 70 },
    { key: "metal", co2: 8, score: 68 },
    { key: "bamboo", co2: 3, score: 90 },
    { key: "paper", co2: 4, score: 80 },
    { key: "glass", co2: 6, score: 75 },
  ];

  const match = table.find((m) => text.includes(m.key));
  if (match) return { score: match.score, co2: match.co2 };

  // fallback by type
  if (text.match(/shirt|tshirt|pant|jean/)) return { score: 70, co2: 8 };
  if (text.match(/shoe|bag|backpack/)) return { score: 75, co2: 6 };
  if (text.match(/bottle|cup|mug/)) return { score: 80, co2: 4 };
  return { score: 0, co2: null };
}

// ====================================================================
// ♻️ 3️⃣ Smart alternatives — detect product types and suggest greener options
function buildAlternatives(q) {
  const lower = q.toLowerCase();

  // 🧩 Extended product type detection
  const types = [
    // 👕 Fashion & Apparel
    "shirt", "tshirt", "pant", "jean", "shorts", "jacket", "hoodie", "dress", "kurta",
    "saree", "top", "skirt", "sweater", "coat", "blazer", "socks", "underwear",
    "cap", "hat", "belt", "scarf", "gloves", "tie", "beanie",

    // 👞 Footwear
    "shoe", "sandal", "slipper", "flipflop", "boot", "heel", "sneaker", "loafer",

    // 🎒 Bags & Accessories
    "bag", "backpack", "wallet", "handbag", "purse", "trolley", "luggage",
    "duffle", "sling", "laptop bag", "messenger bag",

    // 💻 Electronics
    "laptop", "tablet", "phone", "mobile", "smartphone", "charger", "headphone",
    "earbud", "earphone", "powerbank", "smartwatch", "camera", "speaker",
    "monitor", "keyboard", "mouse", "printer", "tv", "remote", "router",

    // 🏠 Home & Kitchen
    "bottle", "cup", "mug", "plate", "bowl", "pan", "utensil", "spoon", "fork",
    "knife", "container", "storage box", "flask", "jar", "jug", "kettle",
    "mixer", "grinder", "blender", "cookware", "towel", "curtain", "bedsheet",
    "pillow", "blanket", "mattress", "cushion", "carpet", "rug", "clock",
    "lamp", "light", "bulb", "candle", "dustbin",

    // 🧴 Personal Care
    "toothbrush", "toothpaste", "soap", "shampoo", "conditioner", "comb",
    "razor", "lotion", "cream", "perfume", "deodorant", "sanitizer", "sunscreen",
    "lip balm", "face wash", "makeup", "foundation", "lipstick", "eyeliner",
    "moisturizer", "serum", "mask", "brush",

    // 🍽️ Food & Beverages
    "snack", "chocolate", "juice", "coffee", "tea", "biscuit", "rice", "oil",
    "sugar", "salt", "pasta", "noodles", "cereal", "bread", "cake", "cookie",
    "water", "drink", "sauce", "jam", "spread", "honey",

    // 🧸 Kids & Toys
    "toy", "game", "puzzle", "board game", "doll", "lego", "car", "ball",
    "stuffed animal", "playset", "crayon", "coloring book",

    // 🧰 Tools & Hardware
    "tool", "screwdriver", "hammer", "wrench", "drill", "saw", "tape", "glue",
    "scissors", "measuring tape", "knife set",

    // 🏋️ Fitness & Sports
    "dumbbell", "yoga mat", "treadmill", "cycle", "helmet", "glove", "bat",
    "racket", "ball", "skate", "jersey", "bottle", "fitness band",

    // 🚗 Automotive
    "car", "bike", "helmet", "seat cover", "tyre", "mirror", "wiper", "car mat",
    "headlight", "air freshener",

    // 🐾 Pet Supplies
    "dog", "cat", "leash", "collar", "pet food", "toy", "grooming brush",
    "bowl", "kennel", "litter box", "fish tank", "aquarium",

    // 🖊️ Stationery
    "pen", "pencil", "eraser", "sharpener", "marker", "notebook", "book",
    "diary", "journal", "file", "folder", "stapler", "glue", "tape", "highlighter",

    // 🌿 Garden & Outdoor
    "plant", "flower pot", "soil", "fertilizer", "watering can", "shovel",
    "sprayer", "seeds", "hose", "outdoor light", "chair", "table", "grill",

    // 💡 Miscellaneous
    "case", "cover", "holder", "stand", "strap", "organizer", "hanger",
    "filter", "mat", "basket", "frame", "mirror"
  ];

  // pick the strongest keyword (longest match)
  const detected =
    types
      .filter((t) => lower.includes(t))
      .sort((a, b) => b.length - a.length)[0] || "product";

  const ecoTerms = [
    `sustainable ${detected}`,
    `eco-friendly ${detected}`,
    `recycled ${detected}`,
    `organic ${detected}`,
    `biodegradable ${detected}`,
  ];

  const platforms = [
    { name: "Amazon", url: (t) => `https://www.amazon.in/s?k=${encodeURIComponent(t)}` },
    { name: "Flipkart", url: (t) => `https://www.flipkart.com/search?q=${encodeURIComponent(t)}` },
    { name: "Myntra", url: (t) => `https://www.myntra.com/${encodeURIComponent(t.replace(/\s+/g, "-"))}` },
  ];

  const alternatives = [];
  for (const site of platforms)
    for (const [i, term] of ecoTerms.entries())
      alternatives.push({
        name: `${term} (${site.name})`,
        greenScore: 90 - i * 3,
        url: site.url(term),
      });

  return { score: 80, detected, alternatives };
}

// ================= MISTRAL (OLLAMA) HANDLER =================
const OLLAMA_API_URL = "http://127.0.0.1:11434/api/generate";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "generateEcoScore") return;

  const prompt = `You are an environmental sustainability expert.
Return only a single valid JSON object starting with '{' and ending with '}'.
{
  "ecoScore": number,
  "color": "green"|"yellow"|"red",
  "greenLevel": number,
  "reasons": [string, string],
  "tip": string,
  "alternatives": [
    {"name": string, "greenScore": number},
    {"name": string, "greenScore": number}
  ]
}
Product: ${msg.product}
Category: ${msg.category || "general"}`;

  fetch(OLLAMA_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistral",
      prompt,
      stream: false
    })
  })
    .then(res => res.json())
    .then(data => {
      sendResponse({ success: true, data: data.response });
    })
    .catch(err => {
      sendResponse({ success: false, error: err.message });
    });

  return true; // 🔴 REQUIRED
});
