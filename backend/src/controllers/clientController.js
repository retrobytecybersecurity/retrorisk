const pool = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');
const { auditLog } = require('../utils/audit');

function decryptClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationName: row.organization_name,
    industry: row.industry,
    organizationSize: row.organization_size,
    engagementType: row.engagement_type,
    cisIgLevel: row.cis_ig_level,
    status: row.status,
    healthStatus: row.health_status,
    primaryContactName: decrypt(row.primary_contact_name_enc),
    primaryContactEmail: decrypt(row.primary_contact_email_enc),
    primaryContactPhone: decrypt(row.primary_contact_phone_enc),
    address: decrypt(row.address_enc),
    notes: decrypt(row.notes_enc),
    contractStartDate: row.contract_start_date,
    contractRenewalDate: row.contract_renewal_date,
    checkinCadence: row.checkin_cadence,
    assessmentCadences: row.assessment_cadences,
    lastVulnScan: row.last_vuln_scan,
    lastCisAssessment: row.last_cis_assessment,
    lastNistAssessment: row.last_nist_assessment,
    lastPentest: row.last_pentest,
    lastPhishing: row.last_phishing,
    offboardedAt: row.offboarded_at,
    dataDeletionDueAt: row.data_deletion_due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getAllClients(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, organization_name, industry, organization_size, engagement_type,
              cis_ig_level, status, health_status, contract_renewal_date, checkin_cadence,
              last_vuln_scan, last_cis_assessment, last_nist_assessment, last_pentest, last_phishing,
              primary_contact_name_enc, primary_contact_email_enc
       FROM clients
       WHERE status != 'offboarded'
       ORDER BY organization_name ASC`
    );

    const clients = result.rows.map(row => ({
      id: row.id,
      organizationName: row.organization_name,
      industry: row.industry,
      organizationSize: row.organization_size,
      engagementType: row.engagement_type,
      cisIgLevel: row.cis_ig_level,
      status: row.status,
      healthStatus: row.health_status,
      contractRenewalDate: row.contract_renewal_date,
      checkinCadence: row.checkin_cadence,
      lastVulnScan: row.last_vuln_scan,
      lastCisAssessment: row.last_cis_assessment,
      lastNistAssessment: row.last_nist_assessment,
      lastPentest: row.last_pentest,
      lastPhishing: row.last_phishing,
      primaryContactName: decrypt(row.primary_contact_name_enc),
      primaryContactEmail: decrypt(row.primary_contact_email_enc),
    }));

    return res.json(clients);
  } catch (err) {
    console.error('Get clients error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getClient(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
    return res.json(decryptClient(result.rows[0]));
  } catch (err) {
    console.error('Get client error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createClient(req, res) {
  const {
    organizationName, industry, organizationSize, engagementType,
    cisIgLevel, primaryContactName, primaryContactEmail, primaryContactPhone,
    address, notes, contractStartDate, contractRenewalDate,
    checkinCadence, assessmentCadences
  } = req.body;

  if (!organizationName || !industry || !organizationSize || !engagementType) {
    return res.status(400).json({ error: 'Organization name, industry, size, and engagement type are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO clients (
        organization_name, industry, organization_size, engagement_type, cis_ig_level,
        primary_contact_name_enc, primary_contact_email_enc, primary_contact_phone_enc,
        address_enc, notes_enc, contract_start_date, contract_renewal_date,
        checkin_cadence, assessment_cadences
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING id`,
      [
        organizationName.trim(),
        industry,
        organizationSize,
        engagementType,
        cisIgLevel || null,
        encrypt(primaryContactName),
        encrypt(primaryContactEmail),
        encrypt(primaryContactPhone),
        encrypt(address),
        encrypt(notes),
        contractStartDate || null,
        contractRenewalDate || null,
        checkinCadence || 'monthly',
        JSON.stringify(assessmentCadences || {})
      ]
    );

    const newClient = result.rows[0];

    await auditLog({
      userId: req.user.userId,
      action: 'CLIENT_CREATED',
      entityType: 'client',
      entityId: newClient.id,
      newValue: { organizationName, industry, engagementType },
      ipAddress: req.ip
    });

    // Create check-in reminders based on cadence
    await createCheckinReminders(newClient.id, checkinCadence || 'monthly');

    return res.status(201).json({ id: newClient.id, message: 'Client created successfully' });
  } catch (err) {
    console.error('Create client error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateClient(req, res) {
  const { id } = req.params;
  const {
    organizationName, industry, organizationSize, engagementType,
    cisIgLevel, primaryContactName, primaryContactEmail, primaryContactPhone,
    address, notes, contractStartDate, contractRenewalDate,
    checkinCadence, assessmentCadences, status
  } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Client not found' });

    await pool.query(
      `UPDATE clients SET
        organization_name = COALESCE($1, organization_name),
        industry = COALESCE($2, industry),
        organization_size = COALESCE($3, organization_size),
        engagement_type = COALESCE($4, engagement_type),
        cis_ig_level = COALESCE($5, cis_ig_level),
        primary_contact_name_enc = COALESCE($6, primary_contact_name_enc),
        primary_contact_email_enc = COALESCE($7, primary_contact_email_enc),
        primary_contact_phone_enc = COALESCE($8, primary_contact_phone_enc),
        address_enc = COALESCE($9, address_enc),
        notes_enc = COALESCE($10, notes_enc),
        contract_start_date = COALESCE($11, contract_start_date),
        contract_renewal_date = COALESCE($12, contract_renewal_date),
        checkin_cadence = COALESCE($13, checkin_cadence),
        assessment_cadences = COALESCE($14, assessment_cadences),
        status = COALESCE($15, status)
      WHERE id = $16`,
      [
        organizationName?.trim(),
        industry,
        organizationSize,
        engagementType,
        cisIgLevel,
        primaryContactName !== undefined ? encrypt(primaryContactName) : null,
        primaryContactEmail !== undefined ? encrypt(primaryContactEmail) : null,
        primaryContactPhone !== undefined ? encrypt(primaryContactPhone) : null,
        address !== undefined ? encrypt(address) : null,
        notes !== undefined ? encrypt(notes) : null,
        contractStartDate,
        contractRenewalDate,
        checkinCadence,
        assessmentCadences ? JSON.stringify(assessmentCadences) : null,
        status,
        id
      ]
    );

    await auditLog({
      userId: req.user.userId,
      action: 'CLIENT_UPDATED',
      entityType: 'client',
      entityId: id,
      newValue: { organizationName, industry, status },
      ipAddress: req.ip
    });

    return res.json({ message: 'Client updated successfully' });
  } catch (err) {
    console.error('Update client error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function offboardClient(req, res) {
  const { id } = req.params;

  try {
    const existing = await pool.query('SELECT id, organization_name FROM clients WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Client not found' });

    const deletionDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await pool.query(
      `UPDATE clients SET
        status = 'offboarded',
        offboarded_at = NOW(),
        data_deletion_due_at = $1
       WHERE id = $2`,
      [deletionDue, id]
    );

    // Deactivate client user accounts immediately
    await pool.query(
      'UPDATE users SET is_active = false WHERE client_id = $1',
      [id]
    );

    // Create data deletion reminder
    await pool.query(
      `INSERT INTO reminders (client_id, type, title, due_date)
       VALUES ($1, 'data_deletion', $2, $3)`,
      [id, `Delete data for ${existing.rows[0].organization_name}`, deletionDue.toISOString().split('T')[0]]
    );

    await auditLog({
      userId: req.user.userId,
      action: 'CLIENT_OFFBOARDED',
      entityType: 'client',
      entityId: id,
      newValue: { dataDeletionDue: deletionDue },
      ipAddress: req.ip
    });

    return res.json({ message: 'Client offboarded. Data will be retained for 30 days.', dataDeletionDue: deletionDue });
  } catch (err) {
    console.error('Offboard client error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteClientData(req, res) {
  const { id } = req.params;

  try {
    const existing = await pool.query(
      'SELECT id, status, organization_name FROM clients WHERE id = $1',
      [id]
    );

    if (!existing.rows[0]) return res.status(404).json({ error: 'Client not found' });
    if (existing.rows[0].status !== 'offboarded') {
      return res.status(400).json({ error: 'Client must be offboarded before data deletion' });
    }

    // Delete all associated data - cascades handle most of it
    await pool.query('DELETE FROM clients WHERE id = $1', [id]);

    await auditLog({
      userId: req.user.userId,
      action: 'CLIENT_DATA_DELETED',
      entityType: 'client',
      entityId: id,
      newValue: { organizationName: existing.rows[0].organization_name },
      ipAddress: req.ip
    });

    return res.json({ message: 'Client data permanently deleted' });
  } catch (err) {
    console.error('Delete client data error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function createCheckinReminders(clientId, cadence) {
  const cadenceMap = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 };
  const days = cadenceMap[cadence] || 30;
  const nextDue = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO reminders (client_id, type, title, due_date)
     VALUES ($1, 'checkin', 'Scheduled Check-in', $2)`,
    [clientId, nextDue.toISOString().split('T')[0]]
  );
}

module.exports = { getAllClients, getClient, createClient, updateClient, offboardClient, deleteClientData };
