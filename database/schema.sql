-- AstraFlow Database Schema
-- Run this in your Supabase SQL Editor AFTER the backend has started once
-- (SQLAlchemy will create users + fuel_prices + recommendations + push_tokens + surveys tables automatically)

-- Seed fuel prices (petrol & diesel for Mauritius)
INSERT INTO fuel_prices (date, fuel_type, price) VALUES
  ('2026-05-25', 'petrol', 1.64),
  ('2026-05-25', 'diesel', 1.78),
  ('2026-05-26', 'petrol', 1.63),
  ('2026-05-26', 'diesel', 1.79),
  ('2026-05-27', 'petrol', 1.62),
  ('2026-05-27', 'diesel', 1.81),
  ('2026-05-28', 'petrol', 1.61),
  ('2026-05-28', 'diesel', 1.80),
  ('2026-05-29', 'petrol', 1.62),
  ('2026-05-29', 'diesel', 1.79),
  ('2026-05-30', 'petrol', 1.63),
  ('2026-05-30', 'diesel', 1.78),
  ('2026-05-31', 'petrol', 1.64),
  ('2026-05-31', 'diesel', 1.78);

-- Seed recommendations per business type
INSERT INTO recommendations (business_type, content, risk_level, valid_from, valid_to) VALUES
  ('restaurant', 'Fuel-related transport costs may increase next month. Review supplier contracts early and consider local sourcing to reduce delivery expenses.', 'Moderate', '2026-06-01', '2026-06-30'),
  ('taxi', 'Estimated fuel spending next month: Rs 12,000. Expected increase: Rs 1,500. Consider carpooling or shifting to off-peak hours to reduce costs.', 'Moderate', '2026-06-01', '2026-06-30'),
  ('delivery', 'Optimize delivery routes to reduce fuel consumption. Costs expected to rise 5-7%. Batch deliveries and avoid peak traffic hours.', 'High', '2026-06-01', '2026-06-30'),
  ('retail', 'Monitor supply chain fuel surcharges. Consider bulk ordering to lock in current rates before the projected price increase takes effect.', 'Low', '2026-06-01', '2026-06-30'),
  ('logistics', 'Fuel costs projected to increase 8% next quarter. Evaluate fleet efficiency upgrades and renegotiate fuel surcharge agreements with clients.', 'High', '2026-06-01', '2026-06-30');
