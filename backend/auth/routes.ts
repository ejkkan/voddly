import { api } from 'encore.dev/api';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './better-auth';

export const authRouter = api.raw(
  {
    expose: true,
    path: '/api/auth/*params',
    method: '*',
  },
  async (req, res) => {
    const authHandler = toNodeHandler(auth);
    authHandler(req, res)
      .then(() => {
        // Response is handled by the auth handler
      })
      .catch((error) => {
        console.error('Auth handler error:', error);
        res.statusCode = 500;
        res.end('Internal Server Error');
      });
  }
);
