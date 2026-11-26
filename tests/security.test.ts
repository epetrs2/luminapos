import { describe, it, expect } from 'vitest';
import { validatePasswordPolicy } from '../utils/security';

describe('security password policy', () => {
  it('rejects weak passwords missing length, uppercase, lowercase, or digits', () => {
    expect(validatePasswordPolicy('123456').isValid).toBe(false);
    expect(validatePasswordPolicy('abcdefgh').isValid).toBe(false);
    expect(validatePasswordPolicy('Abcdefgh').isValid).toBe(false);
    expect(validatePasswordPolicy('ABCDEFG1').isValid).toBe(false);
    expect(validatePasswordPolicy('Abc1234').isValid).toBe(false); // 7 chars
  });

  it('accepts strong passwords with 8+ chars, upper, lower, and number', () => {
    const res = validatePasswordPolicy('Zajtain2026');
    expect(res.isValid).toBe(true);
    expect(res.errors).toHaveLength(0);
  });
});
