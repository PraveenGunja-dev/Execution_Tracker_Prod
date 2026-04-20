# AGEL Commissioning Status - Math Logic

This document defines the official mathematical logic for all calculations in the Commissioning Execution Tracker.

## 1. Project Phasing (Monthly to Quarterly)

Each project has monthly values from **April** to **March**. These are aggregated into quarters as follows:

- **Q1**: `April + May + June`
- **Q2**: `July + August + September`
- **Q3**: `October + November + December`
- **Q4**: `January + February + March`

## 2. Total Capacity Calculation

The **Total Capacity** for any row (individual project or summary) must always be the sum of all four quarters:

- **Total Capacity** = `Q1 + Q2 + Q3 + Q4`

> [!NOTE]
> This applies to **Plan**, **Rephase**, and **Actual / Fcst** rows equally. It ensures that the horizontal sub-totals always match the final total.

## 3. Cumulative Achievement (Cumm Till 30-Nov-25)

The cumulative column represents the total commissioning achieved from the start of the fiscal year up to the target date:

- **Cumm Till 30-Nov-25** = `April + May + June + July + August + September + October + November`

## 4. Summary Table Aggregation

In the Executive Summary tables (Solar / Wind / Overall), the data is grouped by **Project Type** (PPA, Merchant, Group).

- **Type Sub-totals**: Sum of all projects matching that specific type (e.g., `PPA Total = Sum of all PPA Projects`).
- **Category Grand Totals**: Sum of the three types:
  - `Grand Total = PPA + Merchant + Group`

---

## 5. Summary Tables Hierarchy (AGEL Overall)

The "AGEL Overall" table at the bottom of the page follows this logic:

- **AGEL Plan Total** = `Solar Plan + Wind Plan`
- **AGEL Rephase Total** = `Solar Rephase + Wind Rephase`
- **AGEL Actual Total** = `Solar Actual + Wind Actual`

---


