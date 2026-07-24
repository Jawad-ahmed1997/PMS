# PMS Cloud

## Authentication

The application uses Auth.js/NextAuth v5 with a Credentials provider, Prisma’s MongoDB adapter, and encrypted JWT cookies. Auth.js owns the HTTP-only session cookie; the application never stores tokens in browser storage. The JWT callback re-reads the current user and status from MongoDB, so disabled users lose access at the next authoritative server check. Password changes increment `sessionVersion` and invalidate prior sessions.

There is no public signup or registration endpoint. Create the first user from the server only:

```bash
npx auth secret
CREATE_USER_PASSWORD='use-a-secret-manager-or-stdin' npm run create-user -- --name 'First User' --email first@example.com --role CEO
```

The command refuses duplicates, normalizes email, hashes passwords with bcrypt cost 12, and never prints credentials. Roles are the existing application roles: `CEO`, `PM`, `CTO`, `SENIOR_DEVELOPER`, and `DEVELOPER`.

## Configuration and deployment

Copy `.env.example` to `.env`. Required production values are `AUTH_SECRET`, `AUTH_URL`, and `DATABASE_URL`. Password recovery also requires `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASSWORD`, and `EMAIL_FROM`. Set `TRUSTED_PROXY_IP_HEADER` only when the deployment proxy strips and securely sets that header. Never use `NEXT_PUBLIC_` for secrets.

Apply schema changes with a reviewed deployment migration appropriate for MongoDB:

```bash
npx prisma validate
npx prisma generate
```

MongoDB deployments must apply the generated schema changes through the team’s migration/review process; this project does not use `prisma db push` as an unattended production deployment step.

Login is `/login`; `/` sends unauthenticated users there and authenticated users to `/dashboard`. The protected application shell and sidebar are rendered only after server-side authentication. Every existing API uses the shared server authorization helper and returns JSON 401/403 responses. Admin/management permissions are checked from the current database user, never from browser-submitted roles.

Login and password recovery are rate-limited with durable MongoDB buckets using independent normalized-email and client-IP buckets. Reset tokens are 32 random bytes, stored only as SHA-256 digests, expire after 45 minutes, and are atomically single-use. Recovery always returns a non-enumerating message. Reset email delivery is server-only SMTP and reset URLs use `AUTH_URL`, never an untrusted Host header.

Logout calls the server-side Auth.js `signOut` action and redirects to `/login`. Auth events are recorded without passwords, hashes, tokens, cookies, authorization headers, or reset URLs.

## Checks

```bash
npm run lint
npx prisma validate
npx prisma generate
npm run build
```

Production checklist: use HTTPS, keep one stable `AUTH_SECRET` across instances, apply the schema, configure SMTP, use shared MongoDB state, verify the production callback route, confirm secure cookies, and test refresh, disabled-user revocation, reset, and logout flows.
