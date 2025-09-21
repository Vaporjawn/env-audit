import { createLogger } from './dist/index.js';

const logger = createLogger();
logger.debug('This is a debug message');
logger.info('This is an info message');
console.log('Environment variables:', process.env.ENVAUDIT_LOG_LEVEL);