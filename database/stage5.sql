-- RetroRisk Stage 5 — CIS v8 Assessment Schema
-- Run against existing database:
-- docker compose exec postgres psql -U retrorisk_user -d retrorisk -f /tmp/stage5.sql

-- ============================================================
-- CIS ASSESSMENTS (versioned per client)
-- ============================================================
CREATE TABLE cis_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,           -- auto: "CIS v8 Assessment — June 2025"
    ig_level VARCHAR(5) NOT NULL CHECK (ig_level IN ('IG1','IG2','IG3')),
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
    -- Scoring (computed and cached)
    overall_score DECIMAL(5,2) DEFAULT 0,     -- 0-100%
    -- Per-control scores stored as JSONB: { "1": 85.5, "2": 60.0, ... }
    control_scores JSONB DEFAULT '{}',
    -- Completion tracking
    total_safeguards INT DEFAULT 0,
    assessed_safeguards INT DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CIS ASSESSMENT RESPONSES (per safeguard per assessment)
-- ============================================================
CREATE TABLE cis_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID NOT NULL REFERENCES cis_assessments(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    safeguard_id VARCHAR(10) NOT NULL,    -- e.g. "1.1", "5.3"
    control_id INT NOT NULL,              -- e.g. 1, 5
    -- Assessment fields
    status VARCHAR(30) DEFAULT 'Not Assessed' CHECK (
        status IN ('Compliant','Partially Compliant','Non-Compliant','Not Applicable','Not Assessed')
    ),
    testing_procedures TEXT,             -- your methodology (from JSON but editable per response)
    evidence TEXT,                       -- Suralink reference
    testing_steps TEXT,                  -- what you did/saw this assessment
    gaps_observations TEXT,              -- gaps found
    risk_rating VARCHAR(20) CHECK (
        risk_rating IN ('Critical','High','Medium','Low','Informational','None',NULL)
    ),
    -- Roadmap
    promoted_to_roadmap BOOLEAN DEFAULT false,
    roadmap_item_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (assessment_id, safeguard_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_cis_assessments_client ON cis_assessments(client_id);
CREATE INDEX idx_cis_assessments_status ON cis_assessments(status);
CREATE INDEX idx_cis_responses_assessment ON cis_responses(assessment_id);
CREATE INDEX idx_cis_responses_client ON cis_responses(client_id);
CREATE INDEX idx_cis_responses_safeguard ON cis_responses(safeguard_id);
CREATE INDEX idx_cis_responses_status ON cis_responses(status);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER trigger_cis_assessments_updated_at
    BEFORE UPDATE ON cis_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_cis_responses_updated_at
    BEFORE UPDATE ON cis_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
