# 🛡️ SafeShift — AI-Powered Parametric Insurance for India's LCV Delivery Partners

> *"When it rains in Pune, thousands of Porter delivery partners stop earning — not by choice, but because the roads flood and the orders stop. SafeShift fixes that. Automatically. Instantly. Fairly."*

**Team Code Mavens | Guidewire DEVTrails 2026 Hackathon**

---

## 📋 Quick Overview

| Attribute | Details |
|---|---|
| **Product** | SafeShift — Parametric Income Insurance Platform |
| **Persona** | Light Commercial Vehicle (LCV) Delivery Partners on **Porter** |
| **Coverage** | Loss of income due to external disruptions (NOT health/life/accident/vehicle repair) |
| **Pricing Model** | Weekly premium — aligned with gig worker payout cycles |
| **Platform** | Mobile-First Application (React Native) |
| **Payout Method** | Instant UPI transfer — under 10 minutes |
| **Claims Process** | Zero-Touch — fully automated, no manual filing required |
| **Team** | Code Mavens |

---


## 🧑‍💼 Persona Deep Dive

### Who Are We Building For?

**SafeShift is built exclusively for Light Commercial Vehicle (LCV) delivery partners operating on India's logistics platform — [Porter](https://porter.in).**

These are the drivers who power India's intra-city and last-mile logistics — moving goods, parcels, and freight across cities in Tata Aces, Mahindra Bolero Pickups, Ashok Leyland Dosts, and similar LCVs.

### Income Profile

| Metric | Value | Source |
|---|---|---|
| Average trips/day | 4–5 trips | Porter driver community forums, TeamLease Reports |
| Daily earnings | ₹1,400 – ₹2,000 | Porter earnings data, industry estimates |
| **Weekly earnings** | **₹9,900 – ₹13,800** | Calculated from daily trip data |
| Monthly earnings | ₹40,000 – ₹55,000 | Industry reports on LCV logistics |
| Fixed monthly costs (EMI + fuel + maintenance) | ₹18,000 – ₹25,000 | ICRA LCV financing reports |

### Why LCVs on Porter — Not Food/Grocery Delivery?

| Factor | Two-Wheeler (Zomato/Swiggy/Zepto) | LCV on Porter |
|---|---|---|
| Vehicle investment | ₹70K–₹1.5L | ₹4L–₹10L (with EMI obligations) |
| Revenue per trip | ₹30–₹80 | ₹300–₹800+ |
| Financial risk of 1 lost day | Low–Moderate | **Very High** (EMI still due) |
| Vulnerability to weather/road restrictions | Moderate | **Extreme** (LCVs restricted first in GRAP, floods) |
| Existing insurance options | Some platforms offer basic covers | **Almost none** |
| Dependency on road access | Moderate (can use lanes) | **Total** (need full road access for large vehicles) |

> **Key Insight:** LCV drivers on Porter have the highest financial exposure per disruption day of any gig delivery segment. They carry vehicle loans (EMIs of ₹8,000–₹15,000/month), cannot switch to smaller vehicles during restrictions, and are the **first category restricted** during GRAP-IV pollution alerts and flood advisories.

---

## 🔴 Critical Pain Points

### 1. **Immediate Income Loss with Zero Buffer**
When GRAP-IV restrictions hit Delhi-NCR (AQI > 450), LCVs are among the first vehicles pulled off roads. A single restricted week can wipe out ₹7,000–₹9,000 in earnings — but the driver's EMI of ₹8,000–₹15,000 is still due on the 5th of every month.

### 2. **Disproportionate Impact of Weather Events**
Heavy rainfall (>65mm/day) doesn't just slow LCV drivers — it halts them entirely. Flooded underpasses, waterlogged arterial roads, and cargo safety concerns mean LCVs are grounded while two-wheelers may still operate. In Mumbai's 2023 monsoon, LCV operations dropped by 60–70% on heavy rain days (IMD rainfall data cross-referenced with logistics platform reports).

### 3. **Vehicle Loan Trap During Downtime**
Unlike two-wheeler riders who own their vehicles outright, ~70% of LCV drivers on Porter are financing their vehicles through loans. Monthly EMIs of ₹8,000–₹15,000 don't pause during disruptions, creating a debt spiral when multiple disruption days cluster in a single month.

### 4. **No Control Over Government Restrictions**
GRAP restrictions, odd-even rules, curfews, and bandhs are entirely outside the driver's control. During the 2024 Delhi GRAP-IV enforcement (Nov–Dec), commercial vehicles were banned from entering the city for 11+ days, costing LCV drivers an estimated ₹22,000–₹30,000 in lost monthly income.

### 5. **Platform Dependency with No Platform Protection**
Porter provides no income protection for drivers during external disruptions. If the platform itself goes down (server outages, payment failures), drivers have zero recourse for the hours lost. The platform earns commission only when trips happen — so there's no built-in incentive to protect driver income during downtime.

---

## 📊 Market Context & Opportunity

### Market Size

| Metric | Value | Source |
|---|---|---|
| LCV fleet in India | ~6.3 million vehicles | SIAM / ICRA FY2024 |
| Platform-based LCV drivers (Porter, Rivigo, BlackBuck) | 500,000+ active drivers | Porter press releases, industry estimates |
| Annual growth of platform logistics | 25–30% YoY | RedSeer Consulting |
| Average annual income loss due to disruptions per LCV driver | ₹84,000 – ₹108,000 | Calculated: ₹7,000–₹9,000/month × 12 months |
| **Total addressable income loss market** | **₹4,200 – ₹5,400 crore/year** | 500,000 drivers × avg ₹84K–₹108K |

