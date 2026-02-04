function getTokenFromUrl() {
  // Supports /f/<token>
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const fromPath = (pathParts[0] === "f" && pathParts[1]) ? pathParts[1] : null;

  // Supports /guarantor?token=<token> (or any route with ?token=)
  const qs = new URLSearchParams(window.location.search);
  const fromQuery = qs.get("token");

  return fromPath || fromQuery || "";
}

function setBanner(type, msg) {
  const banner = document.getElementById("banner");
  banner.classList.remove("hidden", "ok", "err");
  banner.classList.add(type === "ok" ? "ok" : "err");
  banner.textContent = msg;
}

function clearBanner() {
  const banner = document.getElementById("banner");
  banner.classList.add("hidden");
  banner.textContent = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const token = getTokenFromUrl();
  document.getElementById("tokenValue").textContent = token || "(missing)";

  if (!token) {
    setBanner("err", "Missing token. Please use the secure link from your email.");
    document.getElementById("submitBtn").disabled = true;
    return;
  }

  const form = document.getElementById("pgForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearBanner();

    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Submitting...";

    // Collect fields
    const formData = new FormData(form);
    const payload = {};
    for (const [k, v] of formData.entries()) payload[k] = v;

    // MVP behavior (no backend yet)
    console.log("TOKEN:", token);
    console.log("PAYLOAD:", payload);

    // Simulate success
    setTimeout(() => {
      setBanner("ok", "Submitted successfully. You may close this page.");
      form.reset();
      btn.disabled = false;
      btn.textContent = "Submit";
    }, 400);
  });
});
