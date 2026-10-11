QA Lab JSON backups preserve the active project records exported by `/backup/export`: folders, requirements and acceptance criteria, test cases, shared-step blocks, bugs and evidence URLs, saved test runs, test plans, milestones, histories, and record timestamps. Import regenerates IDs and remaps links within each project.

Merge creates additional projects. Replace removes projects in the destination workspace and restores the backup in one database transaction. A failed restore rolls back the removal. Validate the destination and export a safety copy before using Replace.

Uploaded attachment bytes, comments, activity, unfinished run drafts, accounts, passwords, workspace memberships, invitations, and public sharing tokens are outside this JSON format. Member directory entries do not grant account access. Reassign project members after restore. Historical actor names are retained where available; restored records are attributed to the importing administrator. Backups from the earlier importer cannot recover fields that importer already discarded.

Verification:

* `npm test` runs unit checks, including import date and link preservation.
* `node scripts/verifyBackupRoundTrip.js` uses a **local** database only. It creates two disposable workspaces, exports through JSON serialization, restores and re-exports, checks nested folders, shared steps, scope, bug links, evidence URLs, histories and dates, tests Replace rollback, then removes only those workspaces.
