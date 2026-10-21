import { describe, expect, it } from 'vitest';
import { hasAnyRole, homePathForRoles, navigationForRoles } from '@/features/authentification/roles';

describe('rôles et navigation', () => {
  it('oriente chaque rôle vers son espace, le plus privilégié d’abord', () => {
    expect(homePathForRoles(['eleve'])).toBe('/eleve');
    expect(homePathForRoles(['parent'])).toBe('/parent');
    expect(homePathForRoles(['enseignant'])).toBe('/enseignant');
    expect(homePathForRoles(['parent', 'administrateur'])).toBe('/administration');
    expect(homePathForRoles([])).toBe('/compte-en-attente');
  });

  it('ne propose que les liens autorisés', () => {
    const eleve = navigationForRoles(['eleve']).map((i) => i.to);
    expect(eleve).toContain('/eleve/parents');
    expect(eleve).not.toContain('/administration');
    const admin = navigationForRoles(['administrateur']).map((i) => i.to);
    expect(admin).toContain('/administration');
    expect(admin).not.toContain('/eleve');
  });

  it('hasAnyRole', () => {
    expect(hasAnyRole(['parent'], ['eleve', 'parent'])).toBe(true);
    expect(hasAnyRole([], ['eleve'])).toBe(false);
  });
});
