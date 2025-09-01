/**
 * Strict TypeScript types for tvOS passphrase system
 */

// Base types
export type DeviceType = 'tvos';
export type OperationType = 'validate' | 'register' | 'setup' | 'check' | 'getkey';
export type PassphraseValidationState = 'idle' | 'validating' | 'success' | 'error';

// Error types
export interface ErrorInfo {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

// Progress callback type
export type ProgressCallback = (progress: number, message?: string) => void;

// Device key data structure
export interface DeviceKeyData {
  readonly master_key_wrapped: string;
  readonly salt: string;
  readonly iv: string;
  readonly kdf_iterations: number;
  readonly server_wrapped_key?: string;
  readonly server_iv?: string;
}

// API request/response types
export interface RegisterDeviceRequest {
  readonly accountId: string;
  readonly deviceId: string;
  readonly deviceType: DeviceType;
  readonly deviceName?: string;
  readonly deviceModel?: string;
  readonly passphrase: string;
}

export interface RegisterDeviceResponse {
  readonly success: boolean;
  readonly deviceId: string;
  readonly iterations: number;
  readonly keyData: DeviceKeyData;
}

export interface CheckDeviceRequest {
  readonly accountId: string;
  readonly deviceId: string;
}

export interface CheckDeviceResponse {
  readonly isRegistered: boolean;
  readonly requiresPassphrase: boolean;
  readonly canAutoRegister?: boolean;
  readonly deviceCount?: number;
  readonly maxDevices?: number;
  readonly message?: string;
}

export interface GetDeviceKeyRequest {
  readonly accountId: string;
  readonly deviceId: string;
}

export interface GetDeviceKeyResponse {
  readonly keyData: DeviceKeyData;
}

export interface SetupPassphraseRequest {
  readonly passphrase: string;
  readonly deviceId: string;
  readonly deviceType: DeviceType;
  readonly deviceName?: string;
  readonly deviceModel?: string;
}

export interface SetupPassphraseResponse {
  readonly success: boolean;
}

// Authentication types
export interface AuthRequest {
  readonly email: string;
  readonly password: string;
}

export interface AuthResponse {
  readonly token?: string;
  readonly refreshToken?: string;
  readonly expiresIn?: number;
  readonly user?: {
    readonly id: string;
    readonly email?: string;
    readonly subscription?: {
      readonly id: string;
      readonly status: string;
    };
  };
}

// Passphrase validation types
export interface PassphraseValidationResult {
  readonly success: boolean;
  readonly deviceRegistered: boolean;
  readonly keyData?: DeviceKeyData;
}

export interface PassphraseValidationOptions {
  readonly accountId: string;
  readonly passphrase: string;
  readonly onProgress?: ProgressCallback;
  readonly timeoutMs?: number;
}

// Storage types
export interface SecureStorageEntry {
  readonly version: number;
  readonly salt: string;
  readonly nonce: string;
  readonly data: string;
  readonly timestamp: number;
}

export interface StorageMetadata {
  readonly created: number;
  readonly lastAccessed: number;
  readonly accessCount: number;
}

// Component prop types
export interface PassphraseInputProps {
  readonly onSubmit: (passphrase: string, onProgress?: ProgressCallback) => Promise<void>;
  readonly onCancel?: () => void;
  readonly title?: string;
  readonly subtitle?: string;
  readonly accountName?: string;
  readonly isVisible?: boolean;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
}

export interface PassphraseInputState {
  readonly passphrase: string;
  readonly isProcessing: boolean;
  readonly error: string | null;
  readonly showSuccess: boolean;
  readonly progress: number;
  readonly progressMessage: string;
  readonly elapsedSeconds: number;
}

// Validation types
export interface ValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly warnings?: string[];
}

export interface PassphraseValidation extends ValidationResult {
  readonly strength?: 'weak' | 'medium' | 'strong';
  readonly suggestions?: string[];
}

// Configuration types
export interface CryptoConfig {
  readonly ITERATIONS: {
    readonly TVOS: number;
    readonly DEFAULT: number;
  };
  readonly KEY_LENGTH: number;
  readonly IV_LENGTH: number;
  readonly SALT_LENGTH: number;
  readonly MIN_ENTROPY_BITS: number;
  readonly PROGRESS_CHUNK_SIZE: number;
}

