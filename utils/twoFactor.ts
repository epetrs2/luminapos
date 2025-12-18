import { TOTP, Secret } from 'otpauth';
import QRCode from 'qrcode';

// Generate a random Base32 Secret
export const generate2FASecret = (): string => {
  const secret = new Secret({ size: 20 });
  return secret.base32;
};

// Generate QR Code Data URL for the authenticator app
export const generateQRCode = async (secret: string, label: string, issuer: string = 'LuminaPOS'): Promise<string> => {
  const totp = new TOTP({
    issuer: issuer,
    label: label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });

  const uri = totp.toString();
  return await QRCode.toDataURL(uri);
};

// Verify a 6-digit token against the secret
export const verify2FAToken = (token: string, secret: string): boolean => {
  if (!token || !secret) return false;
  
  try {
      // Clean the token of spaces or dashes just in case
      const cleanToken = token.replace(/[\s-]/g, '');

      const totp = new TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(secret),
      });

      // Returns the delta (integer) if valid, null if invalid. 
      // Window of 4 means: It checks 4 periods (30s each) before and after.
      // This allows for a +/- 2 minute clock drift, which fixes most mobile/desktop sync issues.
      const delta = totp.validate({ token: cleanToken, window: 4 });
      
      return delta !== null;
  } catch (error) {
      console.error("2FA Verification Error:", error);
      return false;
  }
};