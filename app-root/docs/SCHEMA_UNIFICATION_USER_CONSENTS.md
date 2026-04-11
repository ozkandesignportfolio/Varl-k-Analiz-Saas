# USER_CONSENTS Schema Unification

## Problem
Repeated Supabase errors:
- "Could not find column accepted_kvkk"
- "schema cache mismatch"
- "user_consents insert failing"

Root cause: Code and database schema were NOT synchronized. Multiple conflicting consent field names existed.

## Solution
Unified schema with **ONLY 3 columns**:

| Column | Type | Constraints |
|--------|------|-------------|
| `user_id` | uuid | PRIMARY KEY, references auth.users(id) ON DELETE CASCADE |
| `accepted_terms` | boolean | NOT NULL |
| `consented_at` | timestamptz | NOT NULL DEFAULT now() |

## Deleted Fields

| Field | Reason |
|-------|--------|
| `accepted_kvkk` | Covered under unified `accepted_terms` |
| `accepted_privacy_policy` | Covered under unified `accepted_terms` |
| `id` | Replaced by `user_id` as PRIMARY KEY |
| `email` | Audit trail moved to `auth_security_logs` table |
| `ip` | Audit trail moved to `auth_security_logs` table |
| `user_agent` | Audit trail moved to `auth_security_logs` table |
| `created_at` | Redundant with `consented_at` |

## Files Changed

### 1. Database Migration
**File:** `supabase/migrations/20260411133000_user_consents_schema_unification.sql`

- Drops conflicting columns
- Enforces 3-column schema
- Adds runtime validation
- Includes schema guard check (errors if unexpected columns exist)

### 2. Schema Guard (NEW)
**File:** `src/schema/userConsents.ts`

Single source of truth for all user_consents operations:
```typescript
export interface UserConsentsRow {
  user_id: string;
  accepted_terms: boolean;
  consented_at: string;
}

export function validateUserConsentsPayload(payload, operation)
export function createUserConsentsInsert(params)
export function isValidUserConsentsRow(obj)
```

### 3. Backend Code - signup-security.ts
**File:** `src/lib/auth/signup-security.ts`

- Removed: `acceptedKvkk`, `acceptedPrivacyPolicy` from `UserConsentInsertParams`
- Removed: `email`, `ip`, `user_agent`, `id`, `created_at` from type definitions
- Changed from `upsert` to strict `insert`
- Added runtime validation before DB insert
- Added logging of final payload

### 4. Backend Code - signup/route.ts
**File:** `src/app/api/auth/signup/route.ts`

- Removed: `acceptedKvkk`, `acceptedPrivacyPolicy` from `persistSignupBootstrapRecords` input
- Removed: `email` from consent insert payload
- Changed from `upsert` to `insert` for user_consents
- Updated `executeAtomicSignup` to only pass `acceptedTerms`
- Updated `legal_consents` metadata to unified schema
- Removed unused imports: `KVKK_CONSENT_REQUIRED_ERROR`, `PRIVACY_POLICY_NOT_ACCEPTED_ERROR`

**Note:** Frontend still validates all 3 consents (KVKK, privacy policy, terms) for legal compliance, but only `accepted_terms` is stored in the database.

## Validation Layer

### Runtime Validation (Hard Guards)
```typescript
// Schema guard enforces only allowed fields
validateUserConsentsPayload(payload, "insert");

// Throws error if unexpected fields exist
// Logs payload before DB insert
```

### Schema Contract
All writes MUST use `createUserConsentsInsert()` factory:
```typescript
const payload = createUserConsentsInsert({
  userId: params.userId,
  acceptedTerms: params.acceptedTerms,  // ONLY this field
  consentedAt: new Date(),
});
```

## Migration Deployment Steps

1. **Backup data** (if any production data exists):
   ```sql
   CREATE TABLE user_consents_backup AS SELECT * FROM user_consents;
   ```

2. **Run unification migration** in Supabase SQL Editor:
   ```sql
   \i supabase/migrations/20260411133000_user_consents_schema_unification.sql
   ```

3. **Verify schema**:
   ```sql
   \d user_consents
   -- Should show only: user_id, accepted_terms, consented_at
   ```

4. **Deploy code** with new schema guard

5. **Test signup flow** end-to-end

## Rollback

If issues occur:
1. Restore from backup table
2. Revert code changes
3. Address any duplicate key errors (user_id already exists)

## Future Prevention

- **ALL** user_consents writes MUST import from `@/schema/userConsents`
- **NO** direct table inserts without schema validation
- **NO** new columns without updating schema guard
- Migration includes `\d` schema verification at end

## Audit Trail Preservation

Although we're removing `email`, `ip`, `user_agent` from user_consents, this data is still captured in:
- `auth_security_logs` table (signup events)
- User metadata in auth.users

---

**Migration Date:** 2026-04-11
**Schema Version:** unified_v2
**Breaking Change:** Yes - old code with extra fields will error
