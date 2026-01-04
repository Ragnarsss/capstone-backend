import 'dotenv/config';
import { startServer } from './app';
import { setupGlobalErrorHandlers } from './middleware';

// Setup global error handlers (uncaughtException, unhandledRejection)
setupGlobalErrorHandlers();

startServer();
