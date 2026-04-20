# AGEL Commissioning Dashboard - Technical Documentation

## Overview
This document describes the mathematical logic, data sources, and calculations used throughout the AGEL Commissioning Dashboard.

---

## Data Source
All data is fetched from the `CommissioningProject` database table via the `/api/commissioning-projects` API endpoint.

### Key Fields:
- **sno**: Serial number
- **projectName**: Project identifier
- **spv**: Special Purpose Vehicle
- **projectType**: Business model (PPA, Merchant, Group)
- **category**: Technology category (Solar, Wind)
- **section**: Project section (A, B, C, D1, D2)
- **planActual**: Row type (Plan, Rephase, Actual)
- **capacity**: Total planned capacity (MW)
- **apr, may, jun, jul, aug, sep, oct, nov, dec, jan, feb, mar**: Monthly phasing values (MW)
- **includedInTotal**: Boolean flag indicating if project counts toward totals

---

## Executive Summary Metrics (KPI Cards)

### 1. Total Plan (MW)
**Formula:**
```
Total Plan = SUM(capacity) WHERE planActual = 'Plan' AND includedInTotal = true
```

### 2. Total Actual (MW)
**Formula:**
```
Total Actual = SUM(totalCapacity) WHERE planActual = 'Actual' AND includedInTotal = true
```
Note: `totalCapacity` = SUM(apr + may + jun + jul + aug + sep + oct + nov + dec + jan + feb + mar)

### 3. Achievement %
**Formula:**
```
Achievement % = (Total Actual / Total Plan) × 100
```
Note: If Total Plan = 0, Achievement = 0

### 4. Project Count
**Formula:**
```
Project Count = COUNT(DISTINCT sno|projectName|spv|section|category) WHERE planActual = 'Plan' AND includedInTotal = true
```

---

## Quarterly Calculations

### Quarter Definitions (Fiscal Year):
- **Q1**: April + May + June (Apr-Jun)
- **Q2**: July + August + September (Jul-Sep)
- **Q3**: October + November + December (Oct-Dec)
- **Q4**: January + February + March (Jan-Mar)

**Formula for each quarter:**
```
Q1 = apr + may + jun
Q2 = jul + aug + sep
Q3 = oct + nov + dec
Q4 = jan + feb + mar
```

---

## Cumulative Till Date

### Cumulative Till November (Displayed as "Cumm till 30-Nov-25")
**Formula:**
```
CummTillNov = apr + may + jun + jul + aug + sep + oct + nov
```

---

## Technology Mix Chart (Pie Chart)

### Purpose:
Shows the distribution of capacity between Solar and Wind technologies.

### Calculation:
```
Solar Value = SUM(capacity) WHERE category CONTAINS 'solar' AND planActual = 'Plan' AND includedInTotal = true
Wind Value = SUM(capacity) WHERE category CONTAINS 'wind' AND planActual = 'Plan' AND includedInTotal = true

Solar % = (Solar Value / Total Value) × 100
Wind % = (Wind Value / Total Value) × 100
```

---

## Business Model Split Chart (Pie Chart)

### Purpose:
Shows capacity distribution across business models (PPA, Merchant, Group).

### Calculation:
```
For each model type (PPA, Merchant, Group):
  Model Value = SUM(capacity) WHERE projectType = model AND planActual = 'Plan' AND includedInTotal = true

Model % = (Model Value / Total Value) × 100
```

---

## Quarterly Performance Chart (Bar Chart)

### Purpose:
Compares planned vs actual commissioning on a quarterly basis.

### Calculation:
```
For each quarter (Q1, Q2, Q3, Q4):
  PPA Plan = SUM(q[n]) WHERE planActual = 'Plan' AND includedInTotal = true
  Actual Commissioning = SUM(q[n]) WHERE planActual = 'Actual' AND includedInTotal = true
```

### Cumulative Mode:
```
Cumulative Value = Running sum of previous quarters + current quarter
```

---

## Monthly Trend Chart (Line/Bar Chart)

### Purpose:
Shows monthly commissioning trends for Plan vs Actual.

