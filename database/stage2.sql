-- RetroRisk Stage 2 — Vulnerability Scanning Schema
-- Run this against your existing database:
-- docker compose exec postgres psql -U retrorisk_user -d retrorisk -f /docker-entrypoint-initdb.d/stage2.sql
-- (copy this file to database/ before running)

-- ============================================================
-- VULNERABILITY SCANS (scan sessions per client)
-- ============================================================
CREATE TABLE vuln_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,           -- auto: "Nessus Scan — June 14 2025"
    scope VARCHAR(100) NOT NULL,          -- Internal / External / DMZ / Cloud / Custom
    scope_custom VARCHAR(100),            -- if scope = Custom
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    imported_by UUID REFERENCES users(id) ON DELETE SET NULL,
    finding_count INT DEFAULT 0,
    critical_count INT DEFAULT 0,
    high_count INT DEFAULT 0,
    medium_count INT DEFAULT 0,
    low_count INT DEFAULT 0,
    info_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VULNERABILITY FINDINGS (deduplicated per scan)
-- ============================================================
CREATE TABLE vuln_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES vuln_scans(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    -- Core fields from Nessus
    plugin_id VARCHAR(50),               -- Nessus plugin ID for dedup tracking
    title VARCHAR(500) NOT NULL,
    cve VARCHAR(100),                    -- N/A if none
    cvss_score DECIMAL(3,1),            -- v3 preferred, v2 fallback, null if neither
    cvss_version SMALLINT,              -- 3 or 2
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Critical','High','Medium','Low','Informational')),
    description TEXT,
    remediation TEXT,
    -- Hosts (stored as array of strings)
    hosts TEXT[] NOT NULL DEFAULT '{}',
    host_count INT NOT NULL DEFAULT 0,
    -- Roadmap
    promoted_to_roadmap BOOLEAN DEFAULT false,
    roadmap_item_id UUID,               -- populated when promoted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_vuln_scans_client ON vuln_scans(client_id);
CREATE INDEX idx_vuln_scans_imported ON vuln_scans(imported_at DESC);
CREATE INDEX idx_vuln_findings_scan ON vuln_findings(scan_id);
CREATE INDEX idx_vuln_findings_client ON vuln_findings(client_id);
CREATE INDEX idx_vuln_findings_severity ON vuln_findings(severity);
CREATE INDEX idx_vuln_findings_plugin ON vuln_findings(plugin_id);
