import "server-only";

import {
  DispatchStage,
  DispatchErrorCode,
} from "@/lib/events/app-event";

/**
 * NOTIFICATION GUARDS
 * ============================================================================
 * Runtime validation guards for notification system.
 * - Payload guards (no event identity in payload)
 * - Dispatch input validation
 * - Stage transition validation
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Forbidden payload keys (event identity protection)
// ---------------------------------------------------------------------------

export const FORBIDDEN_PAYLOAD_KEYS = ["event_type", "notification_kind"] as const;

export class DispatchInvariantError extends Error {
  readonly code: DispatchErrorCode;
  readonly stage: DispatchStage;

  constructor(message: string, code: DispatchErrorCode, stage: DispatchStage) {
    super(message);
    this.name = "DispatchInvariantError";
    this.code = code;
    this.stage = stage;
  }
}

export const isDispatchInvariantError = (error: unknown): error is DispatchInvariantError =>
  error instanceof DispatchInvariantError;

export const failDispatch = (
  message: string,
  code: DispatchErrorCode,
  stage: DispatchStage,
): never => {
  throw new DispatchInvariantError(message, code, stage);
};

/**
 * Payload içinde event kimliği taşıyan legacy anahtarların yazılmasını runtime'da
 * engeller. DB'de CHECK constraint'i zaten bu ihlali reddeder; bu guard ilk
 * savunma hattıdır ve hata mesajını uygulama katmanında anlaşılır kılar.
 */
export const assertNoEventIdentityInPayload = (
  payload: Record<string, unknown> | undefined,
): void => {
  if (!payload) return;
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (key in payload) {
      failDispatch(
        `Payload must not contain event identity key '${key}'. Use automation_events.event_type column instead.`,
        DispatchErrorCode.FORBIDDEN_PAYLOAD_KEY,
        DispatchStage.VALIDATE,
      );
    }
  }
};

export const assertValidDispatchInput = (input: {
  userId?: string | null;
  dedupeKey?: string | null;
  assetId?: string | null;
  assetName?: string | null;
  notificationTitle?: string | null;
  notificationMessage?: string | null;
}): void => {
  if (!input.userId?.trim()) {
    failDispatch("User ID is required", DispatchErrorCode.MISSING_USER_ID, DispatchStage.VALIDATE);
  }
  if (input.dedupeKey != null && !input.dedupeKey.trim()) {
    failDispatch(
      "dedupeKey is required",
      DispatchErrorCode.MISSING_DEDUPE_KEY,
      DispatchStage.VALIDATE,
    );
  }
  if (input.assetId != null && !input.assetId.trim()) {
    failDispatch(
      "Asset ID is required",
      DispatchErrorCode.INVALID_DISPATCH_INPUT,
      DispatchStage.VALIDATE,
    );
  }
  if (input.assetName != null && !input.assetName.trim()) {
    failDispatch(
      "Asset name is required",
      DispatchErrorCode.INVALID_DISPATCH_INPUT,
      DispatchStage.VALIDATE,
    );
  }
  if (input.notificationTitle != null && !input.notificationTitle.trim()) {
    failDispatch(
      "Notification title is required",
      DispatchErrorCode.MISSING_TITLE,
      DispatchStage.VALIDATE,
    );
  }
  if (input.notificationMessage != null && !input.notificationMessage.trim()) {
    failDispatch(
      "Notification message is required",
      DispatchErrorCode.MISSING_MESSAGE,
      DispatchStage.VALIDATE,
    );
  }
};

// ---------------------------------------------------------------------------
// Stage transition validation
// ---------------------------------------------------------------------------

const DISPATCH_STAGE_ORDER: DispatchStage[] = [
  DispatchStage.VALIDATE,
  DispatchStage.PERSIST_EVENT,
  DispatchStage.CREATE_NOTIFICATION,
  DispatchStage.SIDE_EFFECTS,
  DispatchStage.COMPLETE,
];

export const assertDispatchStageTransition = (
  currentStage: DispatchStage,
  nextStage: DispatchStage,
): void => {
  const currentIndex = DISPATCH_STAGE_ORDER.indexOf(currentStage);
  const nextIndex = DISPATCH_STAGE_ORDER.indexOf(nextStage);
  if (currentIndex === -1 || nextIndex === -1 || nextIndex < currentIndex) {
    failDispatch(
      `Invalid dispatch stage transition: ${currentStage} -> ${nextStage}`,
      DispatchErrorCode.INVALID_STAGE_TRANSITION,
      nextStage,
    );
  }
};

export const advanceDispatchStage = (
  currentStage: DispatchStage,
  nextStage: DispatchStage,
): DispatchStage => {
  assertDispatchStageTransition(currentStage, nextStage);
  return nextStage;
};
