# USER_CONSENTS Hard Reset - Verification Guide

## Summary
Complete schema reset for `user_consents` table to eliminate all drift and mismatches.

---

## FINAL SCHEMA (3 columns only)

```sql
CREATE TABLE public.user_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_terms boolean NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now()
);
```

### Columns
| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | uuid | PRIMARY KEY, FK to auth.users(id) ON DELETE CASCADE |
| `accepted_terms` | boolean | NOT NULL |
| `consented_at` | timestamptz | NOT NULL DEFAULT now() |

### Indexes
- `idx_user_consents_user_id` UNIQUE on user_id

---

## FILES CHANGED

### 1. Database Migration (NEW)
**File:** `supabase/migrations/20260411140000_user_consents_hard_reset.sql`

**Strategy:**
- DROP TABLE CASCADE (removes all indexes, constraints, policies)
- CREATE TABLE with exact 3-column schema
- Add minimal unique index
- Enable RLS with service_role only access
- Runtime schema verification (fails if columns != 3)
- Force schema cache refresh with `pg_notify('pgrst', 'reload schema')`

### 2. Schema Guard (NEW)
**File:** `src/schema/userConsents.ts`

**Exports:**
- `UserConsentsRow` - Database row type
- `UserConsentsInsert` - Insert payload type
- `validateUserConsentsPayload()` - Runtime validation
- `createUserConsentsInsert()` - Factory function
- `isValidUserConsentsRow()` - Type guard

**Allowed Fields:**
```typescript
["user_id", "accepted_terms", "consented_at"]
```

### 3. Backend - signup-security.ts
**File:** `src/lib/auth/signup-security.ts`

**Changes:**
- Removed: `acceptedKvkk`, `acceptedPrivacyPolicy` from params
- Removed: `email`, `ip`, `user_agent` from type definitions
- Changed from `upsert` to `insert`
- Added schema guard validation
- Added payload logging

### 4. Backend - signup/route.ts
**File:** `src/app/api/auth/signup/route.ts`

**Changes:**
- `SignupRequestBody`: Removed `acceptedKvkk`, `acceptedPrivacyPolicy`
- Validation: Only checks `acceptedTerms === true`
- `persistSignupBootstrapRecords`: Only accepts `acceptedTerms`
- Consent insert: Only sends `{user_id, accepted_terms, consented_at}`
- User metadata: Simplified `legal_consents` object
- Removed imports: `KVKK_CONSENT_REQUIRED_ERROR`, `PRIVACY_POLICY_NOT_ACCEPTED_ERROR`

### 5. Frontend - signup-form.tsx
**File:** `src/components/auth/signup-form.tsx`

**Changes:**
- API payload: Only sends `acceptedTerms: acceptedLegalDocuments && acceptedKvkk`
- Removed from imports: `KVKK_CONSENT_REQUIRED_ERROR`, `PRIVACY_POLICY_NOT_ACCEPTED_ERROR`
- Combined error message: "Kullanım Şartları, Gizlilik Politikası ve KVKK Aydınlatma Metni'ni kabul etmelisiniz."
- UI: Still shows 2 separate checkboxes for legal compliance

### 6. Constants - signup.ts
**File:** `src/lib/supabase/signup.ts`

**Changes:**
- Removed: `KVKK_CONSENT_REQUIRED_ERROR` constant
- Removed: `PRIVACY_POLICY_NOT_ACCEPTED_ERROR` constant
- Updated: `SignupApiErrorCode` type

### 7. Previous Migration - Annotated
**File:** `supabase/migrations/20260403123000_signup_security_logging.sql`

**Changes:**
- Added comment referencing new unified schema migration

### 8. Previous Migration - Soft Migration (kept for reference)
**File:** `supabase/migrations/20260411133000_user_consents_schema_unification.sql`

**Note:** This was the soft migration approach (alter table). The hard reset migration should be used instead.

---

## DEPLOYMENT STEPS

### Step 1: Run Database Migration
```sql
-- In Supabase SQL Editor, run:
\i supabase/migrations/20260411140000_user_consents_hard_reset.sql
```

### Step 2: Verify Schema
```sql
-- Verify exactly 3 columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_consents' 
ORDER BY ordinal_position;

-- Expected output:
-- user_id        | uuid        | NO
-- accepted_terms | boolean     | NO
-- consented_at   | timestamptz | NO
```

### Step 3: Deploy Code
```bash
git add .
git commit -m "fix: unify user_consents schema - 3 columns only"
git push
```

### Step 4: Test Signup Flow
1. Navigate to signup page
2. Fill form with both consent checkboxes checked
3. Submit
4. Verify success response
5. Check database:
   ```sql
   SELECT * FROM user_consents WHERE user_id = '<new_user_id>';
   -- Should show exactly 3 columns
   ```

---

## VERIFICATION CHECKLIST

### Database
- [ ] Table has exactly 3 columns
- [ ] `user_id` is PRIMARY KEY
- [ ] `accepted_terms` is NOT NULL
- [ ] `consented_at` has DEFAULT now()
- [ ] Foreign key exists to auth.users
- [ ] RLS enabled
- [ ] Only service_role has access
- [ ] No other columns exist

### Backend
- [ ] signup-security.ts only uses 3 fields
- [ ] signup/route.ts only validates acceptedTerms
- [ ] No references to accepted_kvkk
- [ ] No references to accepted_privacy_policy
- [ ] No references to email/ip/user_agent in user_consents
- [ ] Uses insert() not upsert() for consents

### Frontend
- [ ] signup-form.tsx only sends acceptedTerms
- [ ] Both checkboxes required for acceptedTerms=true
- [ ] No references to removed error constants

### Schema Guard
- [ ] userConsents.ts enforces 3-field limit
- [ ] Runtime validation throws on extra fields
- [ ] Factory function creates valid payloads

---

## REMOVED FIELDS

| Field | Table | Reason |
|-------|-------|--------|
| `accepted_kvkk` | user_consents | Unified into accepted_terms |
| `accepted_privacy_policy` | user_consents | Unified into accepted_terms |
| `id` | user_consents | user_id is PK |
| `email` | user_consents | Audit in auth_security_logs |
| `ip` | user_consents | Audit in auth_security_logs |
| `user_agent` | user_consents | Audit in auth_security_logs |
| `created_at` | user_consents | Redundant with consented_at |

---

## ERROR CODES REMOVED

- `KVKK_CONSENT_REQUIRED_ERROR` → Use `TERMS_NOT_ACCEPTED_ERROR`
- `PRIVACY_POLICY_NOT_ACCEPTED_ERROR` → Use `TERMS_NOT_ACCEPTED_ERROR`

---

## ROLLBACK PLAN

If issues occur:

1. **Database:** Restore from backup if exists
   ```sql
   -- If you created a backup before migration
   DROP TABLE user_consents;
   CREATE TABLE user_consents AS SELECT * FROM user_consents_backup;
   ```

2. **Code:** Revert git commit
   ```bash
   git revert HEAD
   git push
   ```

3. **Hard reset:** If no backup, table will be empty (acceptable for pre-launch)

---

## PREVENTION

Future schema changes MUST:
1. Update `src/schema/userConsents.ts` first
2. Run database migration
3. Update all code references
4. Verify with `validateUserConsentsPayload()`

Never add columns without updating the schema guard.

---

## CONTACT

For issues with this migration, check:
1. Supabase logs for SQL errors
2. Application logs for `[USER_CONSENTS_SCHEMA_VIOLATION]`
3. Database: `\d user_consents`
