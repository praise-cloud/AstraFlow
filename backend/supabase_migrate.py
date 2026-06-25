"""Migrate schema and seed data to Supabase via Management API."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import requests

TOKEN = os.getenv("SUPABASE_ACCESS_TOKEN", "")
PROJECT_REF = "yzorvgjdvlpovpaljtkb"
API = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def query(sql: str, description: str = ""):
    print(f"\n--- {description or sql[:80]}...")
    r = requests.post(API, headers=HEADERS, json={"query": sql}, timeout=30)
    if r.status_code == 201:
        data = r.json()
        print(f"  OK ({len(data)} rows)" if data else "  OK")
        return data
    else:
        print(f"  ERROR {r.status_code}: {r.text[:300]}")
        return None


def run_migration():
    # 1. Create ENUM type
    query("""
        DO $$ BEGIN
            CREATE TYPE business_type AS ENUM (
                'restaurant', 'taxi', 'delivery', 'retail', 'logistics'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """, "Create ENUM")

    # 2. Create users table
    query("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            full_name VARCHAR(255) NOT NULL,
            business_type business_type NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """, "Create users")

    # 3. Create fuel_prices table
    query("""
        CREATE TABLE IF NOT EXISTS fuel_prices (
            id SERIAL PRIMARY KEY,
            date DATE NOT NULL,
            fuel_type VARCHAR(20) NOT NULL,
            price NUMERIC(10, 2) NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_fuel_prices_date ON fuel_prices(date);
    """, "Create fuel_prices")

    # 4. Create recommendations table
    query("""
        CREATE TABLE IF NOT EXISTS recommendations (
            id SERIAL PRIMARY KEY,
            business_type business_type NOT NULL,
            content VARCHAR(500) NOT NULL,
            risk_level VARCHAR(20) NOT NULL,
            valid_from DATE NOT NULL,
            valid_to DATE DEFAULT NULL
        );
    """, "Create recommendations")

    # 5. Create oil_news table
    query("""
        CREATE TABLE IF NOT EXISTS oil_news (
            id SERIAL PRIMARY KEY,
            title VARCHAR(300) NOT NULL,
            summary VARCHAR(500) NOT NULL,
            content TEXT NOT NULL,
            source VARCHAR(100) NOT NULL,
            image_url VARCHAR(500) DEFAULT NULL,
            published_at DATE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """, "Create oil_news")

    # 6. Create surveys table
    query("""
        CREATE TABLE IF NOT EXISTS surveys (
            id SERIAL PRIMARY KEY,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            business_type business_type NOT NULL,
            monthly_fuel_spend NUMERIC(10, 2) DEFAULT NULL,
            impact_level VARCHAR(20) DEFAULT NULL,
            concern_areas JSONB DEFAULT NULL,
            comments VARCHAR(500) DEFAULT NULL,
            submitted_at TIMESTAMPTZ DEFAULT NOW()
        );
    """, "Create surveys")

    # 7. Check if prices already seeded
    existing = query("SELECT COUNT(*) as cnt FROM fuel_prices;", "Check fuel_prices count")
    if existing and existing[0]["cnt"] == 0:
        from backend.services.scraper import fetch_retail_prices
        print("\nFetching retail prices from STC...")
        prices = fetch_retail_prices()
        if prices:
            values_clauses = []
            for p in prices:
                d = p["date"].strftime("%Y-%m-%d") if hasattr(p["date"], "strftime") else p["date"]
                pet = float(p["petrol"])
                die = float(p["diesel"])
                values_clauses.append(f"('{d}', 'petrol', {pet})")
                values_clauses.append(f"('{d}', 'diesel', {die})")
            batch_size = 50
            for i in range(0, len(values_clauses), batch_size):
                batch = values_clauses[i:i + batch_size]
                sql = "INSERT INTO fuel_prices (date, fuel_type, price) VALUES " + ",\n".join(batch) + ";"
                query(sql, f"Seed prices batch {i // batch_size + 1}")
            print(f"  Seeded {len(prices)} price dates from STC.")
        else:
            print("  WARNING: Could not fetch prices from STC. Database empty.")
    else:
        print(f"  Fuel prices already exist ({existing[0]['cnt']} records), skipping seed.")

    # 8. Seed recommendations
    existing_recs = query("SELECT COUNT(*) as cnt FROM recommendations;", "Check recommendations count")
    if existing_recs and existing_recs[0]["cnt"] == 0:
        from datetime import date
        recs = [
            ("restaurant", "Fuel-related transport costs may increase next month. Review supplier contracts early and consider local sourcing to reduce delivery expenses.", "Moderate", date.today().isoformat()),
            ("taxi", "Estimated fuel spending next month: Rs 12,000. Expected increase: Rs 1,500. Consider carpooling or shifting to off-peak hours to reduce costs.", "Moderate", date.today().isoformat()),
            ("delivery", "Optimize delivery routes to reduce fuel consumption. Costs expected to rise 5-7%. Batch deliveries and avoid peak traffic hours.", "High", date.today().isoformat()),
            ("retail", "Monitor supply chain fuel surcharges. Consider bulk ordering to lock in current rates before the projected price increase takes effect.", "Low", date.today().isoformat()),
            ("logistics", "Fuel costs projected to increase 8% next quarter. Evaluate fleet efficiency upgrades and renegotiate fuel surcharge agreements with clients.", "High", date.today().isoformat()),
        ]
        for bt, content, risk, vf in recs:
            query(f"""INSERT INTO recommendations (business_type, content, risk_level, valid_from)
                      VALUES ('{bt}', '{content.replace("'", "''")}', '{risk}', '{vf}');""", f"Seed rec {bt}")
        print("  Seeded 5 recommendations.")
    else:
        print("  Recommendations already exist, skipping seed.")

    print("\n=== Migration complete! ===")


if __name__ == "__main__":
    run_migration()
