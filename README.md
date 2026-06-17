# AstraFlow — Intelligent Fuel Insights

AstraFlow is an **AI-based Fuel Price Forecasting and Evaluation System** for **Mauritius**. It helps fuel-dependent businesses — restaurants, taxis, delivery services, retail shops, and logistics companies — track real-time fuel prices, predict future trends, and receive personalized recommendations to manage operating costs.

Built with **Expo (React Native)** and **FastAPI (Python)**, AstraFlow delivers a cross-platform experience on mobile and web.

---

## Features

- **Real-Time Dashboard** — Current petrol (Mogas 95) and diesel (Gas Oil) prices with trend indicators, sparkline charts, risk level, business impact score, and personalized recommendations.
- **30-Day Price Forecasts** — ML-driven predictions with confidence intervals, trend analysis (up/down/stable), and actionable advice ("buy now", "wait", "monitor").
- **Cost Projection Calculator** — Enter liters consumed to see projected cost, carbon footprint, future increase percentage, and cost difference.
- **Price History Charts** — Interactive 30-day SVG line charts with avg/min/max stats and petrol vs. diesel comparison.
- **Personalized Recommendations** — Tailored insights for 5 business types based on fuel price trends.
- **Fuel Impact Survey** — Multi-step survey to capture monthly spend, impact level, and concerns for better personalization.
- **Push Notifications** — Expo push notifications for price alerts and changes.
- **User Authentication** — JWT-based registration and login with bcrypt password hashing.
- **Business-type Onboarding** — Select your business type during registration for customized recommendations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React Native via [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/), Expo Router (file-based routing) |
| **UI** | Gluestack UI (`@gluestack-ui/themed`) with custom **Azure Clarity** design system |
| **Charts** | Custom SVG components via `react-native-svg` |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) 0.115 (Python 3.12) |
| **Database** | PostgreSQL (Supabase) with SQLite fallback for local development |
| **ORM** | SQLAlchemy 2.0 + Alembic for migrations |
| **Auth** | JWT (`python-jose`) + bcrypt (`passlib`) |
| **ML** | `scikit-learn` LinearRegression, `numpy` OLS fallback, optional XGBoost ensemble |
| **Notifications** | Expo Push Notifications API |
| **Deployment** | Render (backend), Vercel (frontend web), Docker |

---

## Project Structure

```
AstraFlow/
├── backend/                    # FastAPI Python backend
│   ├── main.py                 # App entry point, CORS, router registration
│   ├── seed.py                 # Database seeder (fuel prices + recommendations)
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Container for backend deployment
│   ├── .env.example            # Environment variable template
│   ├── db/
│   │   └── database.py         # SQLAlchemy engine/session (Supabase + SQLite fallback)
│   ├── models/                 # SQLAlchemy models (user, fuel_price, recommendation, survey, push_token)
│   ├── routes/                 # API route handlers (auth, dashboard, predict, prices, surveys, notifications)
│   ├── services/               # Business logic (JWT, password hashing)
│   ├── ml/                     # ML pipeline (data generation, model training, forecasting)
│   └── alembic/                # Database migration scripts
│
├── src/                        # Expo React Native frontend
│   ├── app/                    # Expo Router pages
│   │   ├── _layout.tsx         # Root layout (auth guard, stack navigator)
│   │   ├── login.tsx           # Login screen
│   │   ├── register.tsx        # Registration with business type selector
│   │   ├── survey.tsx          # Fuel impact survey (modal)
│   │   └── (tabs)/             # Bottom tab navigator
│   │       ├── index.tsx       # Home / Dashboard
│   │       ├── prices.tsx      # Price history
│   │       ├── predict.tsx     # Forecast + cost calculator
│   │       └── profile.tsx     # Account settings + notifications
│   ├── components/             # Reusable UI (LineChart, Sparkline, themed wrappers)
│   ├── services/               # API client, auth persistence, notification registration
│   ├── hooks/                  # Custom hooks (theme, color scheme)
│   ├── constants/              # Theme colors, fonts, spacing
│   └── theme/                  # Azure Clarity Gluestack theme config
│
├── database/                   # Raw SQL migrations and seed schema
├── assets/                     # Images, icons, and fonts
├── ui_sample/                  # Design mockups and Azure Clarity design system docs
├── scripts/                    # Utility scripts
│
├── app.json                    # Expo configuration
├── tsconfig.json               # TypeScript config with @/ path alias
├── package.json                # NPM dependencies and scripts
├── render.yaml                 # Render deployment config
├── vercel.json                 # Vercel deployment config
└── LICENSE                     # MIT License
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.12+
- **npm** or **yarn**

### 1. Clone and install frontend dependencies

```bash
git clone <repo-url>
cd AstraFlow
npm install
```

### 2. Set up the backend

```bash
cd backend
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and configure your database:

```bash
cp .env.example .env
```

For local development, no changes are needed — SQLite will be used automatically (`astraflow.db`).

### 3. Seed the database

```bash
cd backend
python -m backend.seed
```

This populates sample fuel prices and business recommendations.

### 4. Start the backend

```bash
cd backend
uvicorn backend.main:app --reload --port 8001
```

The API will be available at `http://localhost:8001`.

### 5. Start the frontend

```bash
# From the project root
npx expo start

# Or for web-specific development:
npm run web
```

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` | Start and open on Android emulator |
| `npm run ios` | Start and open on iOS simulator |
| `npm run web` | Start and open in web browser |
| `npm run lint` | Run Expo ESLint |
| `python -m backend.seed` | Seed database with sample data |

---

## API Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/dashboard` | Yes | Personalized dashboard data |
| GET | `/api/predict?liters=N` | Yes | Cost projection + forecast data |
| GET | `/api/forecast?days=30&fuel_type=petrol\|diesel` | Yes | ML price forecast with confidence intervals |
| GET | `/api/prices/history?days=30` | Yes | Historical fuel prices |
| POST | `/api/surveys` | Yes | Submit fuel impact survey |
| GET | `/api/surveys/insights` | Yes | Aggregate survey insights |
| POST | `/api/notifications/register` | Yes | Register push token |
| DELETE | `/api/notifications/register` | Yes | Unregister push token |
| GET | `/api/health` | No | Health check |

---

## ML Forecasting

The forecasting engine uses an **ensemble approach** combining:

1. **Linear Regression** (scikit-learn or pure numpy OLS) for trend detection
2. **XGBoost** (optional) for capturing non-linear patterns
3. **Feature engineering** with weekly and yearly seasonality (sin/cos encoding)

The model generates 30-day price predictions with **95% confidence intervals** and produces actionable natural-language recommendations based on the predicted trend direction.

---

## Deployment

### Backend (Render)

`render.yaml` is pre-configured for a Python web service on Render's free tier. Set `DATABASE_URL` and `SECRET_KEY` in your Render dashboard.

### Backend (Docker)

```bash
cd backend
docker build -t astraflow-api .
docker run -p 8000:8000 astraflow-api
```

### Frontend Web (Vercel)

`vercel.json` is pre-configured. Connect your repository to Vercel; the build command (`npx expo export --platform web`) outputs to the `dist/` directory.

---

## Design System

AstraFlow uses the **Azure Clarity** design system — a high-clarity, minimalist aesthetic optimized for mobile. Key principles:

- **Deep Blue (#003087)** as the primary brand color
- **Work Sans** for headlines, **Inter** for body text
- **4px baseline grid** with generous whitespace
- **Tonal layering** instead of heavy shadows
- **8px/16px soft corners** for approachable professionalism

Full design documentation is available in `ui_sample/azure_clarity/DESIGN.md`.

---

## License

MIT
