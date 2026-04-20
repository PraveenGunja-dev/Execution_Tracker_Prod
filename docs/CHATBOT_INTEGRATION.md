# Chatbot Integration Documentation
## AGEL Commissioning Execution Tracker

---

## 1. Project Overview

This is a **Commissioning Status Tracking System** for AGEL (Adani Green Energy Limited) that tracks Solar and Wind project commissioning progress for FY 2025-26.

### Key Features:
- Executive Dashboard with KPIs
- Solar Portfolio Status Page
- Wind Portfolio Status Page
- Excel Upload functionality
- Role-based access (SuperAdmin, Admin, User)

---

## 2. Database Schema

### Primary Table: `commissioning_projects`

```sql
CREATE TABLE commissioning_projects (
    id              SERIAL PRIMARY KEY,
    fiscal_year     VARCHAR(20),
    sno             INTEGER,
    project_name    VARCHAR(255),
    spv             VARCHAR(255),
    project_type    VARCHAR(100),  -- PPA, Merchant, Group
    plot_location   VARCHAR(255),
    capacity        FLOAT,          -- Total project capacity in MW
    plan_actual     VARCHAR(50),    -- Plan, Rephase, Actual
    
    -- Monthly phasing (MW commissioned per month)
    apr FLOAT, may FLOAT, jun FLOAT,
    jul FLOAT, aug FLOAT, sep FLOAT,
    oct FLOAT, nov FLOAT, dec FLOAT,
    jan FLOAT, feb FLOAT, mar FLOAT,
    
    -- Derived values
    total_capacity  FLOAT,          -- Sum of all months
    cumm_till_oct   FLOAT,          -- Cumulative Apr-Nov
    q1 FLOAT, q2 FLOAT, q3 FLOAT, q4 FLOAT,
    
    -- Categorization
    category        VARCHAR(255),   -- e.g., "Khavda Solar", "Khavda Wind"
    section         VARCHAR(10),    -- A, B, C, D, D1, D2
    included_in_total BOOLEAN,      -- Whether included in official totals
    is_deleted      BOOLEAN DEFAULT FALSE,
    
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);
```

### Categories in System:
- **Solar**: Khavda Solar, Rajasthan Solar, Rajasthan Solar Additional 500MW, Khavda Solar Copper+Merchant 50MW, Khavda Solar Internal 650MW
- **Wind**: Khavda Wind, Khavda Wind Internal 421MW, Mundra Wind 76MW, Mundra Wind Internal 224.4MW

### Sections:
- A, B, C = Included in official totals
- D, D1, D2 = Excluded from official totals (internal/copper projects)

---

## 3. API Endpoints

### GET `/api/commissioning-projects`
Returns all projects for a fiscal year.

**Query Params:**
- `fiscalYear` (default: "FY_25-26")

**Response:**
```json
[
  {
    "id": 1,
    "projectName": "AGEL Merchant",
    "capacity": 250,
    "planActual": "Plan",
    "apr": 100, "may": 0, "jun": 0, ...
    "totalCapacity": 250,
    "q1": 100, "q2": 150, "q3": 0, "q4": 0,
    "category": "Khavda Solar",
    "section": "A",
    "includedInTotal": true
  },
  ...
]
```

### GET `/api/commissioning-summaries`
Returns aggregated summary data.

### POST `/api/commissioning-projects`
Saves/updates project data.

---

## 4. Key Business Logic

### Quarterly Breakdown:
- **Q1** = April + May + June
- **Q2** = July + August + September
- **Q3** = October + November + December
- **Q4** = January + February + March

### Total Capacity Formula:
```
Total Capacity = Q1 + Q2 + Q3 + Q4 = Sum(Apr to Mar)
```

### Cumulative Till Nov:
```
Cumm Till Nov = Apr + May + Jun + Jul + Aug + Sep + Oct + Nov
```

### Achievement Calculation:
```
Achievement % = (Actual Total Capacity / Plan Total Capacity) * 100
```

### Technology Mix:
```
Solar % = Solar Actual / Total Actual * 100
Wind % = Wind Actual / Total Actual * 100
```

---

## 5. Sample Queries for Chatbot

### "What is the total planned capacity for Solar?"
```javascript
const solarPlan = await prisma.commissioningProject.aggregate({
  where: { 
    category: { contains: 'Solar' }, 
    planActual: 'Plan',
    includedInTotal: true,
    isDeleted: false 
  },
  _sum: { capacity: true }
});
// Returns: 5493.5 MW
```

### "How many projects are there?"
```javascript
const count = await prisma.commissioningProject.count({
  where: { isDeleted: false, planActual: 'Plan' }
});
// Returns count of unique Plan rows
```

### "What was commissioned in October?"
```javascript
const octTotal = await prisma.commissioningProject.aggregate({
  where: { planActual: 'Actual', includedInTotal: true, isDeleted: false },
  _sum: { oct: true }
});
```

### "Compare Plan vs Actual for Khavda Solar"
```javascript
const comparison = await prisma.commissioningProject.groupBy({
  by: ['planActual'],
  where: { category: 'Khavda Solar', includedInTotal: true },
  _sum: { totalCapacity: true }
});
```

---

## 6. Current Data Summary (as of Jan 2026)

| Metric | Solar | Wind | Total |
|--------|-------|------|-------|
| Plan (MW) | 5,493.5 | 1,579 | 7,072.5 |
| Rephase (MW) | - | - | - |
| Actual/Fcst (MW) | - | - | - |
| Projects | ~80 | ~49 | 129 |

---

## 7. User Roles

| Role | Permissions |
|------|-------------|
| SUPER_ADMIN | All access + Reset Data |
| ADMIN | Edit projects, Upload Excel |
| USER | View only |

---

## 8. Chatbot Suggested Capabilities

1. **Data Queries**: Answer questions about capacity, projects, monthly performance
2. **Comparisons**: Plan vs Actual, Solar vs Wind, Quarter comparisons
3. **Trends**: Monthly/Quarterly trends, YTD performance
4. **Filtering**: By category, section, project type (PPA/Merchant/Group)
5. **Calculations**: Achievement %, deviation from plan, forecasts

---

## 9. Tech Stack

- **Frontend**: Next.js 14, React, TailwindCSS, Recharts
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL
- **ORM**: Prisma
- **State**: TanStack Query (React Query)

---

## 10. Files to Review

- `/prisma/schema.prisma` - Database schema
- `/lib/excelParser.ts` - Excel parsing logic
- `/app/api/commissioning-projects/route.ts` - Main API
- `/app/components/CommissioningStatusPage.tsx` - Main dashboard
- `/app/components/SolarStatusPage.tsx` - Solar page
- `/app/components/WindStatusPage.tsx` - Wind page
- `/MATH_LOGIC.md` - Calculation formulas

---

## 11. Sample Data Export

To get current data as JSON for the chatbot:

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.commissioningProject.findMany({ where: { isDeleted: false } }).then(d => { require('fs').writeFileSync('data_export.json', JSON.stringify(d, null, 2)); console.log('Exported', d.length, 'projects'); p.$disconnect(); });"
```

---

**Contact for questions about this integration.**
