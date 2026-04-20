# AGEL Commissioning Dashboard - Complete Calculation Logic

## Document Purpose
This document provides detailed explanations of all mathematical calculations used in the AGEL Commissioning Dashboard. Use this to explain the logic to stakeholders when asked.

---

## 📊 SECTION 1: KPI CARDS (Top Row)

### 1.1 PPA PORTFOLIO TARGET (6,614.6 MW)
**What it shows:** Total planned capacity across all projects for the fiscal year

**Calculation:**
```
PPA Portfolio Target = SUM(capacity) 
WHERE:
  - planActual = 'Plan'
  - includedInTotal = true
  - fiscalYear = 'FY_25-26'
```

**Why this logic:**
- We only count PLAN rows (not Actual or Rephase)
- We exclude projects marked `includedInTotal = false` (like Khavda Internal/Merchant which are tracked separately)
- The capacity field stores the original planned MW for each project

**Base: 34 Project Segments:** Count of unique projects that contribute to this target
```
Project Count = COUNT(DISTINCT sno + projectName + spv + section + category)
WHERE planActual = 'Plan' AND includedInTotal = true
```

---

### 1.2 ACTUAL COMMISSIONING (5,520.2 MW)
**What it shows:** Total MW actually commissioned (or forecasted) to date

**Calculation:**
```
Actual Commissioning = SUM(totalCapacity)
WHERE:
  - planActual = 'Actual'
  - includedInTotal = true
  - fiscalYear = 'FY_25-26'
```

**totalCapacity is calculated as:**
```
totalCapacity = apr + may + jun + jul + aug + sep + oct + nov + dec + jan + feb + mar
```

**Why this logic:**
- ACTUAL rows contain the real commissioned values per month
- totalCapacity is the sum of all monthly phasing values
- "Actual vs Target Phasing" subtitle indicates we're comparing actual delivery against plan

---

### 1.3 STATUS PERFORMANCE (83.45%)
**What it shows:** Achievement percentage - how much of the plan has been delivered

**Calculation:**
```
Status Performance = (Actual Commissioning / PPA Portfolio Target) × 100
                   = (5,520.2 / 6,614.6) × 100
                   = 83.45%
```

**Why this logic:**
- Standard achievement formula
- Shows progress toward the annual target
- "Actual / Plan Target (FY)" subtitle clarifies this is full fiscal year achievement

---

### 1.4 EXECUTION DEVIATION (-1,094.4 MW)
**What it shows:** Gap between what was planned vs what was actually delivered

**Calculation:**
```
Execution Deviation = Actual Commissioning - PPA Portfolio Target
                    = 5,520.2 - 6,614.6
                    = -1,094.4 MW
```

**Interpretation:**
- **Negative value (Red):** Behind schedule by this many MW
- **Positive value (Green):** Ahead of schedule
- "Delta: Actual - Plan" subtitle confirms this formula

---

## 📊 SECTION 2: CHART CARDS (Row 2)

### 2.1 OVERALL ACHIEVEMENT GAUGE (83.5%)

**What it shows:** Visual representation of achievement with donut chart

**Calculation:**
```
Achievement % = (Total Actual / Total Plan) × 100

Where:
- Total Plan = 6,614.6 MW (FULL FY TARGET shown at top)
- Total Actual = 5,520.2 MW (shown at bottom as "ACHIEVED")
```

**Filter Options:**
- **All Categories / Solar / Wind:** Filters projects by technology type
- **All Projects / Specific Project:** Filters to individual project
- **Yearly / Half / Quarterly / Monthly:** Changes the time period for the calculation

**When Half-Yearly is selected:**
```
H1 (Apr-Sep):
  Plan = apr + may + jun + jul + aug + sep (for Plan rows)
  Actual = apr + may + jun + jul + aug + sep (for Actual rows)

H2 (Oct-Mar):
  Plan = oct + nov + dec + jan + feb + mar (for Plan rows)
  Actual = oct + nov + dec + jan + feb + mar (for Actual rows)
```