### Why Is This Market Underserved?

1. **Gig workers lack formal employer-employee relationships** — traditional insurers don't know how to underwrite them.
2. **High-frequency, low-severity losses** — individual claims are small (₹1,000–₹2,000), making traditional claims processing uneconomical.
3. **No standardised disruption data** — until now, there was no way to objectively verify "the driver couldn't work because of rain."
4. **Parametric insurance is new in India** — regulators (IRDAI) are only now opening up to parametric triggers beyond agriculture.

> **SafeShift's Opportunity:** Be the first parametric income insurance product designed specifically for India's urban logistics gig workforce — starting with Porter's 500,000+ LCV drivers.

---

## 🔬 Research Basis

Our problem identification is grounded in the following research:

| Research Type | Source | Key Insight |
|---|---|---|
| **Government Data** | CPCB AQI historical records (2019–2025) | Delhi-NCR experiences 15–25 days of AQI >450 per winter season |
| **Weather Data** | IMD rainfall records, OpenWeatherMap historical | Mumbai, Bangalore, Chennai see 20–30 days of >65mm rainfall annually |
| **Industry Reports** | ICRA LCV financing report, SIAM vehicle data | 70% of LCV drivers carry vehicle loans with EMIs ₹8K–₹15K/month |
| **Platform Research** | Porter driver forums, Reddit communities, YouTube driver vlogs | Drivers report 5–8 forced non-working days per month during monsoon/winter |
| **Policy Research** | GRAP framework (CAQM), NDMA cyclone guidelines | LCVs and commercial vehicles are restricted first in all pollution/disaster protocols |
| **Secondary Analysis** | TeamLease Gig Economy Report 2024, NITI Aayog platform economy report | 7.7M gig workers in India; less than 5% have any form of income protection |
| **Analogous Models** | PMFBY (crop insurance), Lemonade (US parametric), Etherisc (blockchain parametric) | Parametric models reduce claims processing cost by 85–90% vs traditional |

---

## ⚡ Disruptions Addressed

### Why These 5 Disruptions — Specifically for LCVs on Porter

| # | Disruption Type | Parametric Trigger | Data Source | Why It's Critical for LCVs |
|---|---|---|---|---|
| 1 | **GRAP-IV Restriction** | AQI > 450 (Hazardous) | CPCB / AQI India API | LCVs (especially diesel) are the **first vehicle category banned** under GRAP-IV. Two-wheelers and cars may still operate — LCVs cannot. Delhi-NCR saw 11+ GRAP-IV days in Nov–Dec 2024. |
| 2 | **Heavy Rainfall / Flood** | > 65mm rainfall/day in worker's zone | OpenWeatherMap API + IMD | LCVs cannot navigate flooded underpasses or waterlogged roads that smaller vehicles can. Cargo damage risk also forces drivers to halt operations entirely. |
| 3 | **Cyclones** | Wind speeds > 70 km/h | Open-Meteo API + IMD Alerts | LCVs are box-bodied or open-bed vehicles with high surface area — extremely dangerous in high winds. Coastal cities (Chennai, Mumbai, Kolkata) see 2–4 cyclonic events per year. |
| 4 | **App / Platform Outages** | Service outage > 3 hours | Simulated Platform API / StatusGator | Porter's platform is the **sole source of trip allocation** for drivers. A 3+ hour outage = zero trips = zero income. Unlike food delivery, LCV logistics trips are pre-booked and cannot be sourced elsewhere. |
| 5 | **Government Curfew / Bandh** | Mobility disruption > 4 hours | News/Social Media Scraper | LCVs are high-visibility commercial vehicles — often the first to be stopped at checkpoints or barricades during bandhs. Drivers cannot risk vehicle seizure or cargo confiscation. |

### Disruption Frequency Analysis (Historical — Delhi-NCR, 5-Year Average)

| Disruption | Avg Days/Year | Probability/Week | Source |
|---|---|---|---|
| GRAP-IV (AQI > 450) | 15–25 days | ~0.38 | CPCB historical data (2019–2024) |
| Heavy Rainfall (>65mm/day) | 12–18 days | ~0.29 | IMD Mumbai/Delhi rainfall data |
| Cyclone (wind >70 km/h) | 3–5 days | ~0.08 | IMD cyclone records |
| App Outage (>3 hrs) | 5–8 days | ~0.13 | Estimated from platform status reports |
| Curfew/Bandh (>4 hrs) | 4–6 days | ~0.10 | News archives analysis |

> **Combined weekly trigger probability ≈ 4%** (calculated as the joint probability of at least one disruption occurring in any given week, accounting for seasonal clustering and geographic variation).

---

## 💰 Premium Model & Pricing

### Base Premium Calculation

The base premium is derived from **long-term historical disruption data (5–10 years)**, not short-term weekly forecasts.

**Formula:**

```
Premium_base = P(trigger) × Payout
```

**Calculation:**

