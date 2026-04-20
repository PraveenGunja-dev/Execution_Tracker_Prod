# AGEL Commissioning Execution Tracker

A chairman-level executive dashboard designed to visualize and track the AGEL FY 2025–26 Commissioning Status. This portal provides real-time insights into technology splits, regional deployment, and project-level performance achievement.

---

## 🏗️ Architecture Overview

- **Frontend & Backend**: Unified **Next.js 16** (App Router) using **React 19** and **Tailwind CSS**.
- **Database**: **SQLite** (local file `data/adani-excel.db`) managed by **Prisma ORM**.
- **Calculations**: All business metric calculations are handled within Next.js API routes.

---

## 🚀 Getting Started

To run this project locally, follow these steps:

### 1. Prerequisites
- **Node.js** (v18.x or later)

### 2. Setup & Run

1. **Install Dependencies**:
   ```powershell
   npm install
   ```

2. **Setup Database**:
   The project is pre-configured to use a local SQLite database.
   Ensure the schema is synced:
   ```powershell
   npx prisma db push
   ```

3. **Start the Development Server**:
   ```powershell
   npm run dev
   ```
   *The dashboard will be available at `http://localhost:3000/application`.*

---

## 🚀 Deployment / Production

To build and run the application in production mode:

1. **Build the Application**:
   ```powershell
   npm run build
   ```

2. **Start the Production Server**:
   ```powershell
   npm start
   ```

---

## 📊 Key Features for Executives

- **Executive Insights**: High-level overview of annual targets vs. actual commissioning (MW).
- **Technology Mix**: Interactive donut chart showing Solar vs. Wind distribution with "Target Portfolio" context.
- **Geographic Deployment**: Regional breakdown for Khavda, Rajasthan, and Mundra sites.
- **Cumulative Flow**: A line analysis comparing PPA Plan targets vs. Cumulative Actuals over time.
- **Responsive Slicers**: Dynamic filters for Fiscal Year, Site, Project, and Business Model (PPA/Merchant/Group).

---

## 🛠️ Tech Stack Specifics

- **State Management**: React Query (TanStack)
- **Styling**: Tailwind CSS (Glassmorphism & Dark Mode)
- **Charts**: Recharts & Chart.js
- **Animations**: Framer Motion
