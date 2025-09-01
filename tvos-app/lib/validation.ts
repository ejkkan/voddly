/**
 * Comprehensive input validation utilities for tvOS passphrase system
 */

import {
  ValidationResult,
  PassphraseValidation,
  isValidAccountId,
  isValidPassphrase,
  isValidDeviceId,
  DeviceKeyData,
  isDeviceKeyData,
} from './types';

// Validation constants
const VALIDATION_CONSTANTS = {
  PASSPHRASE: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 128,
    COMMON_PATTERNS: [
      /^(.)\1{5,}$/, // All same character
      /^(012345|123456|654321|abcdef|qwerty|password|admin)$/i, // Common weak passwords
      /^(111111|222222|333333|444444|555555|666666|777777|888888|999999|000000)$/, // Repeated digits
    ],
  },
  ACCOUNT_ID: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 128,
    PATTERN: /^[a-zA-Z0-9\-_\.@]+$/,
  },
  DEVICE_ID: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 256,
    PATTERN: /^[a-zA-Z0-9\-_]+$/,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MAX_LENGTH: 254,
  },
  DEVICE_NAME: {
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9\s\-_'.,()]+$/,
  },
} as const;

/**
 * Validate passphrase with comprehensive checks
 */
export function validatePassphrase(passphrase: unknown): PassphraseValidation {
  // Type check
  if (!isValidPassphrase(passphrase)) {
    return {
      valid: false,
      error: 'Passphrase must be a string between 6 and 128 characters',
      strength: 'weak',
    };
  }

  const warnings: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'medium';
  const suggestions: string[] = [];

  // Length checks
  if (passphrase.length < VALIDATION_CONSTANTS.PASSPHRASE.MIN_LENGTH) {
    return {
      valid: false,
      error: `Passphrase must be at least ${VALIDATION_CONSTANTS.PASSPHRASE.MIN_LENGTH} characters`,
      strength: 'weak',
    };
  }

  if (passphrase.length > VALIDATION_CONSTANTS.PASSPHRASE.MAX_LENGTH) {
    return {
      valid: false,
      error: `Passphrase must be less than ${VALIDATION_CONSTANTS.PASSPHRASE.MAX_LENGTH} characters`,
      strength: 'weak',
    };
  }

  // Check for common weak patterns
  for (const pattern of VALIDATION_CONSTANTS.PASSPHRASE.COMMON_PATTERNS) {
    if (pattern.test(passphrase)) {
      return {
        valid: false,
        error: 'Passphrase is too common or predictable, please choose a different one',
        strength: 'weak',
        suggestions: [
          'Use a mix of letters, numbers, and symbols',
          'Avoid common patterns like "123456" or "password"',
          'Consider using a memorable phrase with substitutions',
        ],
      };
    }
  }

  // Strength analysis
  const hasLowercase = /[a-z]/.test(passphrase);
  const hasUppercase = /[A-Z]/.test(passphrase);
  const hasNumbers = /\d/.test(passphrase);
  const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passphrase);
  const hasSpaces = /\s/.test(passphrase);

  const characterTypes = [hasLowercase, hasUppercase, hasNumbers, hasSymbols, hasSpaces].filter(Boolean).length;

  // Determine strength
  if (passphrase.length >= 12 && characterTypes >= 3) {
    strength = 'strong';
  } else if (passphrase.length >= 8 && characterTypes >= 2) {
    strength = 'medium';
  } else {
    strength = 'weak';
    warnings.push('Passphrase could be stronger');
  }

  // Generate suggestions based on analysis
  if (!hasNumbers) {
    suggestions.push('Consider adding numbers for better security');
  }
  if (!hasUppercase && hasLowercase) {
    suggestions.push('Consider adding uppercase letters');
  }
  if (!hasSymbols) {
    suggestions.push('Consider adding symbols (!@#$%^&*) for stronger security');
  }
  if (passphrase.length < 8) {
    suggestions.push('Consider using a longer passphrase (8+ characters)');
  }

  // Check for sequential characters
  const hasSequential = /(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789)/i.test(passphrase);
  if (hasSequential) {
    warnings.push('Contains sequential characters');
    suggestions.push('Avoid sequential characters like "abc" or "123"');
  }

  return {
    valid: true,
    strength,
    warnings: warnings.length > 0 ? warnings : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Validate account ID
 */
export function validateAccountId(accountId: unknown): ValidationResult {
  if (!isValidAccountId(accountId)) {
    return {
      valid: false,
      error: 'Account ID must be a non-empty string',
    };
  }

  if (accountId.length > VALIDATION_CONSTANTS.ACCOUNT_ID.MAX_LENGTH) {
    return {
      valid: false,
      error: `Account ID must be less than ${VALIDATION_CONSTANTS.ACCOUNT_ID.MAX_LENGTH} characters`,
    };
  }

  if (!VALIDATION_CONSTANTS.ACCOUNT_ID.PATTERN.test(accountId)) {
    return {
      valid: false,
      error: 'Account ID contains invalid characters (only letters, numbers, hyphens, underscores, dots, and @ allowed)',
    };
  }

  return { valid: true };
}

/**
 * Validate device ID
 */
export function validateDeviceId(deviceId: unknown): ValidationResult {
  if (!isValidDeviceId(deviceId)) {
    return {
      valid: false,
      error: 'Device ID must be a non-empty string with valid characters',
    };
  }

  if (deviceId.length > VALIDATION_CONSTANTS.DEVICE_ID.MAX_LENGTH) {
    return {
      valid: false,
      error: `Device ID must be less than ${VALIDATION_CONSTANTS.DEVICE_ID.MAX_LENGTH} characters`,
    };
  }

  return { valid: true };
}

/**
 * Validate email address
 */
export function validateEmail(email: unknown): ValidationResult {
  if (typeof email !== 'string') {
    return {
      valid: false,
      error: 'Email must be a string',
    };
  }

  if (email.length === 0) {
    return {
      valid: false,
      error: 'Email is required',
    };
  }

  if (email.length > VALIDATION_CONSTANTS.EMAIL.MAX_LENGTH) {
    return {
      valid: false,
      error: `Email must be less than ${VALIDATION_CONSTANTS.EMAIL.MAX_LENGTH} characters`,
    };
  }

  if (!VALIDATION_CONSTANTS.EMAIL.PATTERN.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address',
    };
  }

  return { valid: true };
}

/**
 * Validate device name
 */
export function validateDeviceName(deviceName: unknown): ValidationResult {
  if (deviceName === null || deviceName === undefined) {
    return { valid: true }; // Optional field
  }

  if (typeof deviceName !== 'string') {
    return {
      valid: false,
      error: 'Device name must be a string',
    };
  }

  if (deviceName.length === 0) {
    return { valid: true }; // Empty is allowed
  }

  if (deviceName.length > VALIDATION_CONSTANTS.DEVICE_NAME.MAX_LENGTH) {
    return {
      valid: false,
      error: `Device name must be less than ${VALIDATION_CONSTANTS.DEVICE_NAME.MAX_LENGTH} characters`,
    };
  }

  if (!VALIDATION_CONSTANTS.DEVICE_NAME.PATTERN.test(deviceName)) {
    return {
      valid: false,
      error: 'Device name contains invalid characters',
    };
  }

  return { valid: true };
}

/**
 * Validate device key data structure
 */
export function validateDeviceKeyData(data: unknown): ValidationResult {
  if (!isDeviceKeyData(data)) {
    return {
      valid: false,
      error: 'Invalid device key data structure',
    };
  }

  // Validate base64 strings
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;

  if (!base64Pattern.test(data.master_key_wrapped)) {
    return {
      valid: false,
      error: 'Invalid master key format',
    };
  }

  if (!base64Pattern.test(data.salt)) {
    return {
      valid: false,
      error: 'Invalid salt format',
    };
  }

  if (!base64Pattern.test(data.iv)) {
    return {
      valid: false,
      error: 'Invalid IV format',
    };
  }

  // Validate iterations
  if (data.kdf_iterations < 10000) {
    return {
      valid: false,
      error: 'KDF iterations must be at least 10,000 for security',
    };
  }

  if (data.kdf_iterations > 10000000) {
    return {
      valid: false,
      error: 'KDF iterations exceed maximum allowed value',
    };
  }

  // Validate optional server wrapper fields
  if (data.server_wrapped_key !== undefined) {
    if (typeof data.server_wrapped_key !== 'string' || !base64Pattern.test(data.server_wrapped_key)) {
      return {
        valid: false,
        error: 'Invalid server wrapped key format',
      };
    }
  }

  if (data.server_iv !== undefined) {
    if (typeof data.server_iv !== 'string' || !base64Pattern.test(data.server_iv)) {
      return {
        valid: false,
        error: 'Invalid server IV format',
      };
    }
  }

  return { valid: true };
}

/**
 * Validate progress value
 */
export function validateProgress(progress: unknown): ValidationResult {
  if (typeof progress !== 'number') {
    return {
      valid: false,
      error: 'Progress must be a number',
    };
  }

  if (progress < 0 || progress > 1) {
    return {
      valid: false,
      error: 'Progress must be between 0 and 1',
    };
  }

  if (isNaN(progress) || !isFinite(progress)) {
    return {
      valid: false,
      error: 'Progress must be a valid finite number',
    };
  }

  return { valid: true };
}

/**
 * Validate timeout value
 */
export function validateTimeout(timeout: unknown): ValidationResult {
  if (timeout === null || timeout === undefined) {
    return { valid: true }; // Optional
  }

  if (typeof timeout !== 'number') {
    return {
      valid: false,
      error: 'Timeout must be a number',
    };
  }

  if (timeout <= 0) {
    return {
      valid: false,
      error: 'Timeout must be positive',
    };
  }

  if (timeout > 300000) { // 5 minutes max
    return {
      valid: false,
      error: 'Timeout cannot exceed 5 minutes',
    };
  }

  return { valid: true };
}

/**
 * Sanitize string input to prevent XSS and other attacks
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate and sanitize device model
 */
export function validateDeviceModel(deviceModel: unknown): ValidationResult {
  if (deviceModel === null || deviceModel === undefined) {
    return { valid: true }; // Optional field
  }

  if (typeof deviceModel !== 'string') {
    return {
      valid: false,
      error: 'Device model must be a string',
    };
  }

  if (deviceModel.length === 0) {
    return { valid: true }; // Empty is allowed
  }

  if (deviceModel.length > 50) {
    return {
      valid: false,
      error: 'Device model must be less than 50 characters',
    };
  }

  // Allow alphanumeric, spaces, hyphens, dots, and parentheses
  if (!/^[a-zA-Z0-9\s\-\.()]+$/.test(deviceModel)) {
    return {
      valid: false,
      error: 'Device model contains invalid characters',
    };
  }

  return { valid: true };
}

/**
 * Validate iteration count
 */
export function validateIterations(iterations: unknown): ValidationResult {
  if (typeof iterations !== 'number') {
    return {
      valid: false,
      error: 'Iterations must be a number',
    };
  }

  if (!Number.isInteger(iterations)) {
    return {
      valid: false,
      error: 'Iterations must be an integer',
    };
  }

  if (iterations < 10000) {
    return {
      valid: false,
      error: 'Iterations must be at least 10,000 for security',
    };
  }

  if (iterations > 10000000) {
    return {
      valid: false,
      error: 'Iterations exceed maximum allowed value',
    };
  }

  return { valid: true };
}

/**
 * Comprehensive validation for registration request
 */
export function validateRegistrationRequest(request: unknown): ValidationResult {
  if (typeof request !== 'object' || request === null) {
    return {
      valid: false,
      error: 'Registration request must be an object',
    };
  }

  const req = request as Record<string, unknown>;

  // Validate required fields
  const accountIdValidation = validateAccountId(req.accountId);
  if (!accountIdValidation.valid) {
    return accountIdValidation;
  }

  const deviceIdValidation = validateDeviceId(req.deviceId);
  if (!deviceIdValidation.valid) {
    return deviceIdValidation;
  }

  const passphraseValidation = validatePassphrase(req.passphrase);
  if (!passphraseValidation.valid) {
    return {
      valid: false,
      error: passphraseValidation.error,
    };
  }

  // Validate device type
  if (req.deviceType !== 'tvos') {
    return {
      valid: false,
      error: 'Device type must be "tvos"',
    };
  }

  // Validate optional fields
  const deviceNameValidation = validateDeviceName(req.deviceName);
  if (!deviceNameValidation.valid) {
    return deviceNameValidation;
  }

  const deviceModelValidation = validateDeviceModel(req.deviceModel);
  if (!deviceModelValidation.valid) {
    return deviceModelValidation;
  }

  return { valid: true };
}

/**
 * Get validation error message for user display
 */
export function getValidationErrorMessage(validation: ValidationResult): string {
  if (validation.valid) {
    return '';
  }

  return validation.error || 'Validation failed';
}

/**
 * Check if validation has warnings
 */
export function hasValidationWarnings(validation: ValidationResult): boolean {
  return Array.isArray(validation.warnings) && validation.warnings.length > 0;
}

/**
 * Get all validation warnings as a single string
 */
export function getValidationWarnings(validation: ValidationResult): string {
  if (!hasValidationWarnings(validation)) {
    return '';
  }

  return validation.warnings!.join('; ');
}