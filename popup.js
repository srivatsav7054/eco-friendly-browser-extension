// --- Scan Product feature --- (unchanged)
const scanBtn = document.getElementById("scan");
const status = document.getElementById("status");
const cartList = document.getElementById("cartList");

scanBtn.addEventListener("click", () => {
  scanBtn.style.transform = "scale(0.95)";
  scanBtn.style.backgroundColor = "#43a047";
  status.textContent = "🔍 Scanning...";
  setTimeout(() => {
    scanBtn.style.transform = "scale(1)";
    scanBtn.style.backgroundColor = "#4caf50";
  }, 120);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: "togglePanel" }, () => {
      status.textContent = "✅ Scanned successfully!";
      setTimeout(() => (status.textContent = ""), 1200);
    });
  });
});

document.addEventListener('DOMContentLoaded', renderCart);

async function renderCart() {
  const stored = await chrome.storage.local.get("cartItems");
  const items = stored.cartItems || [];
  cartList.innerHTML = "";
  if (items.length === 0) {
    cartList.innerHTML = `<p style="color:#777;text-align:center;">Cart is empty 🛒</p>`;
  }
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "cart-item";
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.name;
    link.target = "_blank";
    const del = document.createElement("button");
    del.textContent = "🗑️";
    del.className = "delBtn";
    del.addEventListener("click", async () => {
      const updated = items.filter((_, i) => i !== index);
      await chrome.storage.local.set({ cartItems: updated });
      renderCart();
    });
    li.append(link, del);
    cartList.appendChild(li);
  });
}

//const OLLAMA_API_URL = "http://127.0.0.1:11434/api/generate";
function getEcoColor(score) {
  if (score >= 8) return "green";
  if (score >= 5) return "yellow";
  return "red";
}

function showPanel(panelId) {
  ["searchPanel", "comparePanel", "infoPanel"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  const panel = document.getElementById(panelId);
  if (panel) panel.style.display = "block";
}

function ensurePanels() {
  const area = document.getElementById("ecoFeaturePanel");
  if (!area || document.getElementById("searchPanel")) return;

  // --- Search Panel ---
  const searchPanel = document.createElement("div");
  searchPanel.id = "searchPanel";
  searchPanel.style.display = "none";
  searchPanel.innerHTML = `
    <input id="searchInput" type="text" placeholder="Product name..." style="width:calc(100% - 16px);padding:8px;margin:5px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:12px;">
    <button id="searchSubmitBtn" style="width:100%;padding:8px;background:#4caf50;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">Search</button>
    <div id="searchResult" style="margin-top:10px;"></div>`;
  area.appendChild(searchPanel);

  // --- Compare Panel ---
  const comparePanel = document.createElement("div");
  comparePanel.id = "comparePanel";
  comparePanel.style.display = "none";
  comparePanel.innerHTML = `
    <input id="compareProduct1" type="text" placeholder="Product 1..." style="width:calc(100% - 16px);padding:8px;margin:5px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:12px;">
    <input id="compareProduct2" type="text" placeholder="Product 2..." style="width:calc(100% - 16px);padding:8px;margin:5px 0;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:12px;">
    <button id="compareSubmitBtn" style="width:100%;padding:8px;background:#4caf50;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;margin-top:8px;">Compare</button>
    <div id="compareResult" style="margin-top:10px;"></div>`;
  area.appendChild(comparePanel);

  // --- Info Panel ---
  const infoPanel = document.createElement("div");
  infoPanel.id = "infoPanel";
  infoPanel.style.display = "none";
  infoPanel.innerHTML = `
    <div style="margin-top:8px;padding:12px;background:#e8f5e9;border-radius:6px;font-size:12px;color:#2e7d32;">
      <p><strong>🌍 AI Eco Rating</strong></p>
      <p>🟢 Green (8-10): Eco-friendly</p>
      <p>🟡 Yellow (5-7): Moderate</p>
      <p>🔴 Red (1-4): Low eco</p>
    </div>`;
  area.appendChild(infoPanel);

  // Button handlers
  document.getElementById("searchSubmitBtn").addEventListener("click", performSearch);
  document.getElementById("searchInput").addEventListener("keypress", e => { if (e.key === "Enter") performSearch(); });
  document.getElementById("compareSubmitBtn").addEventListener("click", performCompare);
  document.getElementById("compareProduct2").addEventListener("keypress", e => { if (e.key === "Enter") performCompare(); });
}

document.getElementById("searchBtn").addEventListener("click", () => { ensurePanels(); showPanel("searchPanel"); });
document.getElementById("compareBtn").addEventListener("click", () => { ensurePanels(); showPanel("comparePanel"); });
document.getElementById("infoBtn").addEventListener("click", () => { ensurePanels(); showPanel("infoPanel"); });

async function generateEcoScore(productName, category = "general") {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "generateEcoScore",
        product: productName,
        category
      },
      (res) => {
        if (!res || !res.success) {
          resolve({
            ecoScore: null,
            color: "yellow",
            greenLevel: null,
            reasons: ["LLM error"],
            tip: "ERROR",
            alternatives: []
          });
          return;
        }

        try {
          const parsed = JSON.parse(res.data);
          parsed.greenLevel ??= parsed.ecoScore * 10;
          parsed.alternatives ??= [];
          resolve(parsed);
        } catch {
          resolve({
            ecoScore: null,
            color: "yellow",
            greenLevel: null,
            reasons: ["Invalid JSON from model"],
            tip: "ERROR",
            alternatives: []
          });
        }
      }
    );
  });
}


