# Security Specification - StockConv

## Data Invariants
1. A user profile must have a valid UID matching their Auth UID.
2. Only admins can modify user roles or set unlimited status.
3. Users can only deduct 1 credit at a time during conversion.
4. Admins have full access to all user profiles for management.

## The Dirty Dozen Payloads
1. Attempt to set `role: 'admin'` as a normal user.
2. Attempt to set `isUnlimited: true` as a normal user.
3. Attempt to increase `credits` as a normal user.
4. Attempt to read another user's profile.
5. Attempt to update another user's profile.
6. Attempt to delete own profile.
7. Attempt to create a profile with a different UID.
8. Attempt to inject a very long string into the `email` field.
9. Attempt to update `credits` by more than -1 as a normal user.
10. Attempt to bypass `email_verified` check (if mandated).
11. Attempt to modify `createdAt` after creation.
12. Attempt to create a profile without being signed in.

## Test Runner (Conceptual)
The following rules will ensure all above payloads are PERMISSION_DENIED.
