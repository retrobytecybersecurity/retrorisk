-- RetroRisk Stage 6 — NIST CSF 2.0 Assessment Schema
-- Run against existing database:
-- docker compose exec postgres psql -U retrorisk_user -d retrorisk -f /tmp/stage6.sql

-- ============================================================
-- NIST ASSESSMENTS (versioned per client)
-- ============================================================
CREATE TABLE nist_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
    -- Overall maturity scores (0.0 - 4.0 scale)
    overall_current DECIMAL(4,2) DEFAULT 0,
    overall_target DECIMAL(4,2) DEFAULT 0,
    -- Per-function scores stored as JSONB:
    -- { "GV": { "current": 2.1, "target": 3.5 }, "ID": {...}, ... }
    function_scores JSONB DEFAULT '{}',
    -- Completion tracking
    total_subcategories INT DEFAULT 0,
    assessed_subcategories INT DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NIST ASSESSMENT RESPONSES (per subcategory per assessment)
-- ============================================================
CREATE TABLE nist_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES nist_assessments(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    subcategory_id VARCHAR(20) NOT NULL,   -- e.g. "GV.OC-01"
    function_id VARCHAR(5) NOT NULL,       -- e.g. "GV"
    category_id VARCHAR(10) NOT NULL,      -- e.g. "GV.OC"
    -- Tier ratings (0 = not assessed, 1-4 = tiers)
    current_tier SMALLINT DEFAULT 0 CHECK (current_tier BETWEEN 0 AND 4),
    target_tier  SMALLINT DEFAULT 0 CHECK (target_tier  BETWEEN 0 AND 4),
    -- Assessment fields
    testing_procedures TEXT,
    evidence TEXT,
    testing_steps TEXT,
    gaps_observations TEXT,
    risk_rating VARCHAR(20) CHECK (
        risk_rating IN ('Critical','High','Medium','Low','Informational','None',NULL)
    ),
    -- Roadmap
    promoted_to_roadmap BOOLEAN DEFAULT false,
    roadmap_item_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (assessment_id, subcategory_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_nist_assessments_client ON nist_assessments(client_id);
CREATE INDEX idx_nist_assessments_status ON nist_assessments(status);
CREATE INDEX idx_nist_responses_assessment ON nist_responses(assessment_id);
CREATE INDEX idx_nist_responses_client ON nist_responses(client_id);
CREATE INDEX idx_nist_responses_function ON nist_responses(function_id);
CREATE INDEX idx_nist_responses_subcategory ON nist_responses(subcategory_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER trigger_nist_assessments_updated_at
    BEFORE UPDATE ON nist_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_nist_responses_updated_at
    BEFORE UPDATE ON nist_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