// (Unchanged) performSearch and performCompare using above
async function performSearch() {
  const input = document.getElementById("searchInput").value.trim();
  const resultDiv = document.getElementById("searchResult");
  if (!input) {
    resultDiv.innerHTML = "<p style='color:#2e7d32;'>❌ Enter product name</p>";
    return;
  }
  resultDiv.innerHTML = `<div style="text-align:center;"><div style="font-size:18px;color:#43a047;">🔎 Scanning...</div><div style="margin-top:4px;font-size:12px;color:#666;">Waiting for eco analysis from AI...</div></div>`;
  const score = await generateEcoScore(input, "shopping");
  if (score.tip === "ERROR" || score.ecoScore===null) {
    resultDiv.innerHTML = "<p style='color:red;'>❌ API Error - Could not reach Ollama or analyze.</p>";
    return;
  }
  const ecoColor = getEcoColor(score.ecoScore);
  const barWidth = Math.round(score.greenLevel);
  let reasonsHTML = "<ul style='margin:4px 0;padding-left:18px;font-size:10px;color:#2e7d32;'>";
  score.reasons.slice(0, 2).forEach(r => { reasonsHTML += `<li>${r}</li>`; });
  reasonsHTML += "</ul>";
  const shortTip = score.tip.split(".")[0] + ".";
  let altsHTML = "<div style='margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;'>";
  score.alternatives.forEach((alt) => {
    altsHTML += `<a href='https://www.amazon.in/s?k=${encodeURIComponent(alt.name)}' target='_blank' style='background:white;padding:6px;margin:2px 0;border-radius:4px;text-align:center;font-size:10px;display:inline-block;color:#2e7d32;text-decoration:none;font-weight:600;box-shadow:0 1px 3px #0001;'>${alt.name} (${Math.round(alt.greenScore)}%)</a>`;
  });
  altsHTML += "</div>";
  resultDiv.innerHTML = `
    <div style='background:white;padding:10px 10px 7px 10px;border-radius:6px;font-size:11px;'>
      <span class="badge" style='background:${ecoColor};color:white;border-radius:50%;padding:2px 9px;font-weight:bold;'>${ecoColor==='green'?'✓':ecoColor==='yellow'?'!':'✗'}</span>
      <span style='font-weight:bold;text-transform:capitalize;'>${input}</span>
      <span style='font-size:12px;color:#888;margin-left:6px'>(${score.ecoScore}/10)</span>
      <div style='background:#ddd;width:100%;border-radius:6px;height:9px;margin:5px 0 6px 0;'>
        <div style='width:${barWidth}%;background:${ecoColor};height:9px;border-radius:6px;'></div>
      </div>
      <span style="color:#555;font-size:10.5px;display:block;"><b>Why?</b></span>
      ${reasonsHTML}
      <div style="color:#388e3c;font-size:10px;">Tip: ${shortTip}</div>
    </div>
    <div style='color:#229d42;font-size:10px;margin:8px 0 0 0;'>Alternatives:</div>
    ${altsHTML}
  `;
}

