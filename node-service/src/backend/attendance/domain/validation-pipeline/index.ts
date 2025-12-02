/**
 * Validation Pipeline - Public API
 */

export { createContext, hasError, isValid } from './context';
export type { 
  ValidationContext, 
  StudentResponse, 
  QRState, 
  StudentState,
  ValidationError,
  TraceEntry,
} from './context';

export type { Stage, SyncStage } from './stage.interface';
export { toAsyncStage } from './stage.interface';

export { runPipeline, formatTrace } from './runner';
export type { RunnerResult } from './runner';
