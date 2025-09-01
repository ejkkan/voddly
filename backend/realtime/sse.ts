import { api, APICallMeta } from 'encore.dev/api';
import { Subscription } from 'encore.dev/pubsub';
import { tvControlTopic, tvStatusTopic, TVControlMessage, TVStatusMessage } from './topics';
import log from 'encore.dev/log';

interface SSEClient {
  userId: string;
  deviceType: 'mobile' | 'tv';
  deviceId?: string;
  write: (data: string) => void;
  close: () => void;
}

// Store active SSE connections
const sseClients = new Map<string, SSEClient>();

// Subscribe to control messages (for TV apps)
const controlSubscription = new Subscription(
  tvControlTopic,
  'tv-control-sse',
  {
    handler: async (message: TVControlMessage) => {
      log.info('Received control message for SSE', { message });
      
      // Find TV clients for this user
      const clientKey = `${message.userId}-tv-${message.deviceId}`;
      const client = sseClients.get(clientKey);
      
      if (client) {
        const sseData = `data: ${JSON.stringify({
          type: 'control',
          ...message
        })}\n\n`;
        
        try {
          client.write(sseData);
          log.info('Sent control message to TV client', { userId: message.userId, deviceId: message.deviceId });
        } catch (error) {
          log.error('Failed to send SSE message', { error, clientKey });
          sseClients.delete(clientKey);
        }
      }
    },
  }
);

// Subscribe to status messages (for mobile apps)  
const statusSubscription = new Subscription(
  tvStatusTopic,
  'tv-status-sse',
  {
    handler: async (message: TVStatusMessage) => {
      log.info('Received status message for SSE', { message });
      
      // Find mobile clients for this user
      const clientKey = `${message.userId}-mobile`;
      const client = sseClients.get(clientKey);
      
      if (client) {
        const sseData = `data: ${JSON.stringify({
          type: 'status',
          ...message
        })}\n\n`;
        
        try {
          client.write(sseData);
          log.info('Sent status message to mobile client', { userId: message.userId });
        } catch (error) {
          log.error('Failed to send SSE message', { error, clientKey });
          sseClients.delete(clientKey);
        }
      }
    },
  }
);

// SSE endpoint for real-time updates
export const streamUpdates = api.raw(
  {
    method: 'GET',
    path: '/realtime/stream',
    auth: true,
  },
  async (req, resp, meta: APICallMeta) => {
    const { auth } = meta;
    
    if (!auth?.accountId) {
      resp.writeHead(401);
      resp.end('Authentication required');
      return;
    }

    // Get device type and ID from query params
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const deviceType = url.searchParams.get('deviceType') as 'mobile' | 'tv';
    const deviceId = url.searchParams.get('deviceId');

    if (!deviceType || (deviceType === 'tv' && !deviceId)) {
      resp.writeHead(400);
      resp.end('Missing deviceType or deviceId');
      return;
    }

    // Set up SSE headers
    resp.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial connection message
    resp.write('data: {"type":"connected"}\n\n');

    // Create client key
    const clientKey = deviceType === 'tv' 
      ? `${auth.accountId}-tv-${deviceId}`
      : `${auth.accountId}-mobile`;

    // Store the client connection
    const client: SSEClient = {
      userId: auth.accountId,
      deviceType,
      deviceId,
      write: (data: string) => resp.write(data),
      close: () => {
        sseClients.delete(clientKey);
        resp.end();
      }
    };

    sseClients.set(clientKey, client);
    
    log.info('SSE client connected', { 
      clientKey, 
      deviceType, 
      deviceId,
      totalClients: sseClients.size 
    });

    // Handle client disconnect
    req.on('close', () => {
      log.info('SSE client disconnected', { clientKey });
      sseClients.delete(clientKey);
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        resp.write('data: {"type":"heartbeat"}\n\n');
      } catch (error) {
        log.error('Heartbeat failed', { error, clientKey });
        clearInterval(heartbeat);
        sseClients.delete(clientKey);
      }
    }, 30000); // 30 seconds

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
    });
  }
);