async function performCompare() {
  const p1 = document.getElementById("compareProduct1").value.trim();
  const p2 = document.getElementById("compareProduct2").value.trim();
  const resultDiv = document.getElementById("compareResult");
  if (!p1 || !p2) {
    resultDiv.innerHTML = "<p style='color:#2e7d32;'>❌ Enter both names</p>";
    return;
  }
  resultDiv.innerHTML = "<p style='color:#2e7d32;'>⏳ Comparing...</p>";
  const s1 = await generateEcoScore(p1, "shopping");
  const s2 = await generateEcoScore(p2, "shopping");
  if (s1.ecoScore===null || s2.ecoScore===null) {
    resultDiv.innerHTML = "<p style='color:red;'>❌ API Error - Model missing ecoScores</p>";
    return;
  }
  const color1 = getEcoColor(s1.ecoScore);
  const color2 = getEcoColor(s2.ecoScore);
  const w1 = Math.round(s1.greenLevel), w2 = Math.round(s2.greenLevel);
  const winner = s1.ecoScore > s2.ecoScore ? p1 : s2.ecoScore > s1.ecoScore ? p2 : "Tie";
  function shortList(reasons) {
    return "<ul style='margin:4px 0 7px 0;padding-left:16px;font-size:12px;color:#2e7d32;'>" +
      reasons.slice(0, 2).map(r => `<li>${r}</li>`).join('') + "</ul>";
  }
  function tipShort(tip) { return tip.split(".")[0] + "."; }
  resultDiv.innerHTML = `
    <div style='display:flex;gap:10px;background:white;padding:10px 7px;border-radius:6px;font-size:11px;'>
      <div style="flex:1;">
        <span class="badge" style='background:${color1};color:white;border-radius:50%;padding:2px 9px;font-weight:bold;'>${color1==='green'?'✓':color1==='yellow'?'!':'✗'}</span>
        <span style="font-weight:bold;">${p1}</span> <span style="color:#888;">(${s1.ecoScore}/10)</span>
        <div style='background:#ddd;height:8px;border-radius:4px;margin:2px 0 6px 0;'>
          <div style='width:${w1}%;background:${color1};height:8px;border-radius:4px;'></div>
        </div>
        <span style="font-size:11px;"><b>Why?</b></span>
        ${shortList(s1.reasons)}
        <div style="color:#4caf50;font-size:10px;">Tip: ${tipShort(s1.tip)}</div>
      </div>
      <div style="flex:1;">
        <span class="badge" style='background:${color2};color:white;border-radius:50%;padding:2px 9px;font-weight:bold;'>${color2==='green'?'✓':color2==='yellow'?'!':'✗'}</span>
        <span style="font-weight:bold;">${p2}</span> <span style="color:#888;">(${s2.ecoScore}/10)</span>
        <div style='background:#ddd;height:8px;border-radius:4px;margin:2px 0 6px 0;'>
          <div style='width:${w2}%;background:${color2};height:8px;border-radius:4px;'></div>
        </div>
        <span style="font-size:11px;"><b>Why?</b></span>
        ${shortList(s2.reasons)}
        <div style="color:#4caf50;font-size:10px;">Tip: ${tipShort(s2.tip)}</div>
      </div>
    </div>
    <p style="color:#4caf50;font-weight:bold;margin-top:8px;">🏆 ${winner === "Tie" ? "It's a tie!" : `<b>${winner}</b> is more eco-friendly!`}</p>
  `;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensurePanels);
} else {
  ensurePanels();
}
