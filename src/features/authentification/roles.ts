import type { AppRole } from '@/types/domain';

export interface NavItem {
  to: string;
  label: string;
}

/** Page d'accueil après connexion, selon les rôles (priorité au rôle le plus privilégié). */
export function homePathForRoles(roles: readonly AppRole[]): string {
  if (roles.includes('administrateur')) return '/administration';
  if (roles.includes('responsable_pedagogique') || roles.includes('enseignant')) return '/enseignant';
  if (roles.includes('parent')) return '/parent';
  if (roles.includes('eleve')) return '/eleve';
  return '/compte-en-attente';
}

export function hasAnyRole(roles: readonly AppRole[], allowed: readonly AppRole[]): boolean {
  return allowed.some((r) => roles.includes(r));
}

/** Navigation principale : uniquement des liens vers des écrans réellement implémentés. */
export function navigationForRoles(roles: readonly AppRole[]): NavItem[] {
  const items: NavItem[] = [];
  if (roles.includes('eleve')) {
    items.push(
      { to: '/eleve', label: 'Mon espace' },
      { to: '/eleve/classe', label: 'Ma classe' },
      { to: '/eleve/cours', label: 'Mes cours' },
      { to: '/eleve/parents', label: 'Mes parents' },
    );
  }
  if (roles.includes('parent')) {
    items.push({ to: '/parent', label: 'Mes enfants' });
  }
  if (hasAnyRole(roles, ['enseignant', 'responsable_pedagogique'])) {
    items.push({ to: '/enseignant', label: 'Espace pédagogique' }, { to: '/enseignant/cours', label: 'Cours' });
  }
  if (roles.includes('administrateur')) {
    items.push(
      { to: '/administration', label: 'Utilisateurs et rôles' },
      { to: '/administration/parametres', label: 'Plateforme' },
    );
    // Éviter les doublons si l'administrateur est aussi enseignant ou responsable.
    if (!hasAnyRole(roles, ['enseignant', 'responsable_pedagogique'])) {
      items.push({ to: '/enseignant', label: 'Espace pédagogique' }, { to: '/enseignant/cours', label: 'Cours' });
    }
  }
  items.push({ to: '/parametres', label: 'Paramètres et aide' });
  return items;
}