| Variable | Value |
|---|---|
| Combined disruption probability (all triggers) | **4% per week** |
| Weekly payout (Normal tier) | ₹2,000 |
| **Expected loss per week** | 0.04 × ₹2,000 = **₹80** |

The base premium of **₹80** represents the actuarially fair price. The final premium includes a loading factor for operational costs, reserves, and margin.

### Tier-Based Pricing Structure

Instead of complex continuous pricing, SafeShift uses **simple risk tiers** that drivers can easily understand and choose from.

| Tier | Base Premium (Weekly) | Weekly Max Payout | Target Users | Income Assumption | Coverage % |
|---|---|---|---|---|---|
| 🟢 **Normal** | **₹80** | ₹2,000 | Part-time drivers | ~₹10,000/week | 20% of income |
| 🟡 **Medium** | **₹120** | ₹3,000 | Regular drivers | ~₹12,000/week | 25% of income |
| 🔴 **High** | **₹160** | ₹4,000 | Full-time drivers | ~₹14,000/week | ~29% of income |

> **How are tier premiums calculated?**
>
> - **Normal:** 0.04 × ₹2,000 = ₹80
> - **Medium:** 0.04 × ₹3,000 = ₹120
> - **High:** 0.04 × ₹4,000 = ₹160
>
> Each tier's premium = P(trigger) × Max Weekly Payout for that tier.

### Why 20–30% Income Coverage?

Insurance should cover the **gap between earnings lost and fixed costs that can't be avoided:**

| Expense | Monthly Cost | Weekly Cost |
|---|---|---|
| Vehicle EMI | ₹8,000–₹15,000 | ₹2,000–₹3,750 |
| Fuel (even on non-working days, some is used) | ₹2,000–₹3,000 | ₹500–₹750 |
| Maintenance reserve | ₹1,000–₹2,000 | ₹250–₹500 |

Coverage of 20–30% of weekly income ensures **fixed costs are covered** during disruption periods. Full income replacement would make premiums unaffordable.

---

## 📤 Payout Structure

### Per-Disruption Payout Table (Tier-Wise)

Each disruption has a fixed payout. Only **one payout per event** is processed. **Maximum one claim per day.**

| Disruptor | Trigger | 🟢 Normal Tier Payout | 🟡 Medium Tier Payout | 🔴 High Tier Payout |
|---|---|---|---|---|
| **Heavy Rainfall** | >65mm/day | ₹1,000 | ₹1,500 | ₹2,000 |
| **AQI GRAP-IV** | AQI >450 | ₹1,000 | ₹1,500 | ₹2,000 |
| **Cyclone Warning** | Wind >70 km/h | ₹1,200 | ₹1,800 | ₹2,400 |
| **Curfew / Bandh** | Mobility halt >4 hrs | ₹900 | ₹1,350 | ₹1,800 |
| **App Outage** | >3 hrs downtime | ₹500 | ₹750 | ₹1,000 |

### Payout Rules

1. ✅ **One payout per event** — if heavy rain and AQI both trigger on the same day, only the **first triggered disruptor** is paid out.
2. ✅ **Maximum one claim per day** — even if multiple parameters are triggered.
3. ✅ **Total weekly payout cannot exceed the tier's weekly cap** (₹2,000 / ₹3,000 / ₹4,000).
4. ✅ **Zero-Touch Claims** — the system auto-files and approves the claim the moment a trigger is detected and both verification gates pass.
5. ✅ **Instant UPI Payout** — approved payout reaches the worker's UPI account in **under 10 minutes**.

---

## 🏦 Financial Viability — Why the System Won't Go Bankrupt

### Revenue Model

| Metric | Value |
|---|---|
| Total drivers (initial target) | 500,000 |
| Average weekly premium (Normal tier) | ₹80 |
| **Weekly premium revenue** | 500,000 × ₹80 = **₹4,00,00,000 (₹4 crore)** |
| **Monthly premium revenue** | **₹16 crore** |
| **Annual premium revenue** | **₹192 crore** |

### Payout Stress Test

| Scenario | % Drivers Triggering Claims | Avg Payout | Total Weekly Payout | Profit/Loss |
|---|---|---|---|---|
| **Normal week** | 5% (25,000 drivers) | ₹1,000 | ₹2.5 crore | ✅ **+₹1.5 crore profit** |
| **Moderate disruption** | 10% (50,000 drivers) | ₹1,200 | ₹6 crore | ⚠️ -₹2 crore (covered by reserves from normal weeks) |
| **Severe disruption** | 15% (75,000 drivers) | ₹1,500 | ₹11.25 crore | ❌ -₹7.25 crore (catastrophic reserve activated) |
| **Extreme (rare)** | 20% (100,000 drivers) | ₹1,800 | ₹18 crore | ❌ Reinsurance trigger |

### Why It Works

1. **Geographic diversification:** Disruptions are hyper-local. When Delhi has GRAP-IV, Mumbai/Bangalore/Chennai drivers are paying premiums normally.
2. **Seasonal balancing:** Monsoon drives higher payouts but winter (Oct–Feb) and summer (Mar–May) are low-claim periods — premiums accumulate as reserves.
3. **Weekly cap limits exposure:** No driver can claim more than ₹2,000–₹4,000/week, regardless of how many disruptions occur.
4. **Daily single-claim rule:** Even if 3 triggers fire on one day, only 1 payout is made.
5. **4% trigger probability:** At scale, the law of large numbers ensures actual trigger rates converge to expected rates.

