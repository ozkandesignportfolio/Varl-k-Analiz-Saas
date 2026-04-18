/**
 * GUARDS
 * ============================================================================
 * Runtime validation and invariant guards.
 * ============================================================================
 */

export {
  FORBIDDEN_PAYLOAD_KEYS,
  DispatchInvariantError,
  assertNoEventIdentityInPayload,
  assertValidDispatchInput,
  assertDispatchStageTransition,
  advanceDispatchStage,
  isDispatchInvariantError,
  failDispatch,
} from "./notification-guards";
