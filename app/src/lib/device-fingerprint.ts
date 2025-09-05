import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Generate a stable device fingerprint that survives localStorage clear
 * Uses stable device characteristics that don't change
 */

interface FingerprintComponents {
  platform: string;
  // Stable web identifiers
  screenResolution?: string;
  timezone?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  canvasFingerprint?: string;
  webglFingerprint?: string;
  audioFingerprint?: string;
  // Mobile identifiers
  modelId?: string;
  brand?: string;
  osVersion?: string;
  deviceName?: string;
}

/**
 * Simple hash function for creating consistent IDs
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate Canvas fingerprint - very stable hardware-based signature
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    canvas.width = 200;
    canvas.height = 50;
    
    // Use multiple rendering techniques for uniqueness
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Device fingerprint 🔒', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('Canvas test', 4, 35);
    
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

/**
 * Generate WebGL fingerprint - extremely stable GPU signature
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';
    
    // Cast to WebGLRenderingContext for proper typing
    const webgl = gl as WebGLRenderingContext;
    
    const renderer = webgl.getParameter(webgl.RENDERER) || '';
    const vendor = webgl.getParameter(webgl.VENDOR) || '';
    const version = webgl.getParameter(webgl.VERSION) || '';
    const shadingLanguage = webgl.getParameter(webgl.SHADING_LANGUAGE_VERSION) || '';
    
    return `${renderer}|${vendor}|${version}|${shadingLanguage}`;
  } catch {
    return '';
  }
}

/**
 * Generate Audio Context fingerprint - stable audio stack signature
 */
function getAudioFingerprint(): string {
  try {
    // Check if AudioContext is available
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return '';
    
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const analyser = audioCtx.createAnalyser();
    const gainNode = audioCtx.createGain();
    const scriptProcessor = audioCtx.createScriptProcessor(4096, 1, 1);
    
    oscillator.type = 'triangle';
    oscillator.frequency.value = 10000;
    
    gainNode.gain.value = 0.05;
    
    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    // Get audio context properties
    const sampleRate = audioCtx.sampleRate.toString();
    const state = audioCtx.state;
    const maxChannelCount = audioCtx.destination.maxChannelCount.toString();
    
    // Cleanup
    try {
      audioCtx.close();
    } catch {}
    
    return `${sampleRate}|${state}|${maxChannelCount}`;
  } catch {
    return '';
  }
}

/**
 * Get stable browser fingerprint components (avoiding volatile data)
 */
