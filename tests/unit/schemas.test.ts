import { describe, expect, it } from 'vitest';
import { codeLiaisonSchema, inscriptionSchema, normalizeLinkCode } from '@/features/authentification/schemas';

const valid = {
  displayName: 'Awa Konan',
  accountType: 'eleve',
  email: ' Awa@Exemple.CI ',
  password: 'abidjan2026',
  passwordConfirm: 'abidjan2026',
  acceptePolitique: true,
};

describe('inscriptionSchema', () => {
  it('accepte une inscription valide et normalise l’e-mail', () => {
    const r = inscriptionSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('awa@exemple.ci');
  });

  it.each([
    [{ password: 'court1', passwordConfirm: 'court1' }, 'password'],
    [{ password: 'sanschiffre', passwordConfirm: 'sanschiffre' }, 'password'],
    [{ passwordConfirm: 'different1' }, 'passwordConfirm'],
    [{ accountType: 'administrateur' }, 'accountType'],
    [{ acceptePolitique: false }, 'acceptePolitique'],
    [{ displayName: 'A' }, 'displayName'],
  ])('rejette %o (champ %s)', (override, field) => {
    const r = inscriptionSchema.safeParse({ ...valid, ...override });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === field)).toBe(true);
  });
});

describe('code de liaison', () => {
  it('tolère minuscules, espaces et tirets', () => {
    expect(normalizeLinkCode(' abcd-23 45 ')).toBe('ABCD2345');
    expect(codeLiaisonSchema.parse({ code: 'abcd 2345' }).code).toBe('ABCD2345');
  });

  it('refuse les caractères hors alphabet (0, 1, I, O) et les longueurs incorrectes', () => {
    for (const code of ['ABCD-2340', 'ABCD-1234', 'IOAB-2345', 'ABC-234']) {
      expect(codeLiaisonSchema.safeParse({ code }).success).toBe(false);
    }
  });
});
