# Access and workspace setup

Accounts start without a workspace. A user can join a team by accepting its invite link; the initial role is Viewer. A user requesting a personal or team workspace supplies a workspace name and first project name. A platform admin approves the request, which creates both records and makes the requester the workspace owner and QA Lead.

The roles are enforced by API middleware. QA Leads manage projects, test cases, requirements, plans, workspace members and backups. Testers can manage bugs and test runs and add comments and attachments. Viewers can read workspace data and update their own notification state. QA Leads or the platform admin can change a member's workspace role. Membership is checked on every workspace API call, so removing someone revokes access even if they still have an unexpired token.

A platform admin lands in administration after sign-in and can enter any workspace from the workspace chooser. Entering adds or restores their membership as QA Lead; the workspace app's account menu links back to platform administration. A platform admin can remove an ordinary member's access to a specific workspace without deleting the user's account. Workspace owners and platform admins cannot be removed this way.

## Deploying the change

1. Back up the PostgreSQL database and install dependencies with `npm ci`.
2. Apply the new migration with `npx prisma migrate deploy`, then generate the Prisma client with `npx prisma generate`.
3. Deploy the backend and frontend together because signup now returns an account without a workspace.
4. Create the intended admin account through signup. From a trusted server shell with production `DATABASE_URL` set, run `npm run admin:grant -- the-admin@example.com`. This command requires direct database access. A matching email in a public signup request never grants admin rights.

Previously created workspaces and their memberships remain intact. Existing accounts are not automatically promoted to platform admin. Do not treat a contact email or an email in old Firebase settings as proof of admin identity.

The admin overview's active-user count means distinct people whose project-presence heartbeat was seen in the past five minutes. It is not a count of everyone currently signed in. The overview lists the 100 newest workspaces, users, and activity records; the count cards cover the full database.
