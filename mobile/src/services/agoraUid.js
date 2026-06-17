// Deterministic 32-bit Agora uid derived from a user UUID (or any string id).
//
// Agora identifies streams by a numeric uid, but our users are UUIDs. The
// publishing client (when it joins) and every viewer (when mapping a remote
// stream back to a participant slot) both compute the same uid for a given
// user, giving us a stable uid <-> participant mapping with no backend change.
// The room token is built with uid 0, which Agora accepts for any uid, so we
// can join with a specific derived uid against the same token.
export function uidForUser(userId) {
  if (userId == null) return 0;
  const str = String(userId);
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  const uid = hash >>> 0; // unsigned 32-bit
  return uid === 0 ? 1 : uid; // 0 is reserved ("let Agora assign")
}
