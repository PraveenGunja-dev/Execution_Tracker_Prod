# AGEL Commissioning Status - Setup & Run Guide

This project has been migrated to a **Full-Stack Next.js** architecture. The FastAPI backend has been removed, and all logic now resides within Next.js API routes.

## 🛠️ Prerequisites
- **Node.js** (v18.x or later)
- **Docker** (for PostgreSQL database)
- **npm** or **yarn**

---

## 🚀 Step-by-Step Setup

### 1. Database Setup (Docker)
The project uses PostgreSQL 15. Start the database container using Docker Compose:
```powershell
docker-compose up -d
```
*This will start a container named `adani-postgres` on port `5432`.*

### 2. Environment Variables
Create a `.env` file in the root directory and add your connection string:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/adani_tracker"
```

### 3. Install Dependencies
Install all required Node.js packages:
```powershell
npm install
```

### 4. Database Schema Setup (Prisma)
Sync the database with the Prisma schema:
```powershell
npx prisma db push
```
*This command creates the necessary tables in your PostgreSQL database.*

### 5. Start the Application
Run the development server:
```powershell
npm run dev
```
The application will be available at:
- **Dashboard**: [http://localhost:3000/application](http://localhost:3000/application)

---

## 📊 Project Structure
- `/app`: Next.js pages and API routes.
- `/app/components`: React components including the main Commissioning page.
- `/lib`: Shared utilities and the Excel parser.
- `/prisma`: Database schema definition.

## 📁 Key Features
- **Excel Upload**: Upload consolidated workbooks to populate the tracker.
- **Inline Editing**: Admins can edit monthly capacity values directly in the table.
- **Dynamic Tabs**: Solar and Wind tabs are generated automatically based on uploaded data.