> **Bottom line:** Even in a worst-case month where 15% of drivers trigger claims every week, the system's reserves from 48+ normal weeks per year cover the 4 high-disruption weeks comfortably.

---

## 🤖 Dynamic Premium Adjustments (AI Layer)

### Final Premium Formula

```
FinalPremium = BasePremium + WeatherRisk + UBI
```

Where:
- `WeatherRisk ≥ 0` (never negative — premium can only increase for risk, never decrease below base)
- `UBI ≥ 0` (Usage-Based Insurance adjustment)
- **Minimum price = Base Premium** (floor guaranteed)

### Weather Risk Calculation

The AI model predicts the probability of disruption for the upcoming week using weather forecasts, AQI trends, and seasonal patterns.

| Forecast Condition | P(Trigger) | Expected Loss (₹2,000 payout) | Extra Expected Loss vs Normal |
|---|---|---|---|
| Normal week | 5% | 0.05 × ₹2,000 = ₹100 | — |
| Moderate rain forecast | 8% | 0.08 × ₹2,000 = ₹160 | +₹60 |
| Heavy rain forecast | 12% | 0.12 × ₹2,000 = ₹240 | +₹140 |

**But** insurers don't pass the full increase to customers (risk pooling absorbs most of it):

| Risk Level | Premium Adjustment |
|---|---|
| Normal | ₹0 |
| Medium risk | +₹10 |
| High risk | +₹20 |

> Adjustments are kept to **10–20% of base premium** because: risk pooling reduces individual impact, pricing stability retains subscribers, and customers strongly prefer predictable pricing.

### UBI (Usage-Based Insurance) Calculation

UBI uses **historical GPS data** to assess each driver's exposure to high-risk zones.

**Step 1: Map risk zones**

| Zone Type | Risk Score |
|---|---|
| Flood-prone area (low-lying, near rivers) | 0.4 |
| Industrial AQI zone (near factories/power plants) | 0.3 |
| City center restriction zone (odd-even, GRAP-prone) | 0.2 |
| Highway logistics corridor | 0.05 |

**Step 2: Compute driver's exposure (30-day history)**

Example driver operating in Delhi-NCR:

| Zone | Time Spent | Risk Score | Weighted Score |
|---|---|---|---|
| Flood zone (Yamuna floodplain routes) | 40% | 0.4 | 0.16 |
| Industrial AQI zone (Anand Vihar area) | 30% | 0.3 | 0.09 |
| Highway corridor (NH-48) | 30% | 0.05 | 0.015 |
| **Total UBI Risk Score** | | | **0.265** |

**Step 3: Convert to premium adjustment**

| UBI Score Range | Premium Adjustment |
|---|---|
| 0.00 – 0.10 | ₹0 (low exposure) |
| 0.10 – 0.20 | +₹5 |
| 0.20 – 0.30 | +₹10 |
| 0.30+ | +₹15 |

### Premium Example (Normal Tier Driver in Delhi)

```
Base Premium:     ₹80
+ Weather Risk:   ₹10  (moderate rain forecast this week)
+ UBI:            ₹10  (drives through flood-prone zones regularly)
─────────────────────
Final Premium:    ₹100/week
```

---

## Adversarial Defense & Anti-Spoofing Strategy

### 🔴 Threat Scenario: Market Crash

A coordinated fraud ring can simulate hundreds of fake delivery partners using GPS spoofing tools, fake activity signals, and automated scripts to trigger payouts. Such an attack can rapidly drain the insurance liquidity pool, making it critical to move beyond basic verification mechanisms.

### 🧠 Multi-Layer Defense Architecture

Our system follows a defense-in-depth approach by combining AI, behavioral analytics, and real-time validation to proactively detect and prevent fraud.

### 📍 Advanced Location Integrity

Instead of relying solely on GPS, the system performs multi-source validation using:

- GPS data
- Network triangulation
- IP geolocation

It continuously analyzes movement patterns to:

- Detect unrealistic location jumps
- Check consistency between device motion and reported location

🚩 Flags suspicious behavior such as:

- Static GPS positions during active delivery
- Identical coordinates across multiple users

### 🧬 Behavioral Fingerprinting

Each worker develops a unique behavioral profile based on:

- Working hours
- Delivery frequency
- Route patterns
- Login activity

The system uses anomaly detection models (e.g., Isolation Forest) to detect:

- Sudden spikes in activity during payout triggers
- Identical behavior across multiple accounts

These are strong indicators of coordinated fraud.

### 🕸️ Fraud Ring Detection

To identify large-scale coordinated attacks, the system applies graph-based intelligence:

Analyzes relationships between accounts using:
- Shared device IDs
- IP clusters
- Synchronized activity timing

🚨 Detects patterns like:

- Mass account activation
- Clustered payout triggers
- Repeated synchronized behavior

### 📦 Activity Proof Validation

The platform validates actual work activity rather than trusting signals blindly.

- Verifies delivery-related actions via platform APIs
- Evaluates proof-of-work metrics such as:
  - Order acceptance rates
  - Route completion consistency

🚩 Flags accounts that:

- Are active only during payout windows
- Lack genuine delivery traces

### 🌦️ Environmental Data Cross-Verification

