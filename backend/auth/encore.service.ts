import { Service } from 'encore.dev/service';
import { Gateway } from 'encore.dev/api';
import { handler } from './auth-handler';

export default new Service('auth');

export const gateway = new Gateway({ authHandler: handler });
