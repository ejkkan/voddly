import { Topic } from 'encore.dev/pubsub';

// Types for different control messages
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

export interface TVStatusMessage {
  userId: string;
  deviceId: string;
  status: 'playing' | 'paused' | 'stopped' | 'buffering';
  currentPosition?: number;
  duration?: number;
  contentId?: string;
  timestamp: number;
}

// Pub/Sub Topics
export const tvControlTopic = new Topic<TVControlMessage>('tv-control', {
  deliveryGuarantee: 'at-least-once',
});

export const tvStatusTopic = new Topic<TVStatusMessage>('tv-status', {
  deliveryGuarantee: 'at-least-once',
});