import { Hono } from 'hono';
import { health } from './health';
import { models } from './models';
import { scenarios } from './scenarios';
import { sessions } from './sessions';
import { userflows } from './userflows';

const routes = new Hono();

// Mount route groups
routes.route('/health', health);
routes.route('/sessions', sessions);
routes.route('/scenarios', scenarios);
routes.route('/userflows', userflows);
routes.route('/models', models);

export { routes };
