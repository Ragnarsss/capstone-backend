/**
 * Domain Services for Enrollment
 * Pure business logic without infrastructure dependencies
 */

export {
  OneToOnePolicyService,
  type PolicyValidationResult,
  type RevokeResult,
  type IDeviceRepositoryForPolicy,
} from './one-to-one-policy.service';

export {
  RestrictionService,
  type RestrictionResult,
  type IRestrictionService,
} from './restriction.service';
