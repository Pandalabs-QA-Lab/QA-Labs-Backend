# Access and workspace setup

Accounts start without a workspace. A user can join a team by accepting its invite link; the initial role is Viewer. A user requesting a personal or team workspace supplies a workspace name and first project name. A platform admin approves the request, which creates both records and makes the requester the workspace owner and QA Lead.

The roles are enforced by API middleware. QA Leads manage projects, test cases, requirements, plans, workspace members and backups. Testers can manage bugs and test runs and add comments and attachments. Viewers can read workspace data and update their own notification state. QA Leads or the platform admin can change a member's workspace role. Membership is checked on every workspace API call, so removing someone revokes access even if they still have an unexpired token.

## Email invitations

QA Leads can create an invitation addressed to one email from project settings or workspace settings. Each invitation has a unique link, expires after seven days, and can be revoked. The recipient must sign in with that exact email and explicitly accept. Existing users also see pending invitations in the app. A project invitation creates a project-scoped Viewer membership; project lists and nested API routes are restricted to assigned projects. A workspace invitation creates workspace-wide Viewer access. The same account can belong to several workspaces and switch between them; their projects are not merged.

Previous unrestricted workspace links are no longer accepted. Send a new email-addressed invitation to each recipient.

The app currently prepares an email draft or copies the link for the inviter. It does not send mail automatically because no mail delivery provider is configured. Invitation recipients register or sign in with their own account.

A platform admin lands in administration after sign-in and can enter any workspace from the workspace chooser. Entering adds or restores their membership as QA Lead; the workspace app's account menu links back to platform administration. A platform admin can remove an ordinary member's access to a specific workspace without deleting the user's account. Workspace owners and platform admins cannot be removed this way.

Platform admins can also create an account with a temporary password and optionally grant Viewer access to one workspace. The account owner must change that password before using any workspace API. Share temporary credentials privately; the API does not send them by email. Account deletion removes the user, their workspace memberships, team directory entries, presence, and project assignments. If they own workspaces, ownership and QA Lead access transfer to the deleting platform admin first; historical project content and activity remain. Platform admins can delete other admins but cannot delete their own signed-in account.

Platform admins can permanently delete a workspace after typing its name to confirm. Database cascades remove its projects, test cases, runs, bugs, memberships, invitations, notifications, and activity; linked workspace requests remain as history without the deleted workspace ID. The service then removes that workspace's uploaded files. User accounts remain. Back up the workspace before deletion because there is no in-app restore flow.

## Deploying the change

1. Back up the PostgreSQL database and install dependencies with `npm ci`.
2. Apply the new migration with `npx prisma migrate deploy`, then generate the Prisma client with `npx prisma generate`.
3. Deploy the backend and frontend together. The new invitation endpoints require the `Invitation` table and membership scope column.
4. Create the intended admin account through signup. From a trusted server shell with production `DATABASE_URL` set, run `npm run admin:grant -- the-admin@example.com`. This command requires direct database access. A matching email in a public signup request never grants admin rights.

Previously created workspaces and their memberships remain intact. Existing accounts are not automatically promoted to platform admin. Do not treat a contact email or an email in old Firebase settings as proof of admin identity.

The admin overview's active-user count means distinct people whose project-presence heartbeat was seen in the past five minutes. It is not a count of everyone currently signed in. The overview previews recent users and activity; the user and workspace directories are searchable and paginated.