To prevent exploitation of fake triggers:

- Cross-verifies environmental conditions using:
  - Multiple weather sources
  - Pollution data APIs
- Applies geo-fencing to ensure:
  - User location matches actual disruption zones

❌ Rejects claims where:

- Reported location ≠ actual environmental event location

### ⚖️ Risk-Based Payout Control

Each user is assigned a dynamic fraud risk score (0 → 1).

| Risk Level | Action |
|---|---|
| Low Risk | Instant payout |
| Medium Risk | Delayed verification |
| High Risk | Manual review |

✔️ Ensures balance between efficiency and security.

### 🧑‍⚖️ Fairness Layer

Designed to protect genuine workers:

- Soft flagging instead of immediate blocking
- Gradual trust scoring
- Manual appeal process

✅ Prevents harm to honest users while maintaining strong fraud detection.

### 📡 Real-Time Monitoring

A real-time monitoring system provides:

- Live anomaly alerts
- Fraud cluster tracking
- Payout risk visualization

⚡ Enables rapid response to emerging threats.

### 🛡️ Outcome

This approach transforms the system from:

**Reactive fraud detection → Proactive fraud prevention**

It:

- Safeguards platform liquidity
- Prevents coordinated attacks
- Ensures fair and reliable payouts for genuine gig workers

### 🔥 Key Innovation

The core innovation lies in combining:

- AI-driven anomaly detection
- Graph-based fraud intelligence
- Multi-source verification

➡️ To build a robust defense against adversarial attacks in parametric insurance systems.

---


## ✅ Dual-Gate Claim Verification

SafeShift uses a **two-layer verification system** before any payout is triggered. This ensures only genuinely affected, actively working drivers receive compensation.

### Gate 1 — Environmental / External Trigger Verification

> Confirms a qualifying disruption is **actively occurring** in the rider's registered zone.

| Check | Method |
|---|---|
| AQI level in zone | Real-time CPCB API query |
| Rainfall in zone | OpenWeatherMap + IMD data |
| Wind speed in zone | Open-Meteo API |
| Platform outage status | StatusGator / Platform health API |
| Curfew/Bandh declaration | News scraper + government alert feeds |

✅ **Pass condition:** Parametric threshold breached in driver's registered operating zone.

### Gate 2 — Activity & Income Proxy Validation

> Confirms this **specific rider was actively attempting to earn** during the disruption window.

| Check | Condition |
|---|---|
| App active status | Driver's app was in **active/online mode for ≥45 minutes** during the disruption window |
| GPS location validation | Driver's GPS ping places them **within or traveling toward** the affected zone |

### Decision Matrix

| Gate 1 (External Trigger) | Gate 2 (Driver Activity) | Result |
|---|---|---|
| ✅ Pass | ✅ Pass | **💰 Payout fires automatically** |
| ✅ Pass | ❌ Fail | **❌ No payout** (driver was not actively working) |
| ❌ Fail | ✅ Pass | **❌ No action** (no qualifying disruption) |
| ❌ Fail | ❌ Fail | **❌ No action** |

### Daily Claim Limit

Even if **multiple disruptions trigger on the same day**, only **one claim (the first triggered disruptor) is paid out**. This caps daily exposure and prevents stacking.

---

## 🪙 Rewards & Coins System

SafeShift Coins reward consistent, honest engagement — redeemable as premium discounts.

### How to Earn Coins

| Activity | Coins Earned |
|---|---|
| Log in to the app each week | 10 coins/week |
| Maintain active policy for 4 consecutive weeks | 50 coins (one-time bonus) |
| Hold active policy during a verified disruption | 25 coins |
| Refer a fellow delivery partner | 100 coins |
| Complete profile to 100% | 20 coins |
| Maintain clean claim history for 6 months | 75 coins |

### How to Redeem

| Redemption | Cost |
|---|---|
| ₹5 off next week's premium | 100 coins |
| 1 free week on the Normal plan | 500 coins |

> The rewards system incentivises long-term subscription, reduces churn, and builds a community of engaged drivers — directly countering adverse selection.

---

## 🚀 Feature Set

### Core Features (Must-Have)

| # | Feature | Description |
|---|---|---|
| 1 | **Zero-Touch Claims** | System auto-files and approves the claim the moment a trigger is detected and both gates pass. No manual action by the driver. |
| 2 | **Instant UPI Payout** | Approved payout reaches the worker's UPI account in **under 10 minutes** via Razorpay/UPI integration. |
| 3 | **AI Dynamic Pricing** | Weekly premium adjusted based on weather forecasts, zone risk, and driver history using ML models. |
| 4 | **Predictive Alert System** | Every Sunday, drivers receive a forecast of the upcoming week's disruption risk and their adjusted premium. No surprises. |
| 5 | **Hyper-Local Zone Risk Map** | Live interactive city heatmap showing real-time and forecasted disruption risk across delivery zones. |
| 6 | **Vernacular Language Support** | Full app experience in Hindi, Marathi, Tamil, Telugu, and English — selected at first launch. |
| 7 | **Rewards & Coins System** | Gamified engagement system rewarding consistent subscription and honest claims behavior. |

### Predictive Alert System — Deep Dive

**What it does:** Instead of reacting after a disruption, SafeShift **predicts dangerous periods in advance** and notifies workers proactively — every Sunday before the week begins.

