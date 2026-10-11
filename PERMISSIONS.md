QA Lab permission checks

| Action | QA Lead | Tester | Viewer |
| --- | --- | --- | --- |
| Read assigned project data | Yes | Yes | Yes |
| Manage requirements, case definitions, folders, plans and milestones | Yes | No | No |
| Update case execution status and actual result | Yes | Yes | No |
| Save runs, including the selected project plan | Yes | Yes | No |
| Create/update bugs and upload evidence | Yes | Yes | No |
| Delete cases/bugs or manage invitations | Yes | No | No |
| Export/restore workspace backups | Yes | No | No |
| Platform administration and account deletion | Platform admin only | Platform admin only | Platform admin only |

Project-scoped membership adds an independent restriction: only assigned projects can be read or changed. A workspace role does not remove that restriction. Platform admins use platform routes to enter workspaces as QA Leads.

The backend reads membership on each request. Removed membership and deleted accounts invalidate access from existing signed tokens. The frontend refreshes session permissions every 30 seconds and on window focus; server-side restrictions apply immediately.

`node scripts/verifyPermissions.js` runs against a local database only. It creates disposable accounts and a disposable workspace, exercises real HTTP routes, and removes those records afterward. Checks include role restrictions, project isolation, email-bound invite acceptance, expiry/revocation/reuse, live demotion, membership removal, account deletion, and atomic run-to-plan linking. `npm test` includes additional owner/admin safeguards.

Run this check before deploying permission changes. It does not certify every API route or replace production smoke testing.
