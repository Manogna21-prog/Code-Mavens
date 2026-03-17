/**
 * SafeShift — Frontend Application Logic
 * Connects to the FastAPI backend at http://localhost:8000
 */

const API_BASE = "http://localhost:8000";

// ── Page Navigation ──────────────────────────────────────────────────

document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        const page = link.dataset.page;

        // Update nav active state
        document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
        link.classList.add("active");

        // Show target page
        document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
        document.getElementById(`page-${page}`).classList.add("active");
    });
});

// ── Toast Notifications ──────────────────────────────────────────────

function showToast(message, duration = 3000) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), duration);
}

// ── API Helper ───────────────────────────────────────────────────────

async function apiCall(method, path, body = null) {
    const options = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, options);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.detail || "API error");
    }
    return data;
}

// ── Render Helpers ───────────────────────────────────────────────────

function renderResultField(label, value, highlight = false) {
    return `
        <div class="result-field">
            <span class="field-label">${label}</span>
            <span class="field-value ${highlight ? "highlight" : ""}">${value}</span>
        </div>`;
}

function showResult(elementId, html, isError = false) {
    const el = document.getElementById(elementId);
    el.innerHTML = html;
    el.className = `result-box ${isError ? "error" : ""}`;
    el.classList.remove("hidden");
}

// ── Driver Registration ──────────────────────────────────────────────

document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        full_name: document.getElementById("reg-name").value,
        phone: document.getElementById("reg-phone").value,
        aadhaar_number: document.getElementById("reg-aadhaar").value,
        driving_license: document.getElementById("reg-dl").value,
        vehicle_rc: document.getElementById("reg-rc").value,
        vehicle_type: document.getElementById("reg-vehicle").value,
        vehicle_chassis_number: document.getElementById("reg-chassis").value,
        upi_id: document.getElementById("reg-upi").value,
        operating_city: document.getElementById("reg-city").value,
        operating_pincode: document.getElementById("reg-pincode").value,
        preferred_language: document.getElementById("reg-lang").value,
    };

    try {
        const data = await apiCall("POST", "/api/drivers/register", payload);
        showResult("register-result", `
            <h3>✅ Driver Registered Successfully!</h3>
            ${renderResultField("Driver ID", data.id, true)}
            ${renderResultField("Name", data.full_name)}
            ${renderResultField("Phone", data.phone)}
            ${renderResultField("Vehicle", data.vehicle_type)}
            ${renderResultField("City", data.operating_city)}
            ${renderResultField("UPI", data.upi_id)}
            ${renderResultField("Language", data.preferred_language)}
            <p style="margin-top:12px;font-size:0.8rem;color:#64748b;">
                Copy the Driver ID above to purchase a policy.
            </p>
        `);
        showToast("🎉 Registration successful!");
    } catch (err) {
        showResult("register-result", `<h3>❌ Registration Failed</h3><p>${err.message}</p>`, true);
        showToast("Registration failed");
    }
});

// ── Policy Purchase ──────────────────────────────────────────────────

// Set default week dates
(function setDefaultDates() {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    document.getElementById("pol-start").value = monday.toISOString().split("T")[0];
    document.getElementById("pol-end").value = sunday.toISOString().split("T")[0];
})();

document.getElementById("policy-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const tier = document.querySelector('input[name="tier"]:checked').value;
    const payload = {
        driver_id: document.getElementById("pol-driver-id").value,
        tier: tier,
        week_start: document.getElementById("pol-start").value,
        week_end: document.getElementById("pol-end").value,
    };

    try {
        const data = await apiCall("POST", "/api/policies", payload);
        showResult("policy-result", `
            <h3>✅ Policy Activated!</h3>
            ${renderResultField("Policy ID", data.id, true)}
            ${renderResultField("Tier", data.tier.toUpperCase())}
            ${renderResultField("Premium", `₹${data.final_premium}`, true)}
            ${renderResultField("Max Weekly Payout", `₹${data.max_weekly_payout}`)}
            ${renderResultField("Coverage", `${data.week_start} → ${data.week_end}`)}
            ${renderResultField("Status", data.status.toUpperCase())}
        `);
        showToast("✅ Policy purchased!");
    } catch (err) {
        showResult("policy-result", `<h3>❌ Policy Creation Failed</h3><p>${err.message}</p>`, true);
    }
});

