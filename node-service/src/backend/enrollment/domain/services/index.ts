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
  type IRestrictionService,
} from '../../../restriction/application/services/restriction.service';
export type { RestrictionResult } from '../../../restriction/domain/models';
