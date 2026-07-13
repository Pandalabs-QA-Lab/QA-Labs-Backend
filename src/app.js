const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');
const { attachWorkspace } = require('./middleware/workspaceScope');
const loadActor = require('./middleware/loadActor');
const authRoutes = require('./routes/auth.routes');
const invitesRoutes = require('./routes/invites.routes');
const publicReportsRoutes = require('./routes/publicReports.routes');
const projectsRoutes = require('./routes/projects.routes');
const testCasesRoutes = require('./routes/testCases.routes');
const bugsRoutes = require('./routes/bugs.routes');
const testRunsRoutes = require('./routes/testRuns.routes');
const runDraftRoutes = require('./routes/runDraft.routes');
const requirementsRoutes = require('./routes/requirements.routes');
const testPlansRoutes = require('./routes/testPlans.routes');
const milestonesRoutes = require('./routes/milestones.routes');
const sharedStepsRoutes = require('./routes/sharedSteps.routes');
const teamMembersRoutes = require('./routes/teamMembers.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const activityRoutes = require('./routes/activity.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const presenceRoutes = require('./routes/presence.routes');
const attachmentsRoutes = require('./routes/attachments.routes');
const commentsRoutes = require('./routes/comments.routes');
const backupRoutes = require('./routes/backup.routes');

const app = express();

// `origin: true` reflects the request's actual Origin header back, which is
// the only way to allow every origin while credentials: true stays set - a
// literal '*' is rejected by browsers on credentialed requests.
const allowAllOrigins = env.corsOrigin.includes('*');
app.use(cors({ origin: allowAllOrigins ? true : env.corsOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
// Mounted before the blanket auth gate below: GET is public (lets JoinPage
// show the workspace name pre-login), POST /accept applies its own
// requireAuth+loadActor directly inside invites.routes.js.
app.use('/api/invites', invitesRoutes);
// Fully public, no auth at all: this is the whole point of a shareable
// report link - external stakeholders may never have an account.
app.use('/api/public-reports', publicReportsRoutes);

// Every route mounted below this line is protected: requireAuth verifies
// the JWT, attachWorkspace derives req.workspaceId from it (never from
// the request itself), and loadActor resolves the display name used for
// createdBy/actorName stamps.
app.use('/api', requireAuth, attachWorkspace, loadActor);

app.use('/api/projects', projectsRoutes);
app.use('/api/projects/:projectId/test-cases', testCasesRoutes);
app.use('/api/projects/:projectId/bugs', bugsRoutes);
app.use('/api/projects/:projectId/test-runs', testRunsRoutes);
app.use('/api/projects/:projectId/run-draft', runDraftRoutes);
app.use('/api/projects/:projectId/requirements', requirementsRoutes);
app.use('/api/projects/:projectId/test-plans', testPlansRoutes);
app.use('/api/projects/:projectId/milestones', milestonesRoutes);
app.use('/api/projects/:projectId/shared-steps', sharedStepsRoutes);
app.use('/api/team-members', teamMembersRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/projects/:projectId/presence', presenceRoutes);
app.use('/api/projects/:projectId/comments', commentsRoutes);
app.use('/api/attachments', attachmentsRoutes);
app.use('/api/backup', backupRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
