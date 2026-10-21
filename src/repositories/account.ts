import { getSupabase } from '@/lib/supabase';
import { APP_ROLES, type AppRole, type Profile, type StudentRecord } from '@/types/domain';

function isRole(value: unknown): value is AppRole {
  return typeof value === 'string' && (APP_ROLES as readonly string[]).includes(value);
}

export interface AccountSnapshot {
  profile: Profile | null;
  roles: AppRole[];
  student: StudentRecord | null;
}

/** Charge profil, rôles et fiche élève de l'utilisateur connecté (filtrés par la RLS). */
export async function fetchAccount(userId: string): Promise<AccountSnapshot> {
  const sb = getSupabase();
  const [profile, roles, student] = await Promise.all([
    sb.from('profiles').select('id, display_name').eq('id', userId).maybeSingle(),
    sb.from('user_roles').select('role').eq('user_id', userId),
    sb.from('students').select('user_id, grade_level_id, series_id, school_year_id').eq('user_id', userId).maybeSingle(),
  ]);
  if (profile.error) throw profile.error;
  if (roles.error) throw roles.error;
  if (student.error) throw student.error;
  return {
    profile: (profile.data as Profile | null) ?? null,
    roles: (roles.data ?? []).map((r: { role: unknown }) => r.role).filter(isRole),
    student: (student.data as StudentRecord | null) ?? null,
  };
}

export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await getSupabase().from('profiles').update({ display_name: displayName }).eq('id', userId);
  if (error) throw error;
}

export async function updateStudentClass(
  userId: string,
  values: { grade_level_id: string; series_id: string | null; school_year_id: string | null },
): Promise<void> {
  const { data, error } = await getSupabase()
    .from('students')
    .update(values)
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('acces_refuse');
}