function getBrowserFingerprint(): FingerprintComponents {
  const components: FingerprintComponents = {
    platform: 'web',
  };

  if (typeof window !== 'undefined') {
    const nav = window.navigator;

    // Hardware-based stable characteristics
    components.hardwareConcurrency = nav.hardwareConcurrency;
    
    // Screen characteristics (very stable per device)
    if (window.screen) {
      components.screenResolution = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}x${window.screen.pixelDepth}`;
    }

    // Timezone (stable unless user moves)
    try {
      components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {}

    // Device memory (stable hardware characteristic)
    if ('deviceMemory' in nav) {
      components.deviceMemory = (nav as any).deviceMemory;
    }
    
    // Advanced stable fingerprints
    components.canvasFingerprint = getCanvasFingerprint();
    components.webglFingerprint = getWebGLFingerprint();
    components.audioFingerprint = getAudioFingerprint();
  }

  return components;
}

/**
 * Get stable native device fingerprint components
 * Mobile devices have much more stable identifiers
 */
function getNativeFingerprint(): FingerprintComponents {
  const components: FingerprintComponents = {
    platform: Platform.OS,
  };

  // Primary stable identifiers (hardware-based)
  if (Device.modelId) {
    components.modelId = Device.modelId;
  }
  
  if (Device.brand) {
    components.brand = Device.brand;
  }
  
  // OS version (reasonably stable)
  if (Device.osVersion) {
    components.osVersion = Device.osVersion;
  }
  
  // Device name (very stable)
  if (Device.deviceName) {
    components.deviceName = Device.deviceName;
  }

  return components;
}

/**
 * Generate a stable device ID that persists across storage clears
 * This ID will be the same as long as the device characteristics don't change
 */
export function getStableDeviceId(): string {
  const components =
    Platform.OS === 'web' ? getBrowserFingerprint() : getNativeFingerprint();

  // Create a deterministic string from components
  // Order matters for consistency!
  let fingerprintString: string;
  
  if (components.platform === 'web') {
    // Web: Use stable hardware-based fingerprints
    fingerprintString = [
      components.platform,
      components.screenResolution || '',
      components.timezone || '',
      components.hardwareConcurrency?.toString() || '',
      components.deviceMemory?.toString() || '',
      components.canvasFingerprint || '',
      components.webglFingerprint || '',
      components.audioFingerprint || '',
    ].join('|');
  } else {
    // Mobile: Use device hardware identifiers
    fingerprintString = [
      components.platform,
      components.modelId || '',
      components.brand || '',
      components.deviceName || '',
      components.osVersion || '',
    ].join('|');
  }

  // Generate a consistent hash
  const hash = simpleHash(fingerprintString);

  // Create a readable device ID
  const prefix = components.platform === 'web' ? 'web' : Platform.OS;
  return `${prefix}_${hash}_device`;
}

/**
 * Get a human-readable device name
 * Avoids volatile user agent for more stable identification
 */
export function getDeviceName(): string {
  if (Platform.OS === 'web') {
    // Use stable characteristics instead of volatile user agent
    let deviceInfo = 'Web Browser';
    
    if (typeof window !== 'undefined') {
      // Use screen resolution for basic identification
      const screen = window.screen;
      if (screen) {
        deviceInfo = `Web (${screen.width}×${screen.height})`;
      }
      
      // Add hardware info if available
      const nav = window.navigator;
      if (nav.hardwareConcurrency) {
        deviceInfo += ` - ${nav.hardwareConcurrency} cores`;
      }
      
      // Try to identify OS from platform (more stable than user agent)
      try {
        const platform = nav.platform;
        if (platform.includes('Win')) deviceInfo += ' Windows';
        else if (platform.includes('Mac')) deviceInfo += ' macOS';
        else if (platform.includes('Linux')) deviceInfo += ' Linux';
      } catch {}
    }
    
    return deviceInfo;
  }

  return Device.deviceName || `${Platform.OS} Device`;
}

/**
 * Get device model/details for logging
 * Avoids volatile user agent data
 */
export function getDeviceModel(): string | undefined {
  if (Platform.OS === 'web') {
    // Use stable WebGL renderer info instead of user agent
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const webgl = gl as WebGLRenderingContext;
        const renderer = webgl.getParameter(webgl.RENDERER);
        if (renderer && typeof renderer === 'string') {
          return renderer.substring(0, 100); // Truncate for storage
        }
      }
    } catch {}
    
    // Fallback to basic platform info
    return `Web Platform (${window.navigator.platform || 'Unknown'})`;
  }

  return Device.modelName || undefined;
}

/**
 * Check if this is likely the same device (for deduplication)
 * Can be used server-side to detect duplicate registrations
 */
export function getDeviceCharacteristics() {
  const components =
    Platform.OS === 'web' ? getBrowserFingerprint() : getNativeFingerprint();

  if (components.platform === 'web') {
    return {
      platform: components.platform,
      screenResolution: components.screenResolution,
      timezone: components.timezone,
      hardwareConcurrency: components.hardwareConcurrency,
      deviceMemory: components.deviceMemory,
      webglFingerprint: components.webglFingerprint,
    };
  } else {
    return {
      platform: components.platform,
      modelId: components.modelId,
      brand: components.brand,
      deviceName: components.deviceName,
    };
  }
}

/**
 * Debug function to see what components are being used for fingerprinting
 * Useful for troubleshooting device ID changes
 */
export function debugFingerprint(): void {
  const components =
    Platform.OS === 'web' ? getBrowserFingerprint() : getNativeFingerprint();
  
  console.log('[Device Fingerprint Debug]', {
    platform: components.platform,
    stableDeviceId: getStableDeviceId(),
    components: components,
    deviceName: getDeviceName(),
    deviceModel: getDeviceModel(),
  });
}

/**
 * Compare two fingerprint component sets to see similarity
 * Returns a similarity score from 0-1
 */
export function compareFingerprints(a: FingerprintComponents, b: FingerprintComponents): number {
  if (a.platform !== b.platform) return 0;
  
  let matches = 0;
  let total = 0;
  
  const compareFields = a.platform === 'web' 
    ? ['screenResolution', 'timezone', 'hardwareConcurrency', 'deviceMemory', 'canvasFingerprint', 'webglFingerprint']
    : ['modelId', 'brand', 'deviceName', 'osVersion'];
  
  compareFields.forEach(field => {
    total++;
    const aVal = (a as any)[field];
    const bVal = (b as any)[field];
    if (aVal && bVal && aVal === bVal) {
      matches++;
    }
  });
  
  return matches / total;
}
