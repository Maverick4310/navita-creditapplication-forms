// app.js

const SF_ENDPOINT =
  "https://navitascredit--IFSNAV19.sandbox.my.salesforce-sites.com/creditapp/services/apexrest/externalform/pg";

// Email validation regex pattern
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Track guarantor count for dynamic field generation
let guarantorCount = 1;

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

/**
 * Display banner message (ok or err)
 */
function setBanner(type, msg) {
  const banner = document.getElementById("banner");
  if (!banner) return;

  banner.classList.remove("hidden", "ok", "err");
  banner.classList.add(type === "ok" ? "ok" : "err");
  banner.textContent = msg;
  
  // Scroll banner into view for visibility
  banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * Hide and clear banner
 */
function clearBanner() {
  const banner = document.getElementById("banner");
  if (!banner) return;

  banner.classList.add("hidden");
  banner.classList.remove("ok", "err");
  banner.textContent = "";
}

/**
 * Validate a single email field
 * Returns true if valid, false if invalid
 */
function isValidEmail(value) {
  return EMAIL_REGEX.test(value.trim());
}

/**
 * Check if all required fields are filled and emails are valid
 * Updates submit button state accordingly
 */
function validateForm() {
  const form = document.getElementById("pgForm");
  const submitBtn = document.getElementById("submitBtn");
  if (!form || !submitBtn) return;

  let isValid = true;

  // Get all required fields (inputs and selects)
  const requiredFields = form.querySelectorAll("[required]");

  requiredFields.forEach((field) => {
    const value = field.value.trim();
    
    // Check if field has a value
    if (!value) {
      isValid = false;
      return;
    }

    // Additional email format validation
    if (field.type === "email" && !isValidEmail(value)) {
      isValid = false;
    }
  });

  // Enable/disable submit button based on validation
  submitBtn.disabled = !isValid;
}

/**
 * Mark a field as invalid with visual feedback
 */
function setFieldInvalid(field, message) {
  field.classList.add("invalid");
  
  // Remove existing error message if any
  const existingError = field.parentElement.querySelector(".field-error");
  if (existingError) existingError.remove();
  
  // Add error message
  if (message) {
    const errorEl = document.createElement("div");
    errorEl.className = "field-error";
    errorEl.textContent = message;
    field.parentElement.appendChild(errorEl);
  }
}

/**
 * Clear invalid state from a field
 */
function clearFieldInvalid(field) {
  field.classList.remove("invalid");
  
  const existingError = field.parentElement.querySelector(".field-error");
  if (existingError) existingError.remove();
}

/**
 * Validate email field on blur (when user leaves field)
 */
function handleEmailBlur(e) {
  const field = e.target;
  const value = field.value.trim();
  
  if (value && !isValidEmail(value)) {
    setFieldInvalid(field, "Please enter a valid email address");
  } else {
    clearFieldInvalid(field);
  }
}

/**
 * Build payload from form data
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
      if (g.dateOfBirth === "") delete g.dateOfBirth;

      return g;
    });

  return { token, guarantors };
}

/**
 * Show confirmation UI after successful submission
 */
function showConfirmationUI() {
  const form = document.getElementById("pgForm");
  if (form) form.style.display = "none";

  const addBtn = document.getElementById("addGuarantorBtn");
  if (addBtn) addBtn.style.display = "none";

  const title = document.getElementById("title");
  if (title) title.textContent = "Submission Received";

  const hint = document.querySelector(".hint");
  if (hint) hint.textContent = "Thank you. Your information has been submitted successfully.";
}

/**
 * Generate HTML for a new guarantor section
 * Includes Date of Birth field
 */
function createGuarantorHTML(index) {
  return `
    <div class="guarantor-header">
      <span class="guarantor-title">Personal Guarantor ${index}</span>
      <button type="button" class="remove-btn" onclick="removeGuarantor(this)">Remove</button>
    </div>
    <div class="grid">
      <div class="field">
        <label for="firstName_${index}">First Name <span class="req">*</span></label>
        <input id="firstName_${index}" name="guarantors[${index - 1}][firstName]" autocomplete="given-name" required />
      </div>

      <div class="field">
        <label for="lastName_${index}">Last Name <span class="req">*</span></label>
        <input id="lastName_${index}" name="guarantors[${index - 1}][lastName]" autocomplete="family-name" required />
      </div>

      <div class="field">
        <label for="ssn_${index}">SSN <span class="req">*</span></label>
        <input
          id="ssn_${index}"
          name="guarantors[${index - 1}][ssn]"
          inputmode="numeric"
          autocomplete="off"
          placeholder="123-45-6789"
          required
        />
        <div class="help">Enter 9 digits (dashes optional).</div>
      </div>

      <div class="field">
        <label for="dateOfBirth_${index}">Date of Birth</label>
        <input
          id="dateOfBirth_${index}"
          name="guarantors[${index - 1}][dateOfBirth]"
          type="date"
          autocomplete="bday"
        />
      </div>

      <div class="field">
        <label for="email_${index}">Email <span class="req">*</span></label>
        <input id="email_${index}" name="guarantors[${index - 1}][email]" type="email" autocomplete="email" required />
      </div>

      <div class="field">
        <label for="phone_${index}">Phone</label>
        <input id="phone_${index}" name="guarantors[${index - 1}][phone]" autocomplete="tel" />
      </div>

      <div class="field">
        <label for="ownershipPct_${index}">Ownership %</label>
        <input
          id="ownershipPct_${index}"
          name="guarantors[${index - 1}][ownershipPct]"
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="e.g., 25"
        />
        <div class="help">0–100 (optional).</div>
      </div>

      <div class="field">
        <label for="streetNumber_${index}">Street Number <span class="req">*</span></label>
        <input id="streetNumber_${index}" name="guarantors[${index - 1}][streetNumber]" inputmode="numeric" autocomplete="off" required />
      </div>

      <div class="field">
        <label for="streetName_${index}">Street Name <span class="req">*</span></label>
        <input id="streetName_${index}" name="guarantors[${index - 1}][streetName]" autocomplete="off" required />
      </div>

      <div class="field">
        <label for="streetType_${index}">Street Type <span class="req">*</span></label>
        <select id="streetType_${index}" name="guarantors[${index - 1}][streetType]" required>
          <option value="">Select…</option>
          <option value="St">St</option>
          <option value="Ave">Ave</option>
          <option value="Blvd">Blvd</option>
          <option value="Dr">Dr</option>
          <option value="Ln">Ln</option>
          <option value="Rd">Rd</option>
          <option value="Ct">Ct</option>
          <option value="Cir">Cir</option>
          <option value="Pkwy">Pkwy</option>
          <option value="Way">Way</option>
          <option value="Pl">Pl</option>
          <option value="Ter">Ter</option>
          <option value="Hwy">Hwy</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div class="field">
        <label for="city_${index}">City <span class="req">*</span></label>
        <input id="city_${index}" name="guarantors[${index - 1}][city]" autocomplete="address-level2" required />
      </div>

      <div class="field">
        <label for="state_${index}">State <span class="req">*</span></label>
        <select id="state_${index}" name="guarantors[${index - 1}][state]" autocomplete="address-level1" required>
          <option value="">Select…</option>
          <option value="AL">AL</option><option value="AK">AK</option><option value="AZ">AZ</option>
          <option value="AR">AR</option><option value="CA">CA</option><option value="CO">CO</option>
          <option value="CT">CT</option><option value="DE">DE</option><option value="FL">FL</option>
          <option value="GA">GA</option><option value="HI">HI</option><option value="ID">ID</option>
          <option value="IL">IL</option><option value="IN">IN</option><option value="IA">IA</option>
          <option value="KS">KS</option><option value="KY">KY</option><option value="LA">LA</option>
          <option value="ME">ME</option><option value="MD">MD</option><option value="MA">MA</option>
          <option value="MI">MI</option><option value="MN">MN</option><option value="MS">MS</option>
          <option value="MO">MO</option><option value="MT">MT</option><option value="NE">NE</option>
          <option value="NV">NV</option><option value="NH">NH</option><option value="NJ">NJ</option>
          <option value="NM">NM</option><option value="NY">NY</option><option value="NC">NC</option>
          <option value="ND">ND</option><option value="OH">OH</option><option value="OK">OK</option>
          <option value="OR">OR</option><option value="PA">PA</option><option value="RI">RI</option>
          <option value="SC">SC</option><option value="SD">SD</option><option value="TN">TN</option>
          <option value="TX">TX</option><option value="UT">UT</option><option value="VT">VT</option>
          <option value="VA">VA</option><option value="WA">WA</option><option value="WV">WV</option>
          <option value="WI">WI</option><option value="WY">WY</option>
        </select>
      </div>

      <div class="field">
        <label for="zip_${index}">ZIP <span class="req">*</span></label>
        <input id="zip_${index}" name="guarantors[${index - 1}][zip]" inputmode="numeric" autocomplete="postal-code" required />
      </div>
    </div>
  `;
}

/**
 * Add a new guarantor section
 */
function addGuarantor() {
  guarantorCount++;
  const container = document.getElementById("guarantorsContainer");
  
  const section = document.createElement("div");
  section.className = "guarantor-section";
  section.dataset.guarantor = guarantorCount;
  section.innerHTML = createGuarantorHTML(guarantorCount);
  
  container.appendChild(section);
  
  // Attach blur listener to new email field for validation
  const newEmailField = section.querySelector(`#email_${guarantorCount}`);
  if (newEmailField) {
    newEmailField.addEventListener("blur", handleEmailBlur);
  }
  
  // Re-validate form (new required fields added)
  validateForm();
  
  // Scroll to the new section
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Remove a guarantor section
 */
function removeGuarantor(btn) {
  const section = btn.closest(".guarantor-section");
  section.remove();
  updateGuarantorNumbers();
  
  // Re-validate form (required fields removed)
  validateForm();
}

/**
 * Update guarantor section titles after removal
 */
function updateGuarantorNumbers() {
  const sections = document.querySelectorAll(".guarantor-section");
  sections.forEach((section, index) => {
    const title = section.querySelector(".guarantor-title");
    title.textContent = `Personal Guarantor ${index + 1}`;
  });
}

// Make removeGuarantor available globally for onclick handlers
window.removeGuarantor = removeGuarantor;

/**
 * Initialize form on DOM ready
 */
document.addEventListener("DOMContentLoaded", () => {
  const token = getTokenFromUrl();

  // Check for valid token
  if (!token) {
    setBanner("err", "Missing token. Please use the secure link from your email.");
    const btn = document.getElementById("submitBtn");
    if (btn) btn.disabled = true;
    return;
  }

  const form = document.getElementById("pgForm");
  if (!form) return;

  // Add guarantor button handler
  const addBtn = document.getElementById("addGuarantorBtn");
  if (addBtn) {
    addBtn.addEventListener("click", addGuarantor);
  }

  // Real-time validation on input/change events (using event delegation)
  form.addEventListener("input", validateForm);
  form.addEventListener("change", validateForm);

  // Email blur validation for visual feedback
  const emailFields = form.querySelectorAll('input[type="email"]');
  emailFields.forEach((field) => {
    field.addEventListener("blur", handleEmailBlur);
  });

  // Initial validation check
  validateForm();

  // Form submission handler
  form.addEventListener("submit", async (e) => {
    // Prevent default form submission (prevents data in URL)
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

      // DEBUG: Log payload being sent to Apex
      console.group('🔍 DEBUG: Payload to Apex');
      console.log('Full payload:', JSON.stringify(payload, null, 2));
      console.log('Token:', payload.token);
      console.log('Guarantor count:', payload.guarantors?.length);
      payload.guarantors?.forEach((g, i) => {
        console.group(`Guarantor #${i + 1}`);
        console.table({
          firstName: g.firstName || '❌ NULL/EMPTY',
          lastName: g.lastName || '❌ NULL/EMPTY',
          ssn: g.ssn ? '✓ SET' : '❌ NULL/EMPTY',
          dateOfBirth: g.dateOfBirth || '(not provided)',
          email: g.email || '❌ NULL/EMPTY',
          phone: g.phone || '(not provided)',
          ownershipPct: g.ownershipPct ?? '(not provided)',
          streetNumber: g.streetNumber || '❌ NULL/EMPTY',
          streetName: g.streetName || '❌ NULL/EMPTY',
          streetType: g.streetType || '❌ NULL/EMPTY',
          city: g.city || '❌ NULL/EMPTY',
          state: g.state || '❌ NULL/EMPTY',
          zip: g.zip || '❌ NULL/EMPTY'
        });
        console.groupEnd();
      });
      console.groupEnd();

      const resp = await fetch(SF_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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

      // Success - show banner and confirmation UI
      setBanner("ok", data.message || "Submitted successfully! Thank you for your information. You may close this page.");
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
