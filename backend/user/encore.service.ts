import { Service } from 'encore.dev/service';
import { middleware } from 'encore.dev/api';
import log from 'encore.dev/log';
import { gateway } from '../auth/encore.service';
import { checkDeviceStatus } from './lib/device-management';
import { autoRegisterDevice } from './lib/device-auto-register';
import { userDB } from './db';

export default new Service('user', {
  middlewares: [
    // Device validation middleware - runs on authenticated endpoints
    middleware({ target: { auth: true } }, async (req, next) => {
      // Get auth data from request context
      const authData = req.auth;
      
      if (authData && authData.accountId && authData.deviceId) {
        const { accountId, deviceId, passphrase } = authData;
        
        log.info('[UserService Middleware] Validating device', { 
          deviceId, 
          accountId,
          hasPassphrase: !!passphrase 
        });
        
        try {
          const deviceStatus = await checkDeviceStatus(accountId, deviceId);
          
          if (deviceStatus.exists) {
            // Device exists and is now marked as active
            log.info('[UserService Middleware] Device validated and activated', { deviceId });
          } else if (deviceStatus.canRegister) {
            // Device can be registered
            if (passphrase) {
              // Auto-register the device with the provided passphrase
              log.info('[UserService Middleware] Auto-registering device', { 
                deviceId, 
                deviceCount: deviceStatus.deviceCount, 
                maxDevices: deviceStatus.maxDevices 
              });
              
              const registered = await autoRegisterDevice(accountId, deviceId, passphrase);
              
              if (registered) {
                log.info('[UserService Middleware] Device successfully auto-registered', { deviceId });
                // Set a flag in the request context to indicate device was registered
                (req as any).deviceAutoRegistered = true;
              } else {
                log.error('[UserService Middleware] Device auto-registration failed', { deviceId });
              }
            } else {
              // No passphrase provided, can't auto-register
              log.info('[UserService Middleware] Device needs passphrase for registration', { 
                deviceId,
                deviceCount: deviceStatus.deviceCount,
                maxDevices: deviceStatus.maxDevices
              });
            }
          } else {
            // Device limit exceeded
            log.error('[UserService Middleware] Device limit exceeded', {
              accountId,
              deviceCount: deviceStatus.deviceCount,
              maxDevices: deviceStatus.maxDevices
            });
            throw {
              code: 'device_limit_exceeded',
              message: `Device limit exceeded. You have ${deviceStatus.deviceCount} devices registered out of ${deviceStatus.maxDevices} allowed.`
            };
          }
        } catch (error) {
          // If it's a device limit error, re-throw it
          if (error && typeof error === 'object' && 'code' in error && (error as any).code === 'device_limit_exceeded') {
            throw error;
          }
          // Otherwise log and continue for backward compatibility
          log.error('[UserService Middleware] Device validation error', { error });
        }
      }
      
      // Continue to the actual endpoint
      return next(req);
    })
  ],
});

// Export the gateway for use in other services that need auth
export { gateway };

// Import all endpoints
import './endpoints';
