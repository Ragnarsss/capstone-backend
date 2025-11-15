import { startServer } from './app';
import { setupGlobalErrorHandlers } from './shared/middleware';

// Setup global error handlers (uncaughtException, unhandledRejection)
setupGlobalErrorHandlers();

startServer();
