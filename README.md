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

To grant platform admin rights, first create the intended account through signup, then run from a trusted shell with the correct database configured:

```powershell
npm run admin:grant -- admin@example.com
```

Do not put an admin password or `JWT_SECRET` in the repository. Back up a production database before applying migrations.

## Checks and generated files

`npm test` runs the backend test suite. Prisma migrations in `prisma/migrations/` are source files and must be kept. `node_modules/`, `.env`, and uploaded files are ignored; `uploads/.gitkeep` keeps the upload directory present in a fresh clone.
