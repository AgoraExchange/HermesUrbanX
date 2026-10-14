# Shared backend implementation

Implemented in social.js, social-ui.js, social-core.js and firestore.rules. See README.md and FIREBASE-SETUP.md for activation and validation.

Collections:
- profiles/{uid}: public searchable profile and master privacy preference, no coordinates.
- usernames/{lowercase}: atomic unique name ownership.
- friends/{sender}~{recipient}: private pending/accepted relationship.
- groups/{id}: ordered members, leader, name and direct-conversation flag.
- groups/{id}/messages/{id}: immutable group messages and optional shared-place payloads.
- groups/{id}/marks/{id}: pins/paths/zones. Points are JSON-encoded to avoid Firestore's nested-array limitation.
- groups/{id}/preferences/{uid}: per-group sharing consent.
- groups/{id}/locations/{uid}: latest fix only. Membership, active profile, both switches and freshness gate reads.
- invites/{random48Hex}, groups/{id}/admissions/{uid}: expiring revocable bearer invitation, explicit admission, then transactional join. Admission allows metadata reads only, not chat/maps/locations before membership.

Deletion is retryable: mark the profile deleting/sharing off, discover and leave server groups, remove friendships/owned invites, release name and profile atomically, delete/sign out the anonymous identity, then clear personal local data. Group plans/messages remain. Deleting profiles cannot send or share locations. Expired admissions confer no access; automated cleanup of orphaned admission records is future housekeeping.

Not implemented: recovery/account linking, background push, native background tracking, pagination beyond 100 messages, end-to-end encryption, trusted server cleanup/retention jobs or broad abuse controls. The security emulator suite and two-phone checklist must pass before relying on this as a public production service.
