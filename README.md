# 🚛 TruckPro – MERN Fleet Management System

Full-stack Truck Management System built with **MongoDB + Express + React + Node.js**.

## Features

### Fleet
- **Dashboard** – Revenue, net profit, distance/fuel, fleet size, drivers. Maintenance & document alerts, FASTag low balance, mini bar charts.
- **Trucks** – Full profile (number, brand, model, mileage, fuel type, tank, status, FASTag + live balance) and driver assignment.
- **Drivers** – Profile + assign/unassign to trucks.
- **Documents** – RC, Insurance, PUC, Fitness, Permit… with expiry status & alerts.
- **Maintenance** – Overdue / due service tracking (scanned automatically).
- **Notifications** – Live in-app alerts via **Socket.IO**: document expiry, FASTag low, maintenance due, trip start/complete/cancel. Bell with unread count + dedicated notifications page; clicking a notification opens its related page (documents/trucks/trips). Falls back to polling when websockets are unavailable (e.g. static hosting).
- **Trips** – Route planning w/ OSRM distance + duration, toll estimation (TollGuru + cache), fuel/profit engine, live status flow (Started → In Transit → Reached → Completed/Cancelled), driver auto-attached from the truck.
- **Trip Calculator** – Core engine preview: Fuel, Travel Time, Cost, Profit % with formula breakdown.
- **Settings** – Diesel/CNG/Petrol price, default expenses.
- **Dark / Light mode**, responsive UI, sign-in auth (JWT).

### Calculation Engine (Backend)
```
Fuel Required = Distance ÷ Mileage
Fuel Cost     = Fuel Required × Current Fuel Price
Travel Time   = Distance ÷ Avg Speed
Total Expense = Fuel + Toll + Driver + Other
Profit %      = (Revenue − Total Expense) ÷ Revenue × 100
```

## Basic Flow — How the app works

```
        ┌──────────────┐
        │  Admin logs  │  Email: admin@truck.com / admin123
        │     in       │
        └──────┬───────┘
               ▼
   ┌───────────────────────┐
   │ Dashboard (overview)  │── Revenue, profit, fleet, alerts
   └───────┬───────────────┘
           │
   ┌───────▼─────────┐        ┌──────────────────┐
   │ 2. Add a Truck  │───────▶│ Assign a Driver  │
   └───────┬─────────┘        └─────────┬────────┘
           │                            │
   ┌───────▼──────────┐   ┌────────────▼───────────┐
   │ 3. Upload Docs   │   │ 4. Track Maintenance   │
   │ (RC, Insurance,  │   │ (overdue/due service)  │
   │  PUC, Fitness…)  │   └────────────┬───────────┘
   └───────┬──────────┘                │
           │                           │
           ▼                           ▼
   ┌────────────────────────────────────────────────┐
   │ 5. Trip Calculator / Start Trip (calendar)     │
   │   • Pick truck + route (from → to on map)      │
   │   • OSRM: real distance & duration             │
   │   • TollGuru: estimated tolls                  │
   │   • Fuel + driver + other expenses → Profit %  │
   └─────────────────────┬──────────────────────────┘
                         ▼
   ┌──────────────────────────────────────┐
   │ 6. Trip lifecycle                    │
   │  Started → In Transit → Reached →    │
   │         Completed / Cancelled        │
   │  Truck returns to "Available" when   │
   │  the trip is closed.                 │
   └─────────────────────┬────────────────┘
                         │
                         ▼
   ┌──────────────────────────────────────┐
   │ 7. Live notifications (Socket.IO)    │
   │  • Document expiring / expired       │
   │  • FASTag low balance                │
   │  • Maintenance overdue               │
   │  • Trip started / completed/cancelled│
   └──────────────────────────────────────┘
```

## Requirements
- Node.js 18+
- MongoDB (local or Atlas)
- Internet access for OSRM (routes) & TollGuru (tolls); both degrade gracefully
  (auto-estimated tolls / cached routes) when offline or out of quota.

## Setup

### 1. MongoDB
```bash
# Local
mongod

# OR use MongoDB Atlas – put URI in Backend-Server/.env
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/truckpro
```

### 2. Backend
```bash
cd Backend-Server
npm install
copy .env.example .env   # edit: MONGODB_URI, JWT_SECRET, TollGuru key, Cloudinary keys
npm run seed             # creates admin + sample data
npm run dev              # http://localhost:5000
```

### 3. Frontend
```bash
cd Frontend
npm install
npm run dev              # http://localhost:3000
```
The Vite dev server proxies `/api` and `/socket.io` to the backend (`localhost:5000`).
For production static hosting without sockets, set `VITE_SOCKET_ENABLED=1` to force
websocket mode or rely on the built-in polling fallback.

### Login
```
Email:    admin@truck.com
Password: admin123
```

## Project Structure
```
truck-mern/
├── Backend-Server/
│   ├── models/          # User, Truck, Driver, Document, Trip, Toll(+cache), Fuel, Maintenance, Settings, Notification
│   ├── routes/          # auth, dashboard, trucks, drivers, documents, trips, tolls, settings, notifications
│   ├── services/        # osrm, tollguru, tollProvider, notificationService, notificationScanner
│   ├── utils/calc.js    # Calculation engine
│   ├── middleware/auth.js
│   ├── seed.js
│   └── index.js         # Express + Socket.IO entry
├── Frontend/
│   └── src/
│       ├── pages/       # Dashboard, Trucks, Drivers, Documents, Calculator, Trips, Settings, Notifications, Login
│       ├── components/  # Layout, TripDetailsModal, RouteMap, NotificationBell, ui…
│       ├── contexts/    # NotificationsContext (realtime + polling)
│       ├── sockets/     # notificationSocket.io client
│       ├── hooks/       # useAuth, useTheme
│       └── utils/       # api (axios interceptor), calc
└── README.md
```

## API Highlights (all under `/api`, JWT protected)
- `GET/POST /trucks`, `GET/POST /drivers`, `GET/POST /documents`
- `POST /trips/calculate`  → OSRM route + tolls + profit preview
- `GET/POST /trips`, `PUT/DELETE /trips/:id`
- `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- `GET /dashboard`  → summary + alerts + recent trips
- `GET/PUT /settings`
- `POST /auth/login`  → JWT

## Future Phases (as planned)
- Fuel history + dynamic mileage
- Full Toll/FASTag reconciliation
- Reports / exports
- Mobile app