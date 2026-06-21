/**
 * Internal vs external classification (FRS §14.6, §L; TDD §6.10).
 *
 * Precedence (first match wins):
 *   1. Explicit channel-membership override.
 *   2. Sender phone belongs to a workspace user identity (global inference).
 *   3. Sender is the phone instance owner (own outbound).
 *   4. Unknown → treated as external/client-side.
 */
export type InternalSenderInput = {
  membershipInternalOverride: boolean | null;
  senderMatchesWorkspaceUser: boolean;
  senderIsPhoneOwner: boolean;
};

export function resolveIsInternal(input: InternalSenderInput): boolean {
  if (input.membershipInternalOverride !== null) {
    return input.membershipInternalOverride;
  }
  if (input.senderMatchesWorkspaceUser) return true;
  if (input.senderIsPhoneOwner) return true;
  return false;
}
