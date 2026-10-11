# QA Lab backend

Express 5 API for QA Lab, backed by PostgreSQL through Prisma. It handles authentication, workspaces and role checks, projects, test cases, bugs, runs, activity, and file uploads. The [frontend](https://github.com/Pandalabs-QA-Lab/QA-Labs-Frontend) runs separately.

## Run locally

Install Node.js 22 or later and PostgreSQL. Create an empty PostgreSQL database, then in this folder run:

```powershell
npm ci
Copy-Item .env.example .env
```

Set `DATABASE_URL` to your database connection string and replace the example `JWT_SECRET` with a long random value. Keep `.env` out of Git. The default server port is 4000 and the default allowed frontend origin is `http://localhost:5173`.

Apply migrations, generate the Prisma client, and start the API:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run dev
```

Check `http://localhost:4000/api/health` for `{"status":"ok"}`. Start the frontend from its own folder. `npm start` runs the server without the development file watcher.

## Access model

Signup creates a user without a workspace. An invite grants initial Viewer access, or a platform admin approves a workspace request. Workspace roles are QA Lead, Tester, and Viewer. The API checks membership on every protected workspace request. See [access and deployment notes](ACCESS.md) for the detailed permissions and migration sequence.

Project folders are shared by requirements and test cases within each project. `GET /api/projects/:projectId/folders` lists the tree; QA Leads can create, rename, move, or remove folders using `POST /folders`, `PATCH /folders/:id`, and `DELETE /folders/:id` under that project route. A folder can have a `parentId` for nesting. Requirements and test cases store a nullable `folderId`; deleting a folder moves its direct items and child folders to its parent. Deploy the folder migration before deploying the API code that uses these fields.

Requirements have an `acceptanceCriteria` string array and can link test cases in the same project through `testCaseIds`. Stable requirement keys are unique within a project, ignoring case. The bulk endpoint `POST /api/projects/:projectId/requirements/bulk` accepts `{ "rows": [...] }`; validation and insertion run in one database transaction. Apply the acceptance-criteria migration before deploying API code that reads or writes this field.

To grant platform admin rights, first create the intended account through signup, then run from a trusted shell with the correct database configured:

```powershell
npm run admin:grant -- admin@example.com
```

Do not put an admin password or `JWT_SECRET` in the repository. Back up a production database before applying migrations.

## Invitation emails

Workspace and project invitations grant Viewer access initially and remain bound to the recipient email. Set `APP_PUBLIC_URL` to the frontend's full public URL, including `/QA-Labs-Frontend/` when running locally or on GitHub Pages. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in the backend environment. SMTP credentials must never be placed in the frontend or committed to Git.

For Zoho, use the outgoing server shown in your mailbox's **Settings → Mail accounts → Server configuration**; the hostname depends on the account region and plan. Use a Zoho application password when MFA is enabled. Port 465 uses `SMTP_SECURE=true`; port 587 uses STARTTLS with `SMTP_SECURE=false`. The sender must match your mailbox or an authorized alias. See [Zoho SMTP settings](https://www.zoho.com/mail/help/zoho-smtp.html).

The API records whether the provider accepted each invitation email. A failed delivery preserves the invitation so an admin can resend it or copy its link. Resending is limited to once per minute per invitation. Missing configuration leaves link sharing available. Invites expire after seven days; revoked or accepted invites cannot be resent. Apply the invitation email migration before deploying the API and restart after changing environment values.

## Checks and generated files

### Attachment storage in production

Uploads currently use the backend filesystem. Set `UPLOAD_DIR` to an absolute path on a persistent host volume outside the deployed checkout; ephemeral containers or deployment directories can lose files during redeploys. All API instances must share this same volume. Keep it private: downloads go through the authenticated API and workspace/project checks.

Run `npm run storage:check` under the backend service account to verify that its configured directory can write, read, and remove a temporary probe. This does not prove persistence: the hosting team must confirm the volume survives restarts and redeploys. Back up this directory together with PostgreSQL; JSON project backups do not contain attachment bytes. When changing paths, existing attachment records still refer to their original paths, so preserve the old mount or migrate both files and record paths together.

New files use random storage names; original names remain available for downloads. Failed database saves remove their unsaved file, and missing evidence returns a clear 404. Object storage such as S3/R2 is not configured yet.

`npm test` runs the backend test suite. Prisma migrations in `prisma/migrations/` are source files and must be kept. `node_modules/`, `.env`, and uploaded files are ignored; `uploads/.gitkeep` keeps the upload directory present in a fresh clone.

With the frontend cloned alongside this repository, `node scripts/verifyCustomerWorkflow.js` checks the customer workflow against a localhost database: nested folders, requirement acceptance criteria, linked cases, plan execution by a Tester, bug reporting, retest, and coverage/report agreement after fresh HTTP reads. It creates disposable accounts and a workspace and removes them afterward. It refuses non-local database hosts.
