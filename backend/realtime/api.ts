import { api } from 'encore.dev/api';
import { tvControlTopic, tvStatusTopic, TVControlMessage, TVStatusMessage } from './topics';
import log from 'encore.dev/log';

// API for mobile app to send control commands to TV
export const sendTVControl = api(
  {
    method: 'POST',
    path: '/realtime/tv/control',
    auth: true,
  },
  async (req: {
    deviceId: string;
    command: TVControlMessage['command'];
    payload?: TVControlMessage['payload'];
  }): Promise<{ success: boolean }> => {
    const { auth } = req;
    
    if (!auth?.accountId) {
      throw new Error('Authentication required');
    }

    const message: TVControlMessage = {
      userId: auth.accountId,
      deviceId: req.deviceId,
      command: req.command,
      payload: req.payload,
      timestamp: Date.now(),
    };

    log.info('Publishing TV control message', { message });

    // Publish to the control topic
    const messageId = await tvControlTopic.publish(message);
    
    log.info('TV control message published', { messageId });

    return { success: true };
  }
);

// API for TV app to send status updates
export const sendTVStatus = api(
  {
    method: 'POST',
    path: '/realtime/tv/status',
    auth: true,
  },
  async (req: {
    deviceId: string;
    status: TVStatusMessage['status'];
    currentPosition?: number;
    duration?: number;
    contentId?: string;
  }): Promise<{ success: boolean }> => {
    const { auth } = req;
    
    if (!auth?.accountId) {
      throw new Error('Authentication required');
    }

    const message: TVStatusMessage = {
      userId: auth.accountId,
      deviceId: req.deviceId,
      status: req.status,
      currentPosition: req.currentPosition,
      duration: req.duration,
      contentId: req.contentId,
      timestamp: Date.now(),
    };

    log.info('Publishing TV status message', { message });

    // Publish to the status topic
    const messageId = await tvStatusTopic.publish(message);
    
    log.info('TV status message published', { messageId });

    return { success: true };
  }
);