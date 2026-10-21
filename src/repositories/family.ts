import { getSupabase } from '@/lib/supabase';
import type { FamilyLink, RedeemStatus } from '@/types/domain';

export async function createParentLinkCode(): Promise<{ code: string; expiresAt: Date }> {
  const { data, error } = await getSupabase().rpc('create_parent_link_code');
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { code: string; expires_at: string } | undefined;
  if (!row) throw new Error('Réponse vide du serveur.');
  return { code: row.code, expiresAt: new Date(row.expires_at) };
}

export async function redeemParentLinkCode(code: string): Promise<RedeemStatus> {
  const { data, error } = await getSupabase().rpc('redeem_parent_link_code', { p_code: code });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { status: RedeemStatus } | undefined;
  if (!row) throw new Error('Réponse vide du serveur.');
  return row.status;
}

export async function listFamilyLinks(): Promise<FamilyLink[]> {
  const { data, error } = await getSupabase().rpc('my_family_links');
  if (error) throw error;
  return (data ?? []) as FamilyLink[];
}

export async function revokeFamilyLink(linkId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_parent_link', { p_link_id: linkId });
  if (error) throw error;
}

export const REDEEM_MESSAGES: Record<RedeemStatus, string> = {
  lie: 'Votre compte est maintenant lié à celui de votre enfant.',
  deja_lie: 'Vos comptes étaient déjà liés.',
  code_invalide: 'Ce code est invalide, expiré ou déjà utilisé. Demandez un nouveau code à votre enfant.',
  trop_de_tentatives: 'Trop de codes erronés en peu de temps. Réessayez dans une heure.',
};
