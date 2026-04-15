# User Consents Fix - Production-Safe Implementation

## Summary of Changes

This fix addresses duplicate key errors in `user_consents` table and ensures idempotent, production-safe operations.

## Issues Fixed

1. **Duplicate Key Errors**: Changed from `insert()` to `upsert({ onConflict: "user_id" })` 
2. **Unsafe Consent Creation**: Added proper error handling and validation
3. **SQL/JS Separation**: Clean separation maintained - no JavaScript in SQL
4. **Signup Flow**: Verified atomic flow - consents created after email confirmation

## Files Modified

### 1. `src/lib/auth/signup-security.ts` (Lines 115-127)
```typescript
// BEFORE: Used insert() - caused duplicate key errors
const { error } = await client.from("user_consents").insert(payload);

// AFTER: Uses upsert() - idempotent, no errors on duplicate
const { error } = await client
  .from("user_consents")
  .upsert(payload, { onConflict: "user_id" });
```

### 2. `src/lib/auth/user-bootstrap.ts` (Lines 65-118)
- Simplified error handling - removed redundant 23505 checks
- Upsert is naturally idempotent, no need to check for duplicate errors

### 3. `supabase/migrations/20260415180000_user_consents_idempotent_fix.sql`
New production-safe migration with:
- Idempotent table creation (IF NOT EXISTS)
- Database-level upsert function: `upsert_user_consent()`
- Proper RLS policies
- Clean grants (service_role only for admin operations)

## Database Schema

```sql
create table public.user_consents (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  accepted_terms boolean not null default true,
  consented_at timestamptz not null default now()
);
```

**Columns:**
- `user_id`: UUID, PK, references auth.users(id), ON DELETE CASCADE
- `accepted_terms`: BOOLEAN, NOT NULL, DEFAULT true
- `consented_at`: TIMESTAMPTZ, NOT NULL, DEFAULT now()

## Recommended Signup Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SIGNUP FLOW                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. POST /api/auth/signup                                               │
│     ├── Turnstile verification                                          │
│     ├── Rate limit checks                                               │
│     ├── Create Supabase Auth User (generateLink)                      │
│     └── Send confirmation email                                         │
│                                                                         │
│  2. User clicks email confirmation link                                  │
│     └── Redirects to /auth/callback                                    │
│                                                                         │
│  3. GET /auth/callback                                                  │
│     ├── Exchange code for session                                       │
│     └── Call bootstrapUserRecords(userId)                              │
│                                                                         │
│  4. bootstrapUserRecords (IDEMPOTENT)                                    │
│     ├── upsert profiles (onConflict: id)                               │
│     ├── upsert notification_settings (onConflict: user_id)             │
│     ├── upsert user_consents (onConflict: user_id)  ← NO ERRORS!         │
│     └── create welcome notification (only if new)                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Principles

### 1. Idempotent Operations
All database writes use `upsert()` with `onConflict`:
```typescript
await supabase
  .from("user_consents")
  .upsert({ user_id, accepted_terms, consented_at }, { onConflict: "user_id" });
```

### 2. Safe to Call Multiple Times
- No duplicate key errors
- No crashes on retry
- Last-write-wins for updates

### 3. User-Friendly UX
- If user already exists: silently continue or show friendly message
- Never expose technical error codes to users
- Consent record created automatically on first login

### 4. Clean Separation
- **SQL Layer**: Schema definition, RLS policies, helper functions
- **JS Layer**: Business logic, validation, user feedback
- Never mix JavaScript into SQL migrations

## Usage Examples

### Creating/Updating Consent (Idempotent)
```typescript
import { insertUserConsent } from "@/lib/auth/signup-security";

// Safe to call multiple times - no errors
await insertUserConsent({
  userId: session.user.id,
  acceptedTerms: true,
  consentedAt: new Date().toISOString()
});
```

### Using Database Function Directly
```typescript
// For edge functions or direct SQL
const { data, error } = await supabase.rpc("upsert_user_consent", {
  p_user_id: userId,
  p_accepted_terms: true,
  p_consented_at: new Date().toISOString()
});
```

### Bootstrap on First Login
```typescript
import { bootstrapUserRecords } from "@/lib/auth/user-bootstrap";

// Called in /auth/callback after email confirmation
const result = await bootstrapUserRecords({
  userId: session.user.id,
  email: session.user.email,
  acceptedTerms: true
});

if (!result.ok) {
  console.error("Bootstrap failed:", result.error);
  // Don't block user - just log and continue
}
```

## Error Handling

### What Will NOT Happen (Idempotent Design)
- ❌ Duplicate key value violates unique constraint
- ❌ Crash on retry
- ❌ Partial record creation

### What WILL Be Caught
- ✅ Database connection errors
- ✅ Permission/RLS violations
- ✅ Invalid UUID format
- ✅ Schema violations (via trigger)

## Migration Status

Run the new migration:
```bash
supabase db push
# or
psql $DATABASE_URL -f supabase/migrations/20260415180000_user_consents_idempotent_fix.sql
```

## Verification Queries

```sql
-- Check table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'user_consents';

-- Check RLS policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_consents';

-- Test idempotent insert (run twice, both should succeed)
SELECT upsert_user_consent(
  '00000000-0000-0000-0000-000000000000'::uuid, 
  true, 
  now()
);
```

## Testing Checklist

- [ ] Run migration successfully
- [ ] Sign up as new user - consent record created
- [ ] Sign up same user again - no duplicate key error
- [ ] Log in existing user - consent record updated (if needed)
- [ ] Delete user - cascade removes consent record
- [ ] RLS policies block unauthorized access
