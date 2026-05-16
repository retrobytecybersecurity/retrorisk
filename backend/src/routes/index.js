const express = require('express');
const router = express.Router();

const { login, generateOneTimeLink, activateAccount } = require('../controllers/authController');
const { getAllClients, getClient, createClient, updateClient, offboardClient, deleteClientData } = require('../controllers/clientController');
const { createClientUser, getClientUsers, deactivateUser, deleteUser } = require('../controllers/userController');
const { getDashboard, dismissReminder } = require('../controllers/dashboardController');
const { importScan, listScans, getScanFindings, getLatestScan, getTrendData: vulnTrend, compareScans, deleteScan } = require('../controllers/vulnController');
const { listEngagements, getEngagement, createEngagement, updateEngagement, deleteEngagement, listFindings, createFinding, updateFinding, deleteFinding, getTrendData: pentestTrend, getGlobalOpenCounts, getClientPortalSummary: pentestPortal } = require('../controllers/pentestController');
const { importCampaign, listCampaigns, getCampaignTargets, updateTraining, deleteCampaign, getTrendData: phishingTrend, getRepeatOffenders, getClientPortalSummary: phishingPortal } = require('../controllers/phishingController');
const { getSafeguards, listAssessments: cisListAssessments, createAssessment: cisCreate, getAssessment: cisGet, saveResponse: cisSave, completeAssessment: cisComplete, deleteAssessment: cisDelete, getTrendData: cisTrend, getClientPortalSummary: cisPortal } = require('../controllers/cisController');
const { getNistFramework, listAssessments: nistListAssessments, createAssessment: nistCreate, getAssessment: nistGet, saveResponse: nistSave, completeAssessment: nistComplete, deleteAssessment: nistDelete, getTrendData: nistTrend, getClientPortalSummary: nistPortal } = require('../controllers/nistController');
const { listItems, getSummary, createItem, promoteToRoadmap, updateItem, setAssignedOwner, flagForReview, clearReviewFlag, deleteItem, getAuditTrail, getReviewQueue, getClientPortalRoadmap } = require('../controllers/roadmapController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { vulnReport, pentestReport, cisReport, nistReport, phishingReport, roadmapReport } = require('../controllers/reportController');

// Auth
router.post('/auth/login', login);
router.post('/auth/activate', activateAccount);
router.post('/auth/generate-link', authenticateToken, requireAdmin, generateOneTimeLink);

// Dashboard
router.get('/dashboard', authenticateToken, requireAdmin, getDashboard);
router.get('/dashboard/pentest-counts', authenticateToken, requireAdmin, getGlobalOpenCounts);
router.get('/dashboard/review-queue', authenticateToken, requireAdmin, getReviewQueue);
router.patch('/dashboard/reminders/:id/dismiss', authenticateToken, requireAdmin, dismissReminder);

// Clients
router.get('/clients', authenticateToken, requireAdmin, getAllClients);
router.get('/clients/:id', authenticateToken, requireAdmin, getClient);
router.post('/clients', authenticateToken, requireAdmin, createClient);
router.put('/clients/:id', authenticateToken, requireAdmin, updateClient);
router.post('/clients/:id/offboard', authenticateToken, requireAdmin, offboardClient);
router.delete('/clients/:id/data', authenticateToken, requireAdmin, deleteClientData);

// Users
router.get('/clients/:clientId/users', authenticateToken, requireAdmin, getClientUsers);
router.post('/users/client', authenticateToken, requireAdmin, createClientUser);
router.patch('/users/:userId/deactivate', authenticateToken, requireAdmin, deactivateUser);
router.delete('/users/:userId', authenticateToken, requireAdmin, deleteUser);

// Vulnerability - admin
router.post('/clients/:clientId/vuln/import', authenticateToken, requireAdmin, importScan);
router.get('/clients/:clientId/vuln/scans', authenticateToken, requireAdmin, listScans);
router.get('/clients/:clientId/vuln/scans/trend', authenticateToken, requireAdmin, vulnTrend);
router.get('/clients/:clientId/vuln/scans/compare', authenticateToken, requireAdmin, compareScans);
router.get('/clients/:clientId/vuln/scans/latest', authenticateToken, requireAdmin, getLatestScan);
router.get('/vuln/scans/:scanId/findings', authenticateToken, requireAdmin, getScanFindings);
router.delete('/vuln/scans/:scanId', authenticateToken, requireAdmin, deleteScan);
router.get('/portal/vuln/latest', authenticateToken, (req,res,next)=>{req.params.clientId=req.user.clientId;next();}, getLatestScan);
router.get('/portal/vuln/trend', authenticateToken, (req,res,next)=>{req.params.clientId=req.user.clientId;next();}, vulnTrend);

// Pentest - admin
router.get('/clients/:clientId/pentest/engagements', authenticateToken, requireAdmin, listEngagements);
router.post('/clients/:clientId/pentest/engagements', authenticateToken, requireAdmin, createEngagement);
router.get('/clients/:clientId/pentest/trend', authenticateToken, requireAdmin, pentestTrend);
router.get('/pentest/engagements/:engagementId', authenticateToken, requireAdmin, getEngagement);
router.put('/pentest/engagements/:engagementId', authenticateToken, requireAdmin, updateEngagement);
router.delete('/pentest/engagements/:engagementId', authenticateToken, requireAdmin, deleteEngagement);
router.get('/pentest/engagements/:engagementId/findings', authenticateToken, requireAdmin, listFindings);
router.post('/pentest/engagements/:engagementId/findings', authenticateToken, requireAdmin, createFinding);
router.put('/pentest/findings/:findingId', authenticateToken, requireAdmin, updateFinding);
router.delete('/pentest/findings/:findingId', authenticateToken, requireAdmin, deleteFinding);
router.get('/portal/pentest/summary', authenticateToken, pentestPortal);

// Phishing - admin
router.post('/clients/:clientId/phishing/import', authenticateToken, requireAdmin, importCampaign);
router.get('/clients/:clientId/phishing/campaigns', authenticateToken, requireAdmin, listCampaigns);
router.get('/clients/:clientId/phishing/trend', authenticateToken, requireAdmin, phishingTrend);
router.get('/clients/:clientId/phishing/repeat-offenders', authenticateToken, requireAdmin, getRepeatOffenders);
router.get('/phishing/campaigns/:campaignId/targets', authenticateToken, requireAdmin, getCampaignTargets);
router.patch('/phishing/targets/:targetId/training', authenticateToken, requireAdmin, updateTraining);
router.delete('/phishing/campaigns/:campaignId', authenticateToken, requireAdmin, deleteCampaign);
router.get('/portal/phishing/summary', authenticateToken, phishingPortal);

// CIS v8 - admin
router.get('/cis/safeguards', authenticateToken, requireAdmin, getSafeguards);
router.get('/clients/:clientId/cis/assessments', authenticateToken, requireAdmin, cisListAssessments);
router.post('/clients/:clientId/cis/assessments', authenticateToken, requireAdmin, cisCreate);
router.get('/clients/:clientId/cis/trend', authenticateToken, requireAdmin, cisTrend);
router.get('/cis/assessments/:assessmentId', authenticateToken, requireAdmin, cisGet);
router.patch('/cis/assessments/:assessmentId/complete', authenticateToken, requireAdmin, cisComplete);
router.delete('/cis/assessments/:assessmentId', authenticateToken, requireAdmin, cisDelete);
router.put('/cis/assessments/:assessmentId/responses/:safeguardId', authenticateToken, requireAdmin, cisSave);
router.get('/portal/cis/summary', authenticateToken, cisPortal);

// NIST CSF 2.0 - admin
router.get('/nist/framework', authenticateToken, requireAdmin, getNistFramework);
router.get('/clients/:clientId/nist/assessments', authenticateToken, requireAdmin, nistListAssessments);
router.post('/clients/:clientId/nist/assessments', authenticateToken, requireAdmin, nistCreate);
router.get('/clients/:clientId/nist/trend', authenticateToken, requireAdmin, nistTrend);
router.get('/nist/assessments/:assessmentId', authenticateToken, requireAdmin, nistGet);
router.patch('/nist/assessments/:assessmentId/complete', authenticateToken, requireAdmin, nistComplete);
router.delete('/nist/assessments/:assessmentId', authenticateToken, requireAdmin, nistDelete);
router.put('/nist/assessments/:assessmentId/responses/:subcategoryId', authenticateToken, requireAdmin, nistSave);
router.get('/portal/nist/summary', authenticateToken, nistPortal);

// Roadmap - admin
router.get('/clients/:clientId/roadmap', authenticateToken, requireAdmin, listItems);
router.get('/clients/:clientId/roadmap/summary', authenticateToken, requireAdmin, getSummary);
router.post('/clients/:clientId/roadmap', authenticateToken, requireAdmin, createItem);
router.post('/clients/:clientId/roadmap/promote', authenticateToken, requireAdmin, promoteToRoadmap);
router.put('/roadmap/:itemId', authenticateToken, requireAdmin, updateItem);
router.delete('/roadmap/:itemId', authenticateToken, requireAdmin, deleteItem);
router.patch('/roadmap/:itemId/clear-review', authenticateToken, requireAdmin, clearReviewFlag);
router.get('/roadmap/:itemId/audit', authenticateToken, requireAdmin, getAuditTrail);

// Roadmap - client portal
router.get('/portal/roadmap', authenticateToken, getClientPortalRoadmap);
router.patch('/portal/roadmap/:itemId/owner', authenticateToken, setAssignedOwner);
router.patch('/portal/roadmap/:itemId/flag', authenticateToken, flagForReview);


// Reports
router.get('/clients/:clientId/reports/vuln/:scanId', authenticateToken, requireAdmin, vulnReport);
router.get('/clients/:clientId/reports/pentest/:engagementId', authenticateToken, requireAdmin, pentestReport);
router.get('/clients/:clientId/reports/cis/:assessmentId', authenticateToken, requireAdmin, cisReport);
router.get('/clients/:clientId/reports/nist/:assessmentId', authenticateToken, requireAdmin, nistReport);
router.get('/clients/:clientId/reports/phishing/:campaignId', authenticateToken, requireAdmin, phishingReport);
router.get('/clients/:clientId/reports/roadmap', authenticateToken, requireAdmin, roadmapReport);

// Portal identity
router.get('/portal/me', authenticateToken, (req, res) => res.json({ user: req.user }));

module.exports = router;
