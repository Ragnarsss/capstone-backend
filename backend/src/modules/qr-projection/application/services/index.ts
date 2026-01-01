/**
 * Application Services - QR Projection
 * 
 * Servicios de aplicacion que orquestan logica de negocio
 */

export { PoolFeeder } from './pool-feeder.service';
export type { FeedStudentInput, FeedResult } from './pool-feeder.service';

export { PoolBalancer } from './pool-balancer.service';
export type { PoolBalancerConfig, BalanceResult } from './pool-balancer.service';

export { QREmitter } from './qr-emitter.service';
export type { QREmitterConfig, EmitCallback, ShouldStopCallback } from './qr-emitter.service';
