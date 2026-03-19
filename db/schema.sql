-- ==========================================================================
-- VaccineGuard — Supabase Database Schema
-- ==========================================================================
-- This schema mirrors the TypeScript interfaces in src/types/vaccine.ts.
-- Run this in the Supabase SQL Editor to create the tables.
-- ==========================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------------------------
-- 1. children — child profiles owned by an authenticated parent
-- --------------------------------------------------------------------------
CREATE TABLE children (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender      TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  parent_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by parent
CREATE INDEX idx_children_parent_id ON children(parent_id);

-- --------------------------------------------------------------------------
-- 2. vaccine_records — individual vaccination records for a child
-- --------------------------------------------------------------------------
CREATE TABLE vaccine_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id          UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  vaccine_name      TEXT NOT NULL,
  date_administered DATE NOT NULL,
  administered_by   TEXT,               -- doctor name (optional)
  batch_number      TEXT,               -- optional
  scan_source       TEXT NOT NULL CHECK (scan_source IN ('camera', 'upload', 'manual')),
  raw_ocr_text      TEXT NOT NULL DEFAULT '',
  verified          BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by child
CREATE INDEX idx_vaccine_records_child_id ON vaccine_records(child_id);

-- --------------------------------------------------------------------------
-- 3. who_vaccines — WHO recommended vaccination schedule (reference data)
-- --------------------------------------------------------------------------
CREATE TABLE who_vaccines (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vaccine_name          TEXT NOT NULL,
  common_aliases        TEXT[] NOT NULL DEFAULT '{}',  -- e.g. {"OPV", "Polio drops"}
  recommended_age_weeks INT NOT NULL,
  recommended_age_label TEXT NOT NULL,                 -- e.g. "6 weeks", "9 months"
  doses                 INT NOT NULL,
  dose_number           INT NOT NULL,
  disease               TEXT NOT NULL,                 -- e.g. "Poliomyelitis"
  is_mandatory          BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT NOT NULL DEFAULT ''
);

-- Unique constraint: one entry per vaccine + dose number
CREATE UNIQUE INDEX idx_who_vaccines_name_dose ON who_vaccines(vaccine_name, dose_number);


-- ==========================================================================
-- Row Level Security (RLS)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- children — parents can only CRUD their own children
-- --------------------------------------------------------------------------
ALTER TABLE children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own children"
  ON children FOR SELECT
  USING (auth.uid() = parent_id);

CREATE POLICY "Users can insert their own children"
  ON children FOR INSERT
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Users can update their own children"
  ON children FOR UPDATE
  USING (auth.uid() = parent_id)
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Users can delete their own children"
  ON children FOR DELETE
  USING (auth.uid() = parent_id);

-- --------------------------------------------------------------------------
-- vaccine_records — parents can only CRUD records for their own children
-- --------------------------------------------------------------------------
ALTER TABLE vaccine_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their children's vaccine records"
  ON vaccine_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = vaccine_records.child_id
        AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert vaccine records for their children"
  ON vaccine_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = vaccine_records.child_id
        AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their children's vaccine records"
  ON vaccine_records FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = vaccine_records.child_id
        AND children.parent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = vaccine_records.child_id
        AND children.parent_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their children's vaccine records"
  ON vaccine_records FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM children
      WHERE children.id = vaccine_records.child_id
        AND children.parent_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- who_vaccines — read-only reference data, accessible to all authenticated
-- --------------------------------------------------------------------------
ALTER TABLE who_vaccines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read WHO vaccine schedule"
  ON who_vaccines FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service_role can insert/update/delete WHO data (via Supabase dashboard
-- or server-side admin scripts). No user-facing write policy needed.


-- ==========================================================================
-- Trigger: auto-update updated_at on row changes
-- ==========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_children
  BEFORE UPDATE ON children
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_vaccine_records
  BEFORE UPDATE ON vaccine_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