**How it works:**
1. Every Sunday, the forecasting model analyses the **7-day weather outlook** for each pincode zone.
2. If a **high-risk week is predicted** → Workers in that zone receive an advance alert with their coverage status and adjusted premium.
3. If the **next month shows an elevated disruption pattern** → A monthly outlook alert is sent.
4. Workers can **plan rest days, manage household expenses, and inform family** — before the disruption arrives.

> **Most insurance is reactive — it pays after damage is done. SafeShift is proactive — giving workers financial peace of mind and real planning ability before any disruption hits.**

### Dangerous Week Premium Warning

When the AI predicts a high-risk week ahead, the premium may increase by up to **+₹20** — but the worker is **always notified in advance every Sunday** with a clear explanation.

| Forecast | Premium Change | Notification Example |
|---|---|---|
| Safe week | Premium stays at base or decreases | "Good news! Normal premium this week: ₹80" |
| Moderate risk | +₹10 | "Moderate rain expected. Premium this week: ₹90" |
| Dangerous week | +₹20 | "Heavy rain forecast in your zone. Premium: ₹100. You're covered!" |

Workers can choose to **upgrade, maintain, or pause** their plan before Monday renewal. **Full transparency. No surprises. Ever.**

### Hyper-Local Zone Risk Map

**What workers see:**
- Their current registered zone highlighted on the map
- 🔴 **Red zones** — High disruption risk (heavy rain / AQI / flood predicted or active)
- 🟠 **Orange zones** — Moderate risk, caution advised
- 🟢 **Green zones** — Safe, low disruption probability
- Toggle between **"This Week"** and **"Next Week"** forecast view

**What admin / insurer sees:**
- City-wide risk distribution with claim concentration overlay
- Expected payout volume per zone (colour intensity = claim probability)
- Historical disruption frequency heatmap per pincode

**Implementation:** Leaflet.js with OpenWeatherMap data and internally calculated zone risk scores.

---

## 🛡️ Intelligent Fraud Detection

SafeShift employs a multi-layered, automated verification engine to ensure parametric payouts are only triggered for legitimate income losses. By eliminating manual claims, the AI acts as a real-time gatekeeper against exploitation.

### 1. Intent-to-Work Validation (Active Ping Analysis)

* **The Problem:** Preventing "Ghost Claims" where a driver is inactive (on holiday or vehicle in repair) during a regional disruption.
* **Technical Solution:** Before payout authorization, SafeShift "pings" the **Mock Porter/Platform API** to verify the driver's real-time status.
* **Logic:** Payouts are only triggered if the status is `Online`, `Searching`, or `On_Trip`. If the driver is `Offline`, the automated claim is suppressed as no "Income Opportunity" was lost.

### 2. Location Integrity (Multi-Source Verification)

* **The Problem:** Detecting "Double-Dipping" where drivers use GPS-spoofing apps to appear in a high-risk disruption zone while actually working in a safe, adjacent zone.
* **Technical Solution:** We implement a cross-verification layer that matches GPS coordinates against **IP-based Geolocation** data.
* **Logic:** If the GPS-reported zone doesn't align within a defined radius, the system flags a "Location Anomaly" and halts the automated transaction.

### 3. Temporal Asset Locking (Re-trigger Guard)

* **The Problem:** Preventing "Multiple-Payout Fraud" caused by volatile parametric events (e.g., rainfall crossing and re-crossing thresholds multiple times in one day).
* **Technical Solution:** We implement a **24-hour Lifecycle Lock** on the **Unique Vehicle Hash** (derived from the RC and Chassis numbers).
* **Logic:** Once a payout is successfully initiated for a specific vehicle ID, the asset's state is set to `CLAIM_PROCESSED` in the database. Any subsequent triggers within the same calendar day for that specific vehicle are automatically ignored.

---


## 📱 Platform Choice — Why Mobile?

| Factor | Mobile App ✅ | Web App ❌ |
|---|---|---|
| Porter driver behavior | Drivers operate entirely from their **mobile phones** — Porter app is mobile-only | Web requires laptop/desktop access, which most LCV drivers don't use for work |
| Push notifications | **Critical for real-time disruption alerts** and payout confirmations | Browser notifications unreliable and often blocked |
| GPS access | Required for **Gate 2 activity validation** and UBI zone mapping | Web GPS is limited and less reliable |
| UPI integration | Deep links to UPI apps (GPay, PhonePe, Paytm) for instant payouts | Web UPI experience is clunky |
| Offline capability | Can cache zone maps and policy details for areas with poor connectivity | Web requires constant internet |
| Aadhaar eKYC | Native camera and NFC access for document scanning | Web-based KYC has higher drop-off rates |

> **Decision: Mobile-first (React Native)** — because LCV drivers live on their phones, and every critical feature (GPS, notifications, UPI, camera) works better natively.

---

## 🎨 UI/UX Design Capabilities

### 1. Vernacular Language Support

The entire app — onboarding, dashboard, alerts, notifications, and claim feed — is available in **regional Indian languages** from the very first screen.

| Language | Region Coverage |
|---|---|
| **Hindi** | Primary — widest reach (Delhi-NCR, UP, MP, Rajasthan) |
| **Marathi** | Pune / Mumbai delivery zones |
| **Tamil** | Chennai / Coimbatore zones |
| **Telugu** | Hyderabad zones |
| **English** | Default fallback |

