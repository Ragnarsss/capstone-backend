/**
 * Application Orchestrators for Enrollment
 * Coordinate complex flows across multiple services and use cases
 */

export {
  EnrollmentFlowOrchestrator,
  AccessResult,
  ConsentResponse,
  type AttemptAccessOutput,
  type ProcessConsentOutput,
  type IDeviceRepositoryForOrchestrator,
  type IPolicyServiceForOrchestrator,
} from './enrollment-flow.orchestrator';
