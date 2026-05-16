-- RetroRisk Stage 3 — Penetration Testing Schema
-- Run against existing database:
-- docker compose exec postgres psql -U retrorisk_user -d retrorisk -f /tmp/stage3.sql

-- ============================================================
-- PENTEST ENGAGEMENTS (containers for findings)
-- ============================================================
CREATE TABLE pentest_engagements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    engagement_type VARCHAR(50) NOT NULL CHECK (
        engagement_type IN ('External Network','Internal Network','Web Application','Wireless','Social Engineering')
    ),
    scope TEXT,
    testing_firm VARCHAR(255),
    start_date DATE,
    end_date DATE,
    retest_date DATE,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    -- Summary counts (maintained by trigger/app)
    critical_open INT DEFAULT 0,
    high_open INT DEFAULT 0,
    medium_open INT DEFAULT 0,
    low_open INT DEFAULT 0,
    info_open INT DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PENTEST FINDINGS
-- ============================================================
CREATE TABLE pentest_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID NOT NULL REFERENCES pentest_engagements(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Critical','High','Medium','Low','Informational')),
    description TEXT,
    evidence_summary TEXT,
    remediation TEXT,
    affected_systems TEXT[],
    -- Status workflow
    status VARCHAR(30) DEFAULT 'Open' CHECK (
        status IN ('Open','In Progress','Pending Retest','Remediated - Verified','Remediation Incomplete','Risk Accepted')
    ),
    risk_acceptance_reason TEXT,
    risk_accepted_by VARCHAR(255),
    risk_review_date DATE,
    -- Retest tracking
    retest_completed_at TIMESTAMPTZ,
    retest_notes TEXT,
    -- Carry-forward (appeared in prior engagement)
    is_recurring BOOLEAN DEFAULT false,
    prior_engagement_id UUID REFERENCES pentest_engagements(id) ON DELETE SET NULL,
    -- Roadmap
    promoted_to_roadmap BOOLEAN DEFAULT false,
    roadmap_item_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_pentest_engagements_client ON pentest_engagements(client_id);
CREATE INDEX idx_pentest_engagements_status ON pentest_engagements(status);
CREATE INDEX idx_pentest_findings_engagement ON pentest_findings(engagement_id);
CREATE INDEX idx_pentest_findings_client ON pentest_findings(client_id);
CREATE INDEX idx_pentest_findings_severity ON pentest_findings(severity);
CREATE INDEX idx_pentest_findings_status ON pentest_findings(status);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER trigger_pentest_engagements_updated_at
    BEFORE UPDATE ON pentest_engagements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_pentest_findings_updated_at
    BEFORE UPDATE ON pentest_findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