**Implementation:** React i18next library handles all language switching. Worker selects preferred language at first launch — saved and applied consistently to every screen, notification, and communication.

### 2. Optimized Onboarding (Frictionless & Mobile-First)

Since LCV drivers are often on the move and use mobile platforms like Porter, onboarding must be **frictionless and mobile-first**.

| Step | Feature | Detail |
|---|---|---|
| 1 | **One-Click Registration** | Aadhaar eKYC for instant identity verification + OCR-based document reading for Driving License and Vehicle RC |
| 2 | **Bank/UPI Validation** | Penny-drop verification to ensure the bank account for premium deductions and instant payouts is genuine |
| 3 | **Persona Focus** | Driver selects primary operating city (e.g., Delhi-NCR) to calibrate local risk factors |
| 4 | **Tier Selection** | Simple visual comparison of Normal / Medium / High tiers with clear pricing and coverage |
| 5 | **Language Selection** | Choose preferred language — applied across entire app experience |

**Target:** Complete onboarding in **under 3 minutes**.

### 3. Dashboard Design

**Worker Dashboard:**
- Weekly coverage status (active/expired)
- Real-time zone risk map
- Earnings protected this month
- Claim history with instant status updates
- Coin balance and redemption options
- Upcoming week's forecast and premium

**Admin/Insurer Dashboard:**
- Loss ratios by zone and tier
- Predictive analytics: next week's expected claim volume
- Driver cohort analysis
- Geographic risk distribution
- Revenue vs. payout trend charts

### 4. Accessibility Features

- Large, high-contrast buttons (designed for use while standing near vehicle)
- Voice-assisted navigation for low-literacy users
- Simple iconography with minimal text
- One-tap actions for all primary flows

---

## 🔄 Application Workflow

### End-to-End Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DRIVER ONBOARDING                            │
│                                                                     │
│  Download App → Select Language → Aadhaar eKYC → Upload DL & RC    │
│  → Penny-Drop Bank/UPI Verification → Select Operating City        │
│  → Choose Tier (Normal/Medium/High) → Pay First Week Premium       │
│  → Coverage Activated (after waiting period if applicable)          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WEEKLY CYCLE (Every Sunday)                      │
│                                                                     │
│  AI Model runs 7-day weather/AQI forecast for all zones            │
│  → Calculate WeatherRisk adjustment per zone                        │
│  → Calculate UBI adjustment per driver                              │
│  → FinalPremium = BasePremium + WeatherRisk + UBI                  │
│  → Send Sunday Alert: "Your premium this week is ₹XX because..."   │
│  → Auto-deduct premium via UPI on Monday                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  REAL-TIME MONITORING (24/7)                         │
│                                                                     │
│  Weather APIs ──┐                                                   │
│  AQI APIs ──────┤                                                   │
│  IMD Alerts ────┼──→ Trigger Detection Engine                       │
│  Platform API ──┤       │                                           │
│  News Scraper ──┘       ▼                                           │
│                   Threshold Breached?                                │
│                     │          │                                     │
│                    YES         NO → Continue monitoring              │
│                     │                                                │
│                     ▼                                                │
│              ┌─── GATE 1 ───┐                                       │
│              │ Environmental │                                       │
│              │   Trigger     │                                       │
│              │  Confirmed?   │                                       │
│              └──────┬───────┘                                       │
│                     │ YES                                            │
│                     ▼                                                │
│              ┌─── GATE 2 ───┐                                       │
│              │ Driver Active │                                       │
│              │  ≥45 min AND  │                                       │
│              │ GPS in zone?  │                                       │
│              └──────┬───────┘                                       │
│                     │ YES                                            │
│                     ▼                                                │
│              ┌──────────────┐                                       │
│              │ AUTO-APPROVE │                                       │
│              │    CLAIM     │                                       │
│              │  (1st event  │                                       │
│              │  of the day) │                                       │
│              └──────┬───────┘                                       │
│                     │                                                │
│                     ▼                                                │
│              ┌──────────────┐                                       │
│              │ INSTANT UPI  │                                       │
│              │   PAYOUT     │                                       │
│              │  (<10 mins)  │                                       │
│              └──────────────┘                                       │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ANALYTICS & FEEDBACK LOOP                        │
│                                                                     │
│  • Update driver's claim history & coin balance                    │
│  • Feed payout data back into AI pricing model                     │
│  • Update zone risk scores based on actual triggers                │
│  • Generate admin dashboard metrics (loss ratio, claim rate)       │
│  • Adjust next week's premium predictions                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Integration with Payment Gateways

| Integration | Purpose | Implementation |
|---|---|---|
| **Razorpay (Test Mode)** | Weekly premium auto-deduction | Razorpay Subscriptions API for recurring weekly payments |
| **UPI Deep Links** | Instant payout to driver | UPI Collect / Pay APIs via Razorpay Payouts |
| **Penny-Drop Verification** | Bank account validation during onboarding | Razorpay Verification API |
| **Payment Retry** | Handle failed premium deductions | Auto-retry with exponential backoff, 3 attempts before policy pause |

---

## 💡 Innovation & Impact

### What Makes SafeShift Different?