### Calculation:
```
For each month (apr, may, ... mar):
  Plan Value = SUM(month_field) WHERE planActual = 'Plan' AND includedInTotal = true
  Actual Value = SUM(month_field) WHERE planActual = 'Actual' AND includedInTotal = true
```

---

## Deviation Analysis Chart (Bar Chart)

### Purpose:
Shows the difference between Actual and Plan for each period.

### Formula:
```
Deviation = Actual Commissioning - PPA Plan
```

### Interpretation:
- **Positive Deviation (Green)**: Ahead of schedule
- **Negative Deviation (Red)**: Behind schedule, action required

---

## Solar Portfolio Summary

### Filters Applied:
- category CONTAINS 'solar'
- includedInTotal = true

### Metrics:
```
Solar Total Plan = SUM(capacity) WHERE category CONTAINS 'solar' AND planActual = 'Plan'
Solar Total Actual = SUM(totalCapacity) WHERE category CONTAINS 'solar' AND planActual = 'Actual'
Solar Achievement = (Solar Total Actual / Solar Total Plan) × 100
Solar Project Count = COUNT(DISTINCT projects) WHERE category CONTAINS 'solar' AND planActual = 'Plan'
```

---

## Wind Portfolio Summary

### Filters Applied:
- category CONTAINS 'wind'
- includedInTotal = true

### Metrics:
```
Wind Total Plan = SUM(capacity) WHERE category CONTAINS 'wind' AND planActual = 'Plan'
Wind Total Actual = SUM(totalCapacity) WHERE category CONTAINS 'wind' AND planActual = 'Actual'
Wind Achievement = (Wind Total Actual / Wind Total Plan) × 100
Wind Project Count = COUNT(DISTINCT projects) WHERE category CONTAINS 'wind' AND planActual = 'Plan'
```

---

## Summary Table (Executive Summary)

### Row Types:
1. **Plan**: Total planned capacity aggregated by business model
2. **Rephase**: Revised/rephased capacity
3. **Actual/Fcst**: Actual achieved or forecasted capacity

### Aggregation:
```
For each row type and business model:
  For each month column:
    Value = SUM(month_field) WHERE planActual = rowType AND projectType = businessModel
```

---

## Section Breakdown (Solar/Wind Pages)

### Solar Sections:
- **A**: Khavda Solar Projects (Included in Total)
- **B**: Rajasthan Solar Projects (Included in Total)
- **C**: Rajasthan Solar Additional 500MW (Included in Total)
- **D1**: Khavda Copper+Merchant (Excluded from Total)
- **D2**: Khavda Internal (Excluded from Total)

### Wind Sections:
- **A**: Khavda Wind Projects (Included in Total)
- **B**: Mundra Wind (Included in Total)
- **C**: Wind Other Projects (Excluded from Total)
- **D**: Rephased Wind Projects (Excluded from Total)

### Section Totals:
```
Section Total = SUM(capacity/monthly values) WHERE section = 'X' AND planActual = 'Plan'
```

---

## Rephase Handling

**Definition**: Rephase represents revised commissioning schedule when original plan cannot be met.

**Display**: Shown as separate rows in Summary Tables with amber/yellow highlighting.

---

## Measurement Logic Statement (As shown in UI)

```
% ACHIEVEMENT = (ACTUAL ÷ PLAN) × 100
TECHNOLOGY MIX = (VALUE ÷ TOTAL CAPACITY) × 100
EXECUTION DEVIATION = ACTUAL - PLAN TARGET
```

---

## User Permissions

### Admin/Superadmin:
- Can edit cell values (with confirmation dialog)
- Can view all data
- Can access Master Data management

### Regular Users:
- Can view data only
- Cannot edit cell values
- Can export data

---

## Data Visibility

All data is visible to all authenticated users. The data is stored globally in the database and is not user-specific. When superadmin uploads data, it is available to all users upon login.

---

## File Version
- **Created**: January 2026
- **Last Updated**: January 9, 2026
- **Application**: AGEL FY 25-26 Commissioning Tracker
