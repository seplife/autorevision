import { getSupabase } from '@/lib/supabase';
import type { AdminUserRow, AppRole, PlatformSettings } from '@/types/domain';

export async function listUsers(search: string, page: number, pageSize = 25): Promise<AdminUserRow[]> {
  const { data, error } = await getSupabase().rpc('admin_list_users', {
    p_search: search.trim() || null,
    p_limit: pageSize,
    p_offset: page * pageSize,
  });
  if (error) throw error;
  return (data ?? []) as AdminUserRow[];
}

export async function grantRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await getSupabase().rpc('admin_grant_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export async function revokeRole(userId: string, role: AppRole): Promise<void> {
  const { error } = await getSupabase().rpc('admin_revoke_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await getSupabase()
    .from('platform_settings')
    .select('platform_name, slogan, mastery_threshold')
    .single();
  if (error) throw error;
  const row = data as { platform_name: string; slogan: string; mastery_threshold: number | string };
  return { ...row, mastery_threshold: Number(row.mastery_threshold) };
}

export async function updatePlatformSettings(values: PlatformSettings): Promise<void> {
  const { data, error } = await getSupabase()
    .from('platform_settings')
    .update(values)
    .eq('id', true)
    .select('platform_name');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('acces_refuse');
}

export interface RoleRequestRow {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  requested_role: AppRole;
  created_at: string;
}

export async function listRoleRequests(): Promise<RoleRequestRow[]> {
  const { data, error } = await getSupabase().rpc('admin_list_role_requests');
  if (error) throw error;
  return (data ?? []) as RoleRequestRow[];
}

export async function decideRoleRequest(requestId: string, approve: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('admin_decide_role_request', {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw error;
}

/** Demande de rôle en attente de l'utilisateur connecté (null s'il n'y en a pas). */
export async function fetchMyPendingRoleRequest(): Promise<AppRole | null> {
  const { data, error } = await getSupabase()
    .from('role_requests')
    .select('requested_role')
    .eq('status', 'en_attente')
    .maybeSingle();
  if (error) throw error;
  return (data as { requested_role: AppRole } | null)?.requested_role ?? null;
}

export async function requestMyRole(role: 'enseignant' | 'responsable_pedagogique'): Promise<void> {
  const { error } = await getSupabase().rpc('request_my_role', { p_role: role });
  if (error) throw error;
}