| Innovation Area | Our Approach |
|---|---|
| **Persona Specificity** | Built exclusively for LCV drivers on Porter — not a generic gig worker product. Every trigger, payout, and UX decision is calibrated for commercial vehicle logistics. |
| **Dual-Gate Verification** | No other parametric product combines environmental trigger data with real-time driver activity validation. This dramatically reduces fraud while keeping claims truly zero-touch. |
| **Predictive, Not Just Reactive** | Sunday forecasts + premium warnings = drivers can **plan ahead**, not just get compensated after the fact. |
| **Hyper-Local Zone Risk Mapping** | Pincode-level risk assessment, not city-level. A driver in Anand Vihar (high AQI zone) pays differently than one in Dwarka. |
| **Vernacular-First Design** | Not an afterthought — the app launches in the driver's language. Onboarding, claims, alerts — everything. |

### AI/ML Innovation

| Technique | Application |
|---|---|
| **Time-series forecasting (LSTM/Prophet)** | 7-day weather and AQI prediction per zone for dynamic pricing |
| **Gradient Boosted Trees (XGBoost)** | Driver risk scoring based on historical route/zone exposure |
| **NLP / News Scraping** | Real-time detection of curfew/bandh announcements from news and social media |
| **Anomaly Detection** | Identifying fraudulent GPS patterns and abnormal claim behavior |
| **Reinforcement Learning** | Optimizing premium adjustments to balance profitability and user retention |


---

## 🛠️ Tech Stack

### Frontend (Mobile Application)

| Technology | Purpose |
|---|---|
| **React Native** | Cross-platform mobile app (iOS + Android) |
| **React i18next** | Vernacular language support (Hindi, Marathi, Tamil, Telugu, English) |
| **Leaflet.js / React Native Maps** | Hyper-local zone risk heatmap |
| **React Navigation** | In-app navigation and screen management |
| **Lottie** | Animated UI elements (claim approved animation, coin rewards) |

### Backend

| Technology | Purpose |
|---|---|
| **Go (Golang)** | Core API server — high performance, low latency for real-time trigger processing |
| **Python (FastAPI)** | AI/ML microservice — dynamic pricing model, risk prediction, NLP scraping |
| **PostgreSQL** | Primary database — driver profiles, policies, claims, transactions |
| **Redis** | Caching layer — zone risk scores, session management, rate limiting |
| **Apache Kafka / RabbitMQ** | Event streaming — trigger detection events, claim processing pipeline |

### AI/ML

| Technology | Purpose |
|---|---|
| **Prophet / LSTM (TensorFlow)** | Weather and AQI time-series forecasting |
| **XGBoost / LightGBM** | Driver risk scoring and UBI calculation |
| **scikit-learn** | Anomaly detection for fraud prevention |
| **spaCy / BeautifulSoup** | NLP-based news scraping for curfew/bandh detection |

### External APIs & Data Sources

| API | Purpose |
|---|---|
| **CPCB / AQI India API** | Real-time Air Quality Index data |
| **OpenWeatherMap API** | Weather data — rainfall, wind speed, forecasts |
| **Open-Meteo API** | Cyclone tracking, wind speed alerts |
| **IMD (India Meteorological Department)** | Official weather warnings and cyclone alerts |
| **StatusGator / Simulated Platform API** | Platform outage detection |
| **News/Social Media Scraper** | Curfew and bandh detection |

### DevOps & Infrastructure

| Technology | Purpose |
|---|---|
| **Docker + Kubernetes** | Containerized deployment |
| **AWS (EC2, RDS, S3, Lambda)** | Cloud infrastructure |
| **GitHub Actions** | CI/CD pipeline |
| **Razorpay (Test Mode)** | Payment gateway — premium collection and instant UPI payouts |

---

## 📅 Roadmap

| Phase | Period | Goal |
|---|---|---|
| Seed (Phase 1) | Mar 4 – Mar 20 | Problem research, solution design, README, 2-min video |
| Scale (Phase 2) | Mar 21 – Apr 4 | Working prototype — onboarding, premium calculation, trigger demo |
| Soar (Phase 3) | Apr 5 – Apr 17 | Payout simulation, dashboards, fraud checks, final pitch |

---

## 📚 References & Data Sources

1. **CPCB (Central Pollution Control Board)** — Historical AQI data for Delhi-NCR, Mumbai, Bangalore (2019–2025)
2. **IMD (India Meteorological Department)** — Rainfall records, cyclone data, weather warnings
3. **SIAM (Society of Indian Automobile Manufacturers)** — LCV fleet data, vehicle registration statistics
4. **ICRA Reports** — LCV financing trends, EMI data, fleet operator economics
5. **TeamLease / NITI Aayog** — Gig economy workforce reports, platform worker statistics
6. **CAQM (Commission for Air Quality Management)** — GRAP framework and restriction protocols
7. **Porter Press Releases & Driver Community Forums** — Driver earnings data, operational patterns
8. **RedSeer Consulting** — India logistics market growth reports
9. **OpenWeatherMap, Open-Meteo** — Weather API documentation and historical data
10. **PMFBY (Pradhan Mantri Fasal Bima Yojana)** — Parametric insurance model reference for agriculture

---

<p align="center">
  <b>SafeShift</b> — Because no driver should lose their livelihood to the weather.<br/>
  <i>Team Code Mavens | Guidewire DEVTrails 2026</i>
</p>
