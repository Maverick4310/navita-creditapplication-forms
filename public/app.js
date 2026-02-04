// app.js

const SF_ENDPOINT =
  "https://navitascredit--IFSNAV19.sandbox.my.salesforce-sites.com/creditapp/services/apexrest/externalform/pg";

/**
 * Token supports:
 * - /f/<token>
 * - ?token=<token>
 */
function getTokenFromUrl() {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const fromPath = pathParts[0] === "f" && pathParts[1] ? pathParts[1] : null;

  const qs = new URLSearchParams(window.location.search);
  const fromQuery = qs.get("token");

  return fromPath || fromQuery || "";
}

function setBanner(type, msg) {
  const banner = document.getElementById("banner");
  if (!banner) return;

  banner.classList.remove("hidden", "ok", "err");
  banner.classList.add(type === "ok" ? "ok" : "err");
  banner.textContent = msg;
}

function clearBanner() {
  const banner = document.getElementById("banner");
  if (!banner) return;

  banner.classList.add("hidden");
  banner.classList.remove("ok", "err");
  banner.textContent = "";
}

/**
 * Your inputs are named like: guarantors[0][firstName]
 * This builds: { token, guarantors: [ { firstName, ... }, ... ] }
 */
function buildPayloadFromForm(form, token) {
  const fd = new FormData(form);

  const guarantorsByIndex = new Map();

  for (const [key, rawVal] of fd.entries()) {
    const val = (rawVal ?? "").toString().trim();

    // Match: guarantors[0][firstName]
    const m = key.match(/^guarantors\[(\d+)\]\[([^\]]+)\]$/);
    if (!m) continue;

    const idx = Number(m[1]);
    const field = m[2];

    if (!guarantorsByIndex.has(idx)) guarantorsByIndex.set(idx, {});
    guarantorsByIndex.get(idx)[field] = val;
  }

  // Convert map → array, keep index order
  const guarantors = Array.from(guarantorsByIndex.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, g]) => {
      // Normalize ownershipPct as number (optional)
      if (g.ownershipPct !== undefined && g.ownershipPct !== null && g.ownershipPct !== "") {
        const n = Number(g.ownershipPct);
        g.ownershipPct = Number.isFinite(n) ? n : null;
      } else {
        delete g.ownershipPct;
      }

      // Normalize empty optional fields
      if (g.phone === "") delete g.phone;

      return g;
    });

  return { token, guarantors };
}

function showConfirmationUI() {
  // Don’t change CSS — just hide the form and tweak existing text
  const form = document.getElementById("pgForm");
  if (form) form.style.display = "none";

  const addBtn = document.getElementById("addGuarantorBtn");
  if (addBtn) addBtn.style.display = "none";

  const title = document.getElementById("title");
  if (title) title.textContent = "Submission Received";

  const hint = document.querySelector(".hint");
  if (hint) hint.textContent = "Thank you. Your information has been submitted successfully.";
}

document.addEventListener("DOMContentLoaded", () => {
  const token = getTokenFromUrl();

  if (!token) {
    setBanner("err", "Missing token. Please use the secure link from your email.");
    const btn = document.getElementById("submitBtn");
    if (btn) btn.disabled = true;
    return;
  }

  const form = document.getElementById("pgForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearBanner();

    const btn = document.getElementById("submitBtn");
    const originalText = btn ? btn.textContent : "SUBMIT";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Submitting...";
    }

    try {
      const payload = buildPayloadFromForm(form, token);

      const resp = await fetch(SF_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        // If your Sites endpoint is public, this is fine.
        // If you later add cookies/session, you'd need credentials: "include"
        body: JSON.stringify(payload)
      });

      let data = null;
      try {
        data = await resp.json();
      } catch {
        // non-json response
      }

      if (!resp.ok || !data?.success) {
        const msg =
          data?.message ||
          `Submission failed (HTTP ${resp.status}). Please try again or contact support.`;
        setBanner("err", msg);
        if (btn) {
          btn.disabled = false;
          btn.textContent = originalText;
        }
        return;
      }

      // Success
      setBanner("ok", data.message || "Submitted successfully. You may close this page.");
      showConfirmationUI();
    } catch (err) {
      console.error("Submit error:", err);
      setBanner(
        "err",
        "Unable to submit due to a network/CORS issue. Please try again. If it continues, contact support."
      );
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  });
});
