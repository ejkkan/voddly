import { Service } from 'encore.dev/service';

import { gateway } from '../auth/encore.service';

export default new Service('user', {
  middlewares: [],
});

// Export the gateway for use in other services that need auth
export { gateway };

// Import all endpoints
import './endpoints';