export interface ManagerConfig {
  readonly MAX_CONCURRENT_OPERATIONS: number;
  readonly OPERATION_TIMEOUT_MS: number;
  readonly CACHE_TTL_MS: number;
  readonly MAX_RETRY_ATTEMPTS: number;
}

export interface StorageConfig {
  readonly ENCRYPTION_KEY_LENGTH: number;
  readonly NONCE_LENGTH: number;
  readonly SALT_LENGTH: number;
  readonly STORAGE_VERSION: number;
  readonly MASTER_KEY_STORAGE_KEY: string;
  readonly KEY_DERIVATION_ITERATIONS: number;
}

// Operation context types
export interface OperationContext {
  readonly id: string;
  readonly type: OperationType;
  readonly accountId: string;
  readonly startTime: number;
  readonly abortController: AbortController;
}

// Cache types
export interface CachedPassphrase {
  readonly passphrase: string;
  readonly timestamp: number;
  readonly accessCount: number;
}

// Statistics types
export interface ManagerStats {
  readonly activeOperations: number;
  readonly queuedOperations: number;
  readonly cachedPassphrases: number;
  readonly cleanupTimers: number;
}

export interface StorageStats {
  readonly totalItems: number;
  readonly totalSize: number;
  readonly oldestItem?: {
    readonly key: string;
    readonly created: number;
  };
  readonly mostAccessed?: {
    readonly key: string;
    readonly accessCount: number;
  };
}

// Screen dimension types
export interface ScreenDimensions {
  readonly width: number;
  readonly height: number;
  readonly orientation: 'portrait' | 'landscape';
}

// Source data types (for future implementation)
export interface SourceData {
  readonly id: string;
  readonly name: string;
  readonly type: 'iptv' | 'file' | 'stream';
  readonly url: string;
  readonly credentials?: {
    readonly username: string;
    readonly password: string;
  };
  readonly metadata?: Record<string, unknown>;
  readonly encrypted: boolean;
  readonly lastUpdated: number;
}

export interface EncryptedSourceData {
  readonly id: string;
  readonly encryptedData: string;
  readonly nonce: string;
  readonly salt: string;
  readonly lastUpdated: number;
}

// Health check types
export interface HealthCheckResponse {
  readonly status: string;
  readonly timestamp: number;
  readonly services?: Record<string, 'healthy' | 'unhealthy' | 'degraded'>;
}

// Type guards
export function isDeviceKeyData(obj: unknown): obj is DeviceKeyData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as DeviceKeyData).master_key_wrapped === 'string' &&
    typeof (obj as DeviceKeyData).salt === 'string' &&
    typeof (obj as DeviceKeyData).iv === 'string' &&
    typeof (obj as DeviceKeyData).kdf_iterations === 'number' &&
    (obj as DeviceKeyData).kdf_iterations > 0
  );
}

export function isValidAccountId(accountId: unknown): accountId is string {
  return typeof accountId === 'string' && accountId.length > 0 && accountId.length <= 128;
}

export function isValidPassphrase(passphrase: unknown): passphrase is string {
  return typeof passphrase === 'string' && passphrase.length >= 6 && passphrase.length <= 128;
}

export function isValidDeviceId(deviceId: unknown): deviceId is string {
  return typeof deviceId === 'string' && /^[a-zA-Z0-9\-_]+$/.test(deviceId);
}

// Utility types
export type NonEmptyArray<T> = [T, ...T[]];

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Event types
export interface PassphraseEvent {
  readonly type: 'start' | 'progress' | 'success' | 'error' | 'cancel';
  readonly timestamp: number;
  readonly data?: unknown;
}

export interface ProgressEvent extends PassphraseEvent {
  readonly type: 'progress';
  readonly data: {
    readonly progress: number;
    readonly message?: string;
  };
}

export interface ErrorEvent extends PassphraseEvent {
  readonly type: 'error';
  readonly data: {
    readonly error: ErrorInfo;
  };
}

// Constants as types
export const DEVICE_TYPES = ['tvos'] as const;
export const OPERATION_TYPES = ['validate', 'register', 'setup', 'check', 'getkey'] as const;
export const VALIDATION_STATES = ['idle', 'validating', 'success', 'error'] as const;