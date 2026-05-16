-- RetroRisk Stage 7 — Remediation Roadmap Schema
-- Run against existing database:
-- docker compose exec postgres psql -U retrorisk_user -d retrorisk -f /tmp/stage7.sql

-- ============================================================
-- ROADMAP ITEMS
-- ============================================================
CREATE TABLE roadmap_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

    -- Core fields
    title VARCHAR(500) NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (
        source IN ('CIS','NIST','Pen Test','Vuln Scan','Phishing','Manual')
    ),
    source_reference TEXT,          -- e.g. "CIS Control 3.1" or "Finding: Unauth RCE"
    source_item_id UUID,            -- FK to originating finding (optional)

    -- Priority and status
    priority VARCHAR(20) NOT NULL CHECK (
        priority IN ('Critical','High','Medium','Low','Informational')
    ),
    status VARCHAR(30) DEFAULT 'Open' CHECK (
        status IN ('Open','In Progress','Completed','Risk Accepted')
    ),

    -- Phase (auto-assigned from due date)
    phase VARCHAR(20) CHECK (
        phase IN ('Quick Win','Short Term','Long Term')
    ),

    -- Effort
    effort VARCHAR(10) CHECK (effort IN ('Low','Medium','High')),

    -- Dates
    due_date DATE,
    date_added DATE DEFAULT CURRENT_DATE,
    date_closed DATE,

    -- Ownership (client can set assigned_owner only)
    assigned_owner VARCHAR(255),

    -- Notes
    notes TEXT,                     -- client-facing notes
    internal_notes TEXT,            -- admin-only notes

    -- Risk acceptance
    risk_acceptance_reason TEXT,
    risk_accepted_by VARCHAR(255),
    risk_review_date DATE,

    -- Client review flag
    flagged_for_review BOOLEAN DEFAULT false,
    flagged_at TIMESTAMPTZ,
    flagged_notes TEXT,             -- client's notes when flagging

    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROADMAP ITEM AUDIT LOG (immutable change trail)
-- ============================================================
CREATE TABLE roadmap_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL,   -- STATUS_CHANGE, OWNER_SET, FLAGGED, etc.
    old_value TEXT,
    new_value TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_roadmap_items_client ON roadmap_items(client_id);
CREATE INDEX idx_roadmap_items_status ON roadmap_items(status);
CREATE INDEX idx_roadmap_items_priority ON roadmap_items(priority);
CREATE INDEX idx_roadmap_items_source ON roadmap_items(source);
CREATE INDEX idx_roadmap_items_due ON roadmap_items(due_date);
CREATE INDEX idx_roadmap_items_flagged ON roadmap_items(flagged_for_review) WHERE flagged_for_review = true;
CREATE INDEX idx_roadmap_audit_item ON roadmap_audit(item_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE TRIGGER trigger_roadmap_items_updated_at
    BEFORE UPDATE ON roadmap_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
