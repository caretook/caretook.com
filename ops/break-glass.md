# Break-glass: looking at care data

When a person at Caretook may look at a care group's data below the app, how they do it, and what they owe the group afterwards: the security review's S-4 (`plans/security-review.md`). In the app, staff never see care data (`docs/domain/admin.md`); this is the only way around that, and every use is recorded.

## Who may

- **Named staff only:** people with a Caretook staff account (`admin` or `support`, granted with `Grant staff`) who are listed below. The scripts refuse an address that isn't staff, or is disabled.
- **Who may run the Action:** repository admins and writers can dispatch `Database access`. Keep that list to the named people.

| Person   | Staff role | May look at production | May approve |
| -------- | ---------- | ---------------------- | ----------- |
| `<name>` | admin      | yes                    | yes         |

- Staging holds only fictional data, so its access needs a reason but none of the notice below.

## When

Only for one of these, written down first:

1. **A user's written request** that needs it: a support case they opened (by email to `SUPPORT_EMAIL`), naming their group and what's wrong. The request is kept with the case.
2. **A security incident**: a suspected breach, abuse, or a bug that may have exposed or damaged data, where looking is needed to find out what happened.

Never for curiosity, testing, product research or anything the app's own `/admin` screens can answer (accounts, groups, counts, the outbox, the audit log). Try those first.

## How

1. **Write the reason** in one line: the case or incident, the group, what you need to see. It goes in the audit log as is, so it names ids, not care details.
2. **Make a key pair** on your own machine (the commands are at the top of `.github/workflows/db-access.yml`):

   ```sh
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out access.key
   openssl pkey -in access.key -pubout -outform DER | base64 | tr -d '\n'
   ```

3. **Run `Database access`** (GitHub → Actions → Database access → Run workflow): the environment, action `grant`, your staff email, hours (**the fewest that will do**, 1 to 24), the reason, and the public key from step 2.
   - It runs `pnpm db:access grant <email> --hours N --reason "…"` as the migrations role. That makes a personal role `staff_<your email as an identifier>`: `LOGIN`, read-only (`default_transaction_read_only`), `SELECT` only, `VALID UNTIL` now plus the hours. A second grant resets its password and expiry (and narrows a role granted before the list below).
   - It can't read the secrets (`PERSONAL_ACCESS_EXCLUDED`, `packages/data/src/db/roles/personalAccess.ts`): Better Auth's `account`, `session`, `verification` and `jwks`, the rate-limit tables, the invites' `token_hash` and `token_ciphertext`, `access_code.code`, and the emails' `html` and `text` (`notification_outbox`, `dev_mail`). On a table with excluded columns, name the columns you need (`SELECT *` is refused).
   - The audit log records **`db.accessGranted`**: the system as actor, you as the target, the reason, the role, the hours and the expiry. GitHub records who dispatched the run.
   - The job summary holds only the connection string **encrypted to your key**. Decrypt it locally:

     ```sh
     echo '<blob>' | base64 -d | openssl pkeyutl -decrypt -inkey access.key -pkeyopt rsa_padding_mode:oaep
     ```

4. **Look, and only at what the reason needs**, with `psql` from your machine. Query the group's rows by id; don't browse other groups. The secrets above are refused (`permission denied`).
5. **Revoke as soon as you're done**, even before the hours run out: `Database access` with action `revoke`, your email and a reason (e.g. "done: <case>"). It revokes exactly what the grant gave, ends the role's open connections (best effort) and drops it, and records **`db.accessRevoked`**. `VALID UNTIL` only stops new logins; a connection left open outlives it, so the revoke is not optional.
6. **Delete `access.key`** and anything you noted that holds care data.

## Never

- Export, dump or copy care data off the database: no `pg_dump`, `\copy`, CSV, or query results saved to files.
- Screenshot or paste care data into chat, tickets, email, notes or an AI tool.
- Use the Neon SQL editor, the PowerSync dashboard or the Resend dashboard to read care data: they aren't recorded by us. Use them for setup and operations only.
- Share the connection string or the role; it's yours alone.
- Write to the database through this. Personal roles are read-only; a fix goes through the app, a migration or a reviewed script.

## Afterwards

Within **3 days** of the revoke:

1. **Write what was looked at and why**: the tables and rows (by id), what was found, and what was done. Keep it with the case or incident.
2. **Tell the group's owners** by email: that a named staff member looked at their group's data, when, why (the request or the incident), what was looked at, and that access has ended. For a user's own request, the requester is told too. If the incident is a breach, the breach procedure (FTC Health Breach Notification Rule) decides the rest of the notice and its timing.
3. **Check the audit log** (`/admin/audit`, filter `db.accessGranted` and `db.accessRevoked`): every grant has a matching revoke. A grant without one is revoked at once and noted.

## Not covered yet

- Neon's own statement logging (pgaudit or the console's records) is **to confirm** (runbook, Neon step 8). Until then the record of what was looked at is the written note, not the database's.
- Console and dashboard access (Neon, PowerSync, Resend, Vercel) is limited to the named people, with two-factor, but nothing in Caretook records it.
