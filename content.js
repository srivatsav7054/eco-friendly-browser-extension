// content.js 🌿
// Shows white-themed eco report panel with cart and alternatives
console.log("content.js loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "togglePanel") {
    const existing = document.getElementById("ecoSidebarPanel");
    if (existing) { 
      existing.remove(); 
      sendResponse({done: true});  // <-- FIX: call sendResponse here!
      return;
    }
    createEcoPanel();
    sendResponse({done: true}); // <-- FIX: call sendResponse here!
    // If createEcoPanel is async, consider returning true for an async response.
  }
});


function createEcoPanel() {
  const productTitle = getProductTitle();
  if (!productTitle) {
    showNotice("⚠️ Open a product page before scanning!");
    return;
  }

  const panel = document.createElement("div");
  panel.id = "ecoSidebarPanel";
  Object.assign(panel.style, {
    position: "fixed",
    top: "0",
    right: "0",
    height: "100vh",
    width: "35vw",
    background: "#ffffff",
    color: "#111111",
    padding: "20px",
    boxShadow: "-4px 0 15px rgba(0,0,0,0.15)",
    borderLeft: "2px solid #e0e0e0",
    zIndex: "999999",
    overflowY: "auto",
    fontFamily: "'Inter', Arial, sans-serif",
    transition: "transform 0.3s ease",
    transform: "translateX(100%)",
  });

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "12px",
    left: "12px",
    background: "#222",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
  });
  closeBtn.addEventListener("click", () => {
    panel.style.transform = "translateX(100%)";
    setTimeout(() => panel.remove(), 250);
  });

  const heading = document.createElement("h2");
  heading.textContent = "🌱 Scanning product...";
  heading.style.marginTop = "40px";
  heading.style.textAlign = "center";
  heading.style.color = "#222";

  panel.append(closeBtn, heading);
  document.body.appendChild(panel);
  requestAnimationFrame(() => (panel.style.transform = "translateX(0)"));

  chrome.runtime.sendMessage(
    { action: "fetchSustainability", product: productTitle },
    (response) => {
      if (!response) {
        heading.textContent = "⚠️ No data found.";
        return;
      }
      fillEcoPanel(panel, response);
    }
  );
}

function getProductTitle() {
  const selectors = [
    "#productTitle",
    "h1 span.a-size-large",
    ".a-size-large.product-title-word-break",
    ".B_NuCI",
    ".pdp-title",
    ".pdp-name",
    "h1.pdp-title",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.innerText || el.textContent || "").trim();
      if (text && text.length > 3) return text;
    }
  }
  const og = document.querySelector('meta[property="og:title"]');
  if (og?.content?.trim().length > 3) return og.content.trim();
  return document.title.trim();
}

function fillEcoPanel(panel, data) {
  panel.innerHTML = "";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "12px",
    left: "12px",
    background: "#222",
    color: "#fff",
    border: "none",
    padding: "6px 10px",
    borderRadius: "6px",
    cursor: "pointer",
  });
  closeBtn.addEventListener("click", () => {
    panel.style.transform = "translateX(100%)";
    setTimeout(() => panel.remove(), 250);
  });
  panel.appendChild(closeBtn);

  const greenScore = Number(data.greenLevel) || 0;
  const scoreText = greenScore > 0 ? `${greenScore.toFixed(0)}%` : "Not available";
  const progressColor =
    greenScore > 70 ? "#4caf50" : greenScore > 40 ? "#ffb300" : "#e53935";

  const content = document.createElement("div");
  content.innerHTML = `
    <h2 style="margin-top:40px;color:#000;">🌿 Eco Report</h2>
    <p><strong>Product:</strong> ${escapeHtml(data.productName)}</p>
    <p><strong>Carbon Footprint:</strong> ${escapeHtml(data.carbonFootprint)}</p>
    <p><strong>Green Score:</strong> ${scoreText}</p>

    <div style="background:#f0f0f0;width:100%;border-radius:8px;margin:6px 0 12px 0;height:12px;">
      <div style="width:${Math.min(100, Math.max(0, greenScore))}%;
                  background:${progressColor};
                  height:12px;border-radius:8px;"></div>
    </div>

    <button id="addCartBtn" style="
      background:#2e7d32;
      color:#fff;
      border:none;
      border-radius:8px;
      padding:10px 16px;
      font-size:14px;
      cursor:pointer;
      margin-bottom:18px;
      box-shadow:0 2px 6px rgba(0,0,0,0.1);">
      🛒 Add to Cart
    </button>

    <div style="border-top:1px solid #ddd;margin:10px 0 8px 0;"></div>
    <h3 style="margin-bottom:8px;color:#111;">♻️ Better Alternatives</h3>
    <div id="ecoAlts" style="display:flex;flex-wrap:wrap;gap:10px;"></div>
  `;
  panel.appendChild(content);

  const addBtn = content.querySelector("#addCartBtn");
  addBtn.addEventListener("click", async () => {
    const item = { name: data.productName, url: window.location.href };
    const stored = await chrome.storage.local.get("cartItems");
    const items = stored.cartItems || [];
    if (items.some((i) => i.url === item.url)) {
      showNotice("✅ Already in cart!");
      return;
    }
    items.push(item);
    await chrome.storage.local.set({ cartItems: items });
    showNotice("🛒 Added to cart!");
  });

  const altContainer = panel.querySelector("#ecoAlts");
  if (data.alternatives?.length) {
    data.alternatives.forEach((alt) => {
      const card = document.createElement("div");
      Object.assign(card.style, {
        width: "46%",
        minHeight: "70px",
        background: "#fafafa",
        borderRadius: "10px",
        padding: "10px",
        border: "1px solid #ddd",
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        cursor: "pointer",
      });
      card.innerHTML = `
        <div style="font-weight:600;text-align:center;font-size:13px;margin-bottom:6px;color:#000;">
          ${escapeHtml(alt.name)}
        </div>
        <div style="color:#2e7d32;font-weight:700;">
          ${alt.greenScore ? alt.greenScore + "%" : "—"}
        </div>
      `;
      card.addEventListener("click", () => window.open(alt.url, "_blank"));
      altContainer.appendChild(card);
    });
  } else {
    altContainer.textContent = "No alternatives found.";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"'`=\/]/g, (s) => {
    const map = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      "`": "&#96;", "=": "&#61;", "/": "&#47;",
    };
    return map[s] || s;
  });
}

function showNotice(text) {
  const notice = document.createElement("div");
  notice.textContent = text;
  Object.assign(notice.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    background: "#ffffff",
    color: "#111",
    border: "1px solid #ddd",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: "9999999",
  });
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 2000);
}
