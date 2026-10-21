import { describe, expect, it } from 'vitest';
import { resolveTheme } from '@/app/theme';
import { messageErreur } from '@/lib/errors';

describe('messageErreur', () => {
  it('traduit les erreurs connues en français', () => {
    expect(messageErreur(new Error('Invalid login credentials'))).toMatch(/incorrect/);
    expect(messageErreur({ message: 'auto_modification_interdite' })).toMatch(/propres rôles/);
    expect(messageErreur(new TypeError('Failed to fetch'))).toMatch(/injoignable/);
  });
  it('ne divulgue pas les détails techniques inconnus', () => {
    const msg = messageErreur(new Error('relation "public.secret_table" violates something'));
    expect(msg).not.toMatch(/secret_table/);
  });
});

describe('resolveTheme', () => {
  it('respecte la préférence, sinon le système', () => {
    expect(resolveTheme('clair', true)).toBe('light');
    expect(resolveTheme('sombre', false)).toBe('dark');
    expect(resolveTheme('systeme', true)).toBe('dark');
    expect(resolveTheme('systeme', false)).toBe('light');
  });
});