// ── Trigger Detection ────────────────────────────────────────────────

document.getElementById("trigger-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        city: document.getElementById("trg-city").value,
        zone_pincode: document.getElementById("trg-pincode").value,
    };

    try {
        const data = await apiCall("POST", "/api/triggers/check", payload);

        if (data.length === 0) {
            showResult("trigger-result", `
                <h3 style="color: var(--success);">✅ No Active Triggers</h3>
                <p>All parametric thresholds are within normal range for pincode ${payload.zone_pincode}.</p>
            `);
            showToast("No triggers detected — all clear!");
            return;
        }

        const triggerLabels = {
            grap_iv: "🏭 GRAP-IV (AQI)",
            heavy_rainfall: "🌧️ Heavy Rainfall",
            cyclone: "🌀 Cyclone",
            app_outage: "📱 App Outage",
            curfew_bandh: "🚧 Curfew / Bandh",
        };

        let html = `<h3 style="color: var(--danger);">⚠️ ${data.length} Trigger(s) Detected!</h3>`;

        data.forEach((t) => {
            html += `
                <div class="trigger-card">
                    <div class="trigger-header">
                        <strong>${triggerLabels[t.trigger] || t.trigger}</strong>
                        <span class="trigger-badge breached">THRESHOLD BREACHED</span>
                    </div>
                    ${renderResultField("Actual Value", t.actual_value)}
                    ${renderResultField("Threshold", t.threshold_value)}
                    ${renderResultField("Data Source", t.data_source)}
                    ${renderResultField("Zone", t.zone_pincode)}
                    ${renderResultField("Detected At", new Date(t.detected_at).toLocaleString())}
                    ${renderResultField("Event ID", t.id)}
                </div>`;
        });

        showResult("trigger-result", html, true);
        showToast(`⚠️ ${data.length} trigger(s) detected!`);
    } catch (err) {
        showResult("trigger-result", `<h3>❌ Trigger Check Failed</h3><p>${err.message}</p>`, true);
    }
});

// ── Dynamic Pricing Calculator ───────────────────────────────────────

// Update UBI slider label
document.getElementById("prc-ubi").addEventListener("input", (e) => {
    document.getElementById("ubi-value").textContent = parseFloat(e.target.value).toFixed(2);
});

document.getElementById("pricing-form").addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
        city: document.getElementById("prc-city").value,
        tier: document.getElementById("prc-tier").value,
        weather_risk_level: document.getElementById("prc-weather").value,
        ubi_score: parseFloat(document.getElementById("prc-ubi").value),
    };

    try {
        const data = await apiCall("POST", "/api/pricing/calculate", payload);
        showResult("pricing-result", `
            <h3>✅ Premium Calculated</h3>
            ${renderResultField("Tier", data.tier.toUpperCase())}
            ${renderResultField("Base Premium", `₹${data.base_premium}`)}
            ${renderResultField("Weather Risk Adj.", `+₹${data.weather_risk_adjustment}`)}
            ${renderResultField("UBI Adjustment", `+₹${data.ubi_adjustment}`)}
            <hr style="margin: 8px 0; border: none; border-top: 2px solid var(--primary);">
            ${renderResultField("Final Premium", `₹${data.final_premium}/week`, true)}
            <p style="margin-top:12px; padding:10px; background:#eff6ff; border-radius:8px; font-size:0.85rem;">
                📊 ${data.breakdown}
            </p>
        `);
        showToast(`Premium: ₹${data.final_premium}/week`);
    } catch (err) {
        showResult("pricing-result", `<h3>❌ Pricing Failed</h3><p>${err.message}</p>`, true);
    }
});
