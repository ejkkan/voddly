// Note: This would be implemented in your tvOS app
// Since it's React Native, the implementation is similar to mobile

export interface TVControlMessage {
  userId: string;
  deviceId: string;
  command: 'play' | 'pause' | 'stop' | 'seek' | 'volume' | 'switch_content';
  payload?: {
    position?: number;
    volume?: number;
    contentId?: string;
    contentType?: 'movie' | 'series' | 'live';
  };
  timestamp: number;
}

export class TVControlListener {
  private eventSource: EventSource | null = null;
  private deviceId: string;
  private commandHandlers: Map<string, (payload: any) => void> = new Map();

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  // Start listening for control commands from mobile
  startListening(): void {
    if (this.eventSource) {
      this.stopListening();
    }

    // Connect to SSE endpoint for TV
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
    const url = `${baseUrl}/realtime/stream?deviceType=tv&deviceId=${this.deviceId}`;
    
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('TV connected to control stream');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'control' && data.deviceId === this.deviceId) {
          this.handleControlCommand(data);
        }
      } catch (error) {
        console.error('Failed to parse control message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('Control stream error:', error);
      // Implement reconnection logic
    };
  }

  stopListening(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // Handle incoming control commands
  private handleControlCommand(message: TVControlMessage): void {
    const handler = this.commandHandlers.get(message.command);
    if (handler) {
      handler(message.payload);
    } else {
      console.warn('No handler for command:', message.command);
    }
  }

  // Register command handlers
  onPlay(handler: () => void): void {
    this.commandHandlers.set('play', handler);
  }

  onPause(handler: () => void): void {
    this.commandHandlers.set('pause', handler);
  }

  onSeek(handler: (payload: { position: number }) => void): void {
    this.commandHandlers.set('seek', handler);
  }

  onSwitchContent(handler: (payload: { contentId: string; contentType: string }) => void): void {
    this.commandHandlers.set('switch_content', handler);
  }

  // Send status updates back to mobile
  async sendStatus(status: {
    status: 'playing' | 'paused' | 'stopped' | 'buffering';
    currentPosition?: number;
    duration?: number;
    contentId?: string;
  }): Promise<void> {
    try {
      // This would use your Encore client
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/realtime/tv/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add your auth headers here
        },
        body: JSON.stringify({
          deviceId: this.deviceId,
          ...status
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send status update');
      }
    } catch (error) {
      console.error('Failed to send status update:', error);
    }
  }
}

// Usage example for tvOS app
export const setupTVControl = (deviceId: string) => {
  const tvListener = new TVControlListener(deviceId);

  // Set up command handlers
  tvListener.onPlay(() => {
    // Handle play command
    console.log('Playing content');
    // Your video player logic here
    
    // Send status update
    tvListener.sendStatus({ status: 'playing' });
  });

  tvListener.onPause(() => {
    // Handle pause command  
    console.log('Pausing content');
    // Your video player logic here
    
    // Send status update
    tvListener.sendStatus({ status: 'paused' });
  });

  tvListener.onSeek((payload) => {
    // Handle seek command
    console.log('Seeking to:', payload.position);
    // Your video player logic here
    
    // Send status update
    tvListener.sendStatus({ 
      status: 'playing',
      currentPosition: payload.position 
    });
  });

  tvListener.onSwitchContent((payload) => {
    // Handle content switch
    console.log('Switching to content:', payload.contentId);
    // Your content switching logic here
    
    // Send status update
    tvListener.sendStatus({ 
      status: 'buffering',
      contentId: payload.contentId 
    });
  });

  // Start listening
  tvListener.startListening();

  return tvListener;
};