**When Quarterly is selected:**
```
Q1 = apr + may + jun
Q2 = jul + aug + sep
Q3 = oct + nov + dec
Q4 = jan + feb + mar
```

---

### 2.2 TECHNOLOGY MIX (Pie Chart)

**What it shows:** Distribution of capacity between Solar and Wind technologies

**Calculation:**
```
For each technology (Solar/Wind):

Technology Value = SUM(capacity)
WHERE:
  - category CONTAINS 'solar' (or 'wind')
  - planActual = 'Plan'
  - includedInTotal = true

Technology % = (Technology Value / Total Capacity) × 100
```

**From your screenshot:**
- Solar: 83.1% of 6,614.6 MW = ~5,497 MW
- Wind: 16.9% of 6,614.6 MW = ~1,118 MW

**Center Display:** Shows total capacity (6,614.6 MW)

---

### 2.3 BUSINESS MODEL SPLIT (Pie Chart)

**What it shows:** Distribution of capacity by business model type

**Calculation:**
```
For each model type (PPA/Merchant/Group):

Model Value = SUM(capacity)
WHERE:
  - projectType = 'PPA' (or 'Merchant' or 'Group')
  - planActual = 'Plan'
  - includedInTotal = true

Model % = (Model Value / Total Capacity) × 100
```

**From your screenshot:**
- PPA: 60.0%
- Merchant: 32.7%
- Group: 7.3%

**Why these categories:**
- **PPA (Power Purchase Agreement):** Long-term contracted power sales
- **Merchant:** Power sold on open market
- **Group:** Internal/captive consumption

---

## 📊 SECTION 3: QUARTERLY PERFORMANCE CHART

**What it shows:** Comparison of Actual vs Plan vs Rephase by quarter

**Bar Colors:**
- 🟩 **Green (Actual):** What was actually commissioned
- 🟦 **Blue (Plan):** Original planned commissioning
- 🟨 **Yellow/Orange (Rephase):** Revised plan when original couldn't be met

**Calculation for each quarter:**
```
Q1 Data:
  Actual Q1 = SUM(apr + may + jun) WHERE planActual = 'Actual' AND includedInTotal = true
  Plan Q1 = SUM(apr + may + jun) WHERE planActual = 'Plan' AND includedInTotal = true
  Rephase Q1 = SUM(apr + may + jun) WHERE planActual = 'Rephase' AND includedInTotal = true

Similarly for Q2, Q3, Q4...
```

**Example from screenshot (Q1):**
- Actual: ~2,400 MW (Green bar)
- Plan: ~900 MW (Blue bar)
- Rephase: ~1,400 MW (Yellow bar)

**Interpretation:** Q1 actual exceeded both plan and rephase - strong performance!

---

## 📊 SECTION 4: DEVIATION ANALYSIS CHART

**What it shows:** Difference between Actual and Plan per time period

**Calculation:**
```
Deviation = Actual Value - Plan Value

For Quarterly view:
  Q1 Deviation = Actual Q1 - Plan Q1
  Q2 Deviation = Actual Q2 - Plan Q2
  ...
```

**Bar Colors:**
- 🟩 **Green (Positive):** Ahead of plan
- 🟥 **Red (Negative):** Behind plan

**From your screenshot:**
- Q1: ~-1,500 MW (Red - behind)
- Q2: ~+200 MW (Green - ahead)
- Q3: ~-500 MW (Red - behind)
- Q4: ~+700 MW (Green - ahead)

---

## 📊 SECTION 5: SOLAR PORTFOLIO CHARTS

### 5.1 Solar - Quarterly Absolute

**What it shows:** Solar-only commissioning by quarter

**Calculation:**
```
For Solar projects only:

Q1 Actual = SUM(apr + may + jun) WHERE category CONTAINS 'solar' AND planActual = 'Actual'
Q1 Plan = SUM(apr + may + jun) WHERE category CONTAINS 'solar' AND planActual = 'Plan'
```

**Bar Colors:**
- 🟧 **Orange:** Plan
- 🟩 **Green:** Actual

### 5.2 Solar - Monthly Monthly

**What it shows:** Month-by-month trend for Solar projects

**Calculation:**
```
For each month (Apr, May, Jun, ... Mar):
  Monthly Plan = SUM(month_field) WHERE category CONTAINS 'solar' AND planActual = 'Plan'
  Monthly Actual = SUM(month_field) WHERE category CONTAINS 'solar' AND planActual = 'Actual'
```

**Line Colors:**
- 🟧 **Orange Line:** Plan
- 🟩 **Green Line/Fill:** Actual

---

## 📊 SECTION 6: WIND PORTFOLIO CHARTS

### 6.1 Wind - Quarterly Absolute

**What it shows:** Wind-only commissioning by quarter

**Calculation:**
```
For Wind projects only:

Q1 Actual = SUM(apr + may + jun) WHERE category CONTAINS 'wind' AND planActual = 'Actual'
Q1 Plan = SUM(apr + may + jun) WHERE category CONTAINS 'wind' AND planActual = 'Plan'
```

**Bar Colors:**
- 🟦 **Cyan:** Plan
- 🟩 **Green:** Actual

### 6.2 Wind - Monthly Monthly

**What it shows:** Month-by-month trend for Wind projects

**Calculation:**
Same as Solar but filtered for Wind category

---

## 📊 SECTION 7: DATA SOURCES & FILTERS

### Project Filtering Logic

**Included in Totals (includedInTotal = true):**
```
Solar Sections:
  - A: Khavda Solar Projects ✓
  - B: Rajasthan Solar Projects ✓
  - C: Rajasthan Solar Additional 500MW ✓
  - D1: Khavda Copper+Merchant ✗ (excluded)
  - D2: Khavda Internal ✗ (excluded)

Wind Sections:
  - A: Khavda Wind Projects ✓
  - B: Mundra Wind ✓
  - C: Wind Other Projects ✗ (excluded)
  - D: Rephased Wind Projects ✗ (excluded)
```

### Row Types (planActual field)
- **Plan:** Original commissioning target
- **Actual:** Real/forecasted commissioning achieved
- **Rephase:** Revised target when original plan changes

---

## 📊 SECTION 8: VIEW MODES

### 8.1 Yearly View
Shows full fiscal year data (Apr 2025 - Mar 2026)

### 8.2 Half-Yearly View
- **H1:** April - September
- **H2:** October - March

### 8.3 Quarterly View
- **Q1:** April, May, June
- **Q2:** July, August, September
- **Q3:** October, November, December
- **Q4:** January, February, March

### 8.4 Monthly View
Individual month data

### 8.5 Absolute vs Cumulative
- **Absolute:** Shows individual period values
- **Cumulative:** Running total from start of fiscal year

---

## 📊 SECTION 9: CALCULATED FIELDS (Auto-Updated on Edit)

When any monthly value is edited, the system automatically recalculates:

```javascript
totalCapacity = apr + may + jun + jul + aug + sep + oct + nov + dec + jan + feb + mar
cummTillOct = apr + may + jun + jul + aug + sep + oct + nov  // 8 months
q1 = apr + may + jun
q2 = jul + aug + sep
q3 = oct + nov + dec
q4 = jan + feb + mar
```

---

## 📊 SECTION 10: DATA REFRESH FLOW

1. **User edits a cell** (e.g., changes `apr` value for a project)
2. **Confirmation dialog** appears asking to confirm the change
3. **PATCH API called** → Updates the specific field in database
4. **Backend recalculates** → totalCapacity, quarterly values updated
5. **Query invalidation** → All pages (Solar, Wind, Dashboard) refetch data
6. **UI updates** → All charts and KPIs reflect new values

---

## Document Version
- **Created:** January 9, 2026
- **Author:** AGEL Development Team
- **Application:** AGEL FY 25-26 Commissioning Tracker
