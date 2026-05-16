-- RetroRisk GRC Platform - Database Schema
-- All sensitive fields encrypted at application level with AES-256

-- Enable pgcrypto for additional db-level utilities
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USERS TABLE (platform users - org admin + client logins)
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'client')),
    client_id UUID, -- null for admin users
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENTS TABLE (encrypted sensitive fields)
-- ============================================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Non-sensitive, used for search/display
    organization_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100) NOT NULL,
    organization_size VARCHAR(50) NOT NULL,
    engagement_type VARCHAR(50) NOT NULL CHECK (engagement_type IN ('vciso_only', 'vciso_assessments', 'assessments_only')),
    cis_ig_level VARCHAR(5) CHECK (cis_ig_level IN ('IG1', 'IG2', 'IG3')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'offboarded')),
    health_status VARCHAR(10) DEFAULT 'green' CHECK (health_status IN ('red', 'amber', 'green')),
    -- Encrypted sensitive fields (stored as bytea)
    primary_contact_name_enc BYTEA,
    primary_contact_email_enc BYTEA,
    primary_contact_phone_enc BYTEA,
    address_enc BYTEA,
    notes_enc BYTEA,
    -- Dates
    contract_start_date DATE,
    contract_renewal_date DATE,
    offboarded_at TIMESTAMPTZ,
    data_deletion_due_at TIMESTAMPTZ, -- 30 days after offboarding
    -- Cadence
    checkin_cadence VARCHAR(20) CHECK (checkin_cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly')),
    -- Assessment cadences (stored as JSON for flexibility per framework)
    assessment_cadences JSONB DEFAULT '{}',
    -- Last assessment dates per framework
    last_vuln_scan DATE,
    last_cis_assessment DATE,
    last_nist_assessment DATE,
    last_pentest DATE,
    last_phishing DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key after both tables exist
ALTER TABLE users ADD CONSTRAINT fk_users_client
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- ============================================================
-- ONE-TIME LINKS TABLE (for credential delivery)
-- ============================================================
CREATE TABLE one_time_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) UNIQUE NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG TABLE (immutable - no updates or deletes)
-- ============================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DASHBOARD REMINDERS TABLE
-- ============================================================
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('checkin', 'assessment', 'renewal', 'data_deletion', 'review_request')),
    title VARCHAR(255) NOT NULL,
    due_date DATE NOT NULL,
    is_dismissed BOOLEAN DEFAULT false,
    framework VARCHAR(50), -- for assessment reminders
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_health ON clients(health_status);
CREATE INDEX idx_users_client_id ON users(client_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_reminders_due ON reminders(due_date, is_dismissed);
CREATE INDEX idx_one_time_links_token ON one_time_links(token);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DEFAULT ADMIN USER (password: ChangeMe123! - CHANGE IMMEDIATELY)
-- ============================================================
INSERT INTO users (username, password_hash, role)
VALUES (
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewHmNVxE5BhM4oqy',
    'admin'
);
