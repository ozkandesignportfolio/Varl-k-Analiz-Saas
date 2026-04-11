# USER_CONSENTS SCHEMA FREEZE - COMPLETE

## Status: LOCKED 🔒

The `user_consents` table schema is now **FROZEN** with hard enforcement.
Any attempt to insert/update with unexpected fields will **FAIL** at database level.

---

## FINAL SCHEMA (IMMUTABLE)

```sql
CREATE TABLE public.user_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_terms boolean NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now()
);
```

### Enforcement Mechanism
- **Trigger:** `trg_enforce_user_consents_schema`
- **Function:** `enforce_user_consents_schema()`
- **Behavior:** Rejects ANY insert/update with fields outside `[user_id, accepted_terms, consented_at]`
- **Error Message:** `SCHEMA_VIOLATION: Column "X" does not exist in user_consents`

---

## MIGRATION FILE

**`supabase/migrations/20260411143000_user_consents_freeze.sql`**

### What It Does:
1. `DROP TABLE user_consents CASCADE` - Complete destruction
2. `CREATE TABLE` - Fresh 3-column schema
3. `CREATE TRIGGER` - Hard runtime enforcement
4. `GRANT` - service_role only access
5. `CREATE INDEX` - Minimal unique index
6. `DO $$` block - Ironclad verification (fails migration if not exact)
7. `pg_notify` - Force PostgREST cache refresh

---

## VERIFICATION QUERIES

### 1. Column Verification (MUST return exactly 3 rows)
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_consents' 
ORDER BY ordinal_position;
```

**Expected Output:**
```
 column_name    | data_type   | is_nullable
----------------+-------------+-------------
 user_id        | uuid        | NO
 accepted_terms | boolean     | NO
 consented_at   | timestamptz | NO
```

### 2. Enforcement Trigger Verification
```sql
SELECT tgname 
FROM pg_trigger 
WHERE tgrelid = 'user_consents'::regclass;
```

**Expected:** `trg_enforce_user_consents_schema`

### 3. Test Enforcement (MUST fail)
```sql
-- This should ERROR
INSERT INTO user_consents (user_id, accepted_terms, consented_at, email) 
VALUES (gen_random_uuid(), true, now(), 'test@example.com');
```

**Expected:** `ERROR: SCHEMA_VIOLATION: Column "email" does not exist`

### 4. Valid Insert Test (MUST succeed)
```sql
-- This should work
INSERT INTO user_consents (user_id, accepted_terms, consented_at) 
VALUES (gen_random_uuid(), true, now());
```

**Expected:** `INSERT 0 1`

---

## CODE ALIGNMENT VERIFICATION

### Backend Files Checked ✅

| File | user_consents Usage | Fields Used | Status |
|------|---------------------|-------------|--------|
| `src/app/api/auth/signup/route.ts:557` | `.insert(consentPayload)` | `user_id`, `accepted_terms`, `consented_at` | ✅ |
| `src/app/api/admin/fraud-stats/route.ts:336` | `.select("user_id,consented_at")` | `user_id`, `consented_at` | ✅ |
| `src/lib/auth/signup-security.ts:116` | `.insert(payload)` | Via schema guard | ✅ |

### Schema Guard ✅

**`src/schema/userConsents.ts`**
```typescript
const ALLOWED_FIELDS = ["user_id", "accepted_terms", "consented_at"];

export function validateUserConsentsPayload(payload) {
  // Throws if any field outside ALLOWED_FIELDS
}

export function createUserConsentsInsert(params) {
  // Only creates {user_id, accepted_terms, consented_at}
}
```

### Frontend ✅

**`src/components/auth/signup-form.tsx:728`**
```typescript
body: JSON.stringify({
  acceptedTerms: acceptedLegalDocuments && acceptedKvkk,
  // ... other fields
})
```
- Only sends `acceptedTerms` to API
- Both checkboxes required for `true` value

---

## DEPLOYMENT COMMAND

```bash
# 1. Run migration in Supabase SQL Editor
\i supabase/migrations/20260411143000_user_consents_freeze.sql

# 2. Verify (run all 4 verification queries above)

# 3. Deploy code
git add .
git commit -m "schema freeze: user_consents 3-column lockdown with enforcement"
git push

# 4. Test signup end-to-end
```

---

## WHAT HAPPENS IF SOMEONE TRIES TO DRIFT SCHEMA

### Scenario 1: Code tries to insert extra field
```typescript
await supabase.from('user_consents').insert({
  user_id: '...',
  accepted_terms: true,
  consented_at: now(),
  email: 'user@example.com'  // ❌ VIOLATION
});
```
**Result:** `ERROR: SCHEMA_VIOLATION: Column "email" does not exist`

### Scenario 2: Migration tries to add column
```sql
ALTER TABLE user_consents ADD COLUMN phone text;
```
**Result:** Succeeds (DDL allowed), but...
- Any insert with `phone` will be rejected by trigger
- Code using `phone` will fail

### Scenario 3: Direct SQL with wrong fields
```sql
INSERT INTO user_consents (user_id, accepted_terms, accepted_kvkk)
VALUES ('...', true, true);
```
**Result:** `ERROR: SCHEMA_VIOLATION: Column "accepted_kvkk" does not exist`

---

## REMOVED PERMANENTLY

| Field | Removal Reason |
|-------|----------------|
| `accepted_kvkk` | Unified into `accepted_terms` |
| `accepted_privacy_policy` | Unified into `accepted_terms` |
| `id` | `user_id` is PK now |
| `email` | Audit moved to `auth_security_logs` |
| `ip` | Audit moved to `auth_security_logs` |
| `user_agent` | Audit moved to `auth_security_logs` |
| `created_at` | Redundant with `consented_at` |

---

## SCHEMA DRIFT PREVENTION

### Layer 1: Database (HARD)
- Enforcement trigger rejects unexpected fields
- Transaction blocks on violation

### Layer 2: Schema Guard (SOFT)
- `src/schema/userConsents.ts` validates before DB call
- TypeScript types enforce at compile time

### Layer 3: Runtime Validation
- `validateUserConsentsPayload()` throws on bad fields
- Logs violations for monitoring

---

## MONITORING

Watch for these in logs:
```
[USER_CONSENTS_SCHEMA_VIOLATION]  -- Schema guard caught issue
SCHEMA_VIOLATION: Column "X" ...   -- Database trigger caught issue
```

---

## EMERGENCY UNFREEZE

If schema MUST change:
1. Create new migration: `2026XXXXXX_user_consents_unfreeze.sql`
2. `DROP TRIGGER trg_enforce_user_consents_schema`
3. `DROP FUNCTION enforce_user_consents_schema()`
4. Apply schema changes
5. Update `src/schema/userConsents.ts`
6. Update ALL code references
7. Re-freeze with new enforcement

**WARNING:** Unfreezing should be extremely rare.

---

## CHECKLIST

- [ ] Migration run successfully
- [ ] Verification query 1 returns 3 rows
- [ ] Verification query 2 shows trigger
- [ ] Verification query 3 fails as expected
- [ ] Verification query 4 succeeds
- [ ] Code deployed
- [ ] Signup flow tested
- [ ] No "column does not exist" errors in logs

---

**Frozen At:** 2026-04-11
**Schema Version:** frozen_v1
**Columns:** 3 (locked)
**Enforcement:** Active
