import { Hono } from 'hono';
import { health } from './health';
import { scenarios } from './scenarios';
import { sessions } from './sessions';

const routes = new Hono();

// Mount route groups
routes.route('/health', health);
routes.route('/sessions', sessions);
routes.route('/scenarios', scenarios);

export { routes };
