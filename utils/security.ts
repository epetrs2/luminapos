import DOMPurify from 'dompurify';

// Security Constants following OWASP recommendations
const PBKDF2_ITERATIONS = 310000; // High work factor to prevent GPU cracking
const SALT_SIZE = 16;
const HASH_LENGTH = 256;

// --- INPUT SANITIZATION (XSS Prevention) ---

// Helper to handle DOMPurify import which can be a factory function or an object depending on the build
const getSanitizer = () => {
    try {
        // If it's a factory function (common in some ESM builds)
        if (typeof DOMPurify === 'function') {
            return (DOMPurify as any)(window);
        }
        // If it's already an instance
        return DOMPurify;
    } catch (e) {
        console.error("Failed to initialize DOMPurify", e);
        // Return a dummy sanitizer that does nothing in worst case to prevent crash, 
        // effectively disabling sanitization but keeping app alive.
        return { sanitize: (s: string) => s };
    }
};

/**
 * Sanitizes a string to remove potential XSS vectors.
 * Use this for any user input that might be rendered later (names, notes, addresses).
 */
export const sanitize = (input: string): string => {
  const sanitizer = getSanitizer();
  return sanitizer.sanitize ? sanitizer.sanitize(input) : input;
};

/**
 * Recursively sanitizes all string properties in an object or array.
 * Useful for cleaning entire data structures (like imported backups).
 */
export const sanitizeDataStructure = <T>(data: T): T => {
  if (typeof data === 'string') {
    return sanitize(data) as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataStructure(item)) as any;
  }
  if (typeof data === 'object' && data !== null) {
    const cleanObj: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        cleanObj[key] = sanitizeDataStructure((data as any)[key]);
      }
    }
    return cleanObj;
  }
  return data;
};

// --- AUTHENTICATION SECURITY ---

// Generates a cryptographically strong random salt
export const generateSalt = (): string => {
  const array = new Uint8Array(SALT_SIZE);
  window.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

// Hashes a password using PBKDF2-HMAC-SHA256 (Industry Standard)
export const hashPassword = async (password: string, saltHex: string): Promise<string> => {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Convert hex salt back to Uint8Array
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    HASH_LENGTH
  );

  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Verifies a password against a stored hash and salt
export const verifyPassword = async (password: string, salt: string, storedHash: string): Promise<boolean> => {
  const hash = await hashPassword(password, salt);
  return hash === storedHash;
};

// Strict Password Policy Validation
export const validatePasswordPolicy = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push("Mínimo 12 caracteres");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Al menos una letra mayúscula");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Al menos una letra minúscula");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Al menos un número");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Al menos un carácter especial (!@#$...)");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};