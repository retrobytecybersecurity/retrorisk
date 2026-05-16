-- RetroRisk Stage 4 — Phishing Assessment Schema
-- Run against existing database:
-- docker compose exec postgres psql -U retrorisk_user -d retrorisk -f /tmp/stage4.sql

-- ============================================================
-- PHISHING CAMPAIGNS
-- ============================================================
CREATE TABLE phishing_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    campaign_date DATE NOT NULL,
    phishing_type VARCHAR(50) NOT NULL CHECK (
        phishing_type IN ('Credential Harvest','Malware Attachment','Link Click','Vishing','SMS Smishing')
    ),
    pretext TEXT,
    testing_firm VARCHAR(255),
    -- Core metrics
    emails_sent INT NOT NULL DEFAULT 0,
    opened INT DEFAULT 0,
    clicked INT DEFAULT 0,
    submitted INT DEFAULT 0,
    reported INT DEFAULT 0,
    -- Computed rates (stored for fast querying)
    open_rate DECIMAL(5,2) DEFAULT 0,
    click_rate DECIMAL(5,2) DEFAULT 0,
    submission_rate DECIMAL(5,2) DEFAULT 0,
    report_rate DECIMAL(5,2) DEFAULT 0,
    -- Trend indicator vs prior campaign
    trend_direction VARCHAR(10) CHECK (trend_direction IN ('improving','declining','neutral','first')),
    imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PHISHING TARGETS (per-user results — internal only)
-- ============================================================
CREATE TABLE phishing_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES phishing_campaigns(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    -- Encrypted PII
    first_name_enc BYTEA,
    last_name_enc BYTEA,
    email_enc BYTEA,
    position_enc BYTEA,
    -- GoPhish status values
    status VARCHAR(50),   -- Email Sent, Email Opened, Clicked Link, Submitted Data, Email Reported
    reported BOOLEAN DEFAULT false,
    -- Training tracking
    flagged_for_training BOOLEAN DEFAULT false,
    training_completed BOOLEAN DEFAULT false,
    training_completed_at TIMESTAMPTZ,
    -- Repeat offender (clicked in prior campaigns)
    is_repeat_offender BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_phishing_campaigns_client ON phishing_campaigns(client_id);
CREATE INDEX idx_phishing_campaigns_date ON phishing_campaigns(campaign_date DESC);
CREATE INDEX idx_phishing_targets_campaign ON phishing_targets(campaign_id);
CREATE INDEX idx_phishing_targets_client ON phishing_targets(client_id);
CREATE INDEX idx_phishing_targets_training ON phishing_targets(flagged_for_training, training_completed);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE TRIGGER trigger_phishing_campaigns_updated_at
    BEFORE UPDATE ON phishing_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
