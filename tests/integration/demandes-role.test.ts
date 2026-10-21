import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, bootstrapRole, closePool, signUp } from './helpers';

afterAll(closePool);

describe('Demandes de rôle à l’inscription', () => {
  it('une inscription « enseignant » ne donne aucun rôle, seulement une demande', async () => {
    const t = await signUp('Demandeur', 'enseignant');
    const roles = await admin('select role from public.user_roles where user_id = $1', [t]);
    expect(roles.rows).toEqual([]);
    const req = await admin('select requested_role, status from public.role_requests where user_id = $1', [t]);
    expect(req.rows).toEqual([{ requested_role: 'enseignant', status: 'en_attente' }]);
  });

  it('« administrateur » ne peut jamais être demandé à l’inscription', async () => {
    const a = await signUp('Pirate', 'administrateur');
    expect((await admin('select 1 from public.user_roles where user_id = $1', [a])).rowCount).toBe(0);
    expect((await admin('select 1 from public.role_requests where user_id = $1', [a])).rowCount).toBe(0);
  });

  it('un utilisateur ne peut ni créer ni approuver une demande ; un administrateur le peut', async () => {
    const t = await signUp('Candidat', 'responsable_pedagogique');
    const other = await signUp('Autre', 'eleve');
    const requestId = (await admin('select id from public.role_requests where user_id = $1', [t])).rows[0]?.id as string;

    await expect(
      asUser(t, (c) => c.query(`insert into public.role_requests (user_id, requested_role) values ($1, 'enseignant')`, [t])),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(t, (c) => c.query('select public.admin_decide_role_request($1, true)', [requestId]))).rejects.toThrow(/acces_refuse/);
    // Un tiers ne voit pas la demande d'autrui.
    expect((await asUser(other, (c) => c.query('select id from public.role_requests where id = $1', [requestId]))).rowCount).toBe(0);

    const adm = await signUp('Admin demandes', null);
    await bootstrapRole(adm, 'administrateur');
    await asUser(adm, (c) => c.query('select public.admin_decide_role_request($1, true)', [requestId]));
    const roles = await admin('select role from public.user_roles where user_id = $1', [t]);
    expect(roles.rows).toEqual([{ role: 'responsable_pedagogique' }]);
    const done = await admin('select status, decided_by from public.role_requests where id = $1', [requestId]);
    expect(done.rows[0]).toEqual({ status: 'approuvee', decided_by: adm });

    // Une demande déjà traitée ne peut plus l'être.
    await expect(asUser(adm, (c) => c.query('select public.admin_decide_role_request($1, false)', [requestId]))).rejects.toThrow(/demande_introuvable/);
  });

  it('un refus n’accorde aucun rôle', async () => {
    const t = await signUp('Refusé', 'enseignant');
    const requestId = (await admin('select id from public.role_requests where user_id = $1', [t])).rows[0]?.id as string;
    const adm = await signUp('Admin refus', null);
    await bootstrapRole(adm, 'administrateur');
    await asUser(adm, (c) => c.query('select public.admin_decide_role_request($1, false)', [requestId]));
    expect((await admin('select 1 from public.user_roles where user_id = $1', [t])).rowCount).toBe(0);
    expect((await admin('select status from public.role_requests where id = $1', [requestId])).rows[0]?.status).toBe('refusee');
  });
});
