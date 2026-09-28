# 🚛 TruckPro – MERN Fleet Management System

Full-stack Truck Management System built with **MongoDB + Express + React + Node.js**.

## Features

### Phase 1 + Core (Included)
- **Dashboard** – Total/Active/In-Transit trucks, revenue, profit, fuel, document alerts, FASTag low balance
- **Trucks** – Full profile (number, brand, model, mileage, fuel type, tank, status, FASTag)
- **Drivers** – Profile + Assign/Unassign to trucks
- **Documents** – RC, Insurance, PUC, Fitness, Permit… with expiry status & alerts
- **Trip Calculator** – Core engine: Fuel, Travel Time, Cost, Profit % + **formula breakdown**
- **Trips** – List of calculated/saved trips
- **Settings** – Diesel/CNG/Petrol price, default expenses
- **Dark / Light mode**, responsive UI

### Calculation Engine (Backend)
```
Fuel Required = Distance ÷ Mileage
Fuel Cost     = Fuel Required × Current Fuel Price
Travel Time   = Distance ÷ Avg Speed
Total Expense = Fuel + Toll + Driver + Other
Profit %      = (Revenue − Total Expense) ÷ Revenue × 100
```
Frontend shows full formula breakdown for transparency.

## Requirements
- Node.js 18+
- MongoDB (local or Atlas)

## Setup

### 1. MongoDB
```bash
# Local
mongod

# OR use MongoDB Atlas – put URI in server/.env
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/truckpro
```

### 2. Backend
```bash
cd server
npm install
cp .env.example .env   # edit if needed
npm run seed           # creates admin + sample data
npm run dev            # http://localhost:5000
```

### 3. Frontend
```bash
cd client
npm install
npm run dev            # http://localhost:3000
```

### Login
```
Email:    admin@truck.com
Password: admin123
```

## Project Structure
```
truck-mern/
├── server/
│   ├── models/        # User, Truck, Driver, Document, Trip, Toll, Fuel, Maintenance, Settings
│   ├── routes/        # API endpoints
│   ├── utils/calc.js  # Calculation engine
│   ├── seed.js
│   └── index.js
├── client/
│   └── src/
│       ├── pages/     # Dashboard, Trucks, Drivers, Documents, Calculator, Trips, Settings
│       ├── components/
│       └── hooks/
└── README.md
```

## Future Phases (as planned)
- Maintenance module
- Fuel history + dynamic mileage
- Full Toll/FASTag management
- Route/Distance API integration
- Reports
