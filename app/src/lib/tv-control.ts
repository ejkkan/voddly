import { client } from './encore-client';

export interface TVControlCommand {
  deviceId: string;
  command: 'play' | 'pause' | 'stop' | 'seek' | 'volume' | 'switch_content';
  payload?: {
    position?: number;
    volume?: number;
    contentId?: string;
    contentType?: 'movie' | 'series' | 'live';
  };
}

export interface TVStatus {
  deviceId: string;
  status: 'playing' | 'paused' | 'stopped' | 'buffering';
  currentPosition?: number;
  duration?: number;
  contentId?: string;
  timestamp: number;
}

export class TVControlManager {
  private eventSource: EventSource | null = null;
  private statusCallbacks: ((status: TVStatus) => void)[] = [];

  // Send control command to TV
  async sendCommand(command: TVControlCommand): Promise<boolean> {
    try {
      const response = await client.realtime.sendTVControl(command);
      return response.success;
    } catch (error) {
      console.error('Failed to send TV control command:', error);
      return false;
    }
  }

  // Start listening for TV status updates
  startListening(): void {
    if (this.eventSource) {
      this.stopListening();
    }

    // Connect to SSE endpoint
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
    const url = `${baseUrl}/realtime/stream?deviceType=mobile`;
    
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('Connected to TV status stream');
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'status') {
          const status: TVStatus = {
            deviceId: data.deviceId,
            status: data.status,
            currentPosition: data.currentPosition,
            duration: data.duration,
            contentId: data.contentId,
            timestamp: data.timestamp,
          };
          
          // Notify all listeners
          this.statusCallbacks.forEach(callback => callback(status));
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      // Implement reconnection logic if needed
    };
  }

  // Stop listening for updates
  stopListening(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // Subscribe to status updates
  onStatusUpdate(callback: (status: TVStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  // Convenience methods for common commands
  async play(deviceId: string): Promise<boolean> {
    return this.sendCommand({ deviceId, command: 'play' });
  }

  async pause(deviceId: string): Promise<boolean> {
    return this.sendCommand({ deviceId, command: 'pause' });
  }

  async seek(deviceId: string, position: number): Promise<boolean> {
    return this.sendCommand({
      deviceId,
      command: 'seek',
      payload: { position }
    });
  }

  async switchContent(deviceId: string, contentId: string, contentType: 'movie' | 'series' | 'live'): Promise<boolean> {
    return this.sendCommand({
      deviceId,
      command: 'switch_content',
      payload: { contentId, contentType }
    });
  }
}

// Export singleton instance
export const tvControl = new TVControlManager();