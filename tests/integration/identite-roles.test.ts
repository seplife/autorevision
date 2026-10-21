import { afterAll, describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, bootstrapRole, closePool, signUp } from './helpers';

afterAll(closePool);

describe('Inscription et création du profil', () => {
  it('crée profil, rôle « eleve » et fiche élève pour une inscription élève', async () => {
    const id = await signUp('Awa Konan', 'eleve');
    const roles = await admin('select role from public.user_roles where user_id = $1', [id]);
    expect(roles.rows.map((r) => r.role)).toEqual(['eleve']);
    const s = await admin('select 1 from public.students where user_id = $1', [id]);
    expect(s.rowCount).toBe(1);
    const p = await admin('select display_name from public.profiles where id = $1', [id]);
    expect(p.rows[0]?.display_name).toBe('Awa Konan');
  });

  it('crée le rôle « parent » et la fiche parent pour une inscription parent', async () => {
    const id = await signUp('Koffi Yao', 'parent');
    const roles = await admin('select role from public.user_roles where user_id = $1', [id]);
    expect(roles.rows.map((r) => r.role)).toEqual(['parent']);
  });

  it('ignore une demande de rôle privilégié dans les métadonnées d’inscription', async () => {
    const id = await signUp('Pirate', 'administrateur');
    const roles = await admin('select role from public.user_roles where user_id = $1', [id]);
    expect(roles.rowCount).toBe(0);
  });
});

describe('Protection des rôles', () => {
  it('interdit à un utilisateur de s’ajouter un rôle par insertion directe', async () => {
    const id = await signUp('Élève Malin', 'eleve');
    await expect(
      asUser(id, (c) =>
        c.query(`insert into public.user_roles (user_id, role) values ($1, 'administrateur')`, [id]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('refuse admin_grant_role à un non-administrateur', async () => {
    const id = await signUp('Élève', 'eleve');
    const other = await signUp('Autre', 'eleve');
    await expect(
      asUser(id, (c) => c.query(`select public.admin_grant_role($1, 'enseignant')`, [other])),
    ).rejects.toThrow(/acces_refuse/);
  });

  it('interdit à un administrateur de modifier ses propres rôles', async () => {
    const a = await signUp('Admin', null);
    await bootstrapRole(a, 'administrateur');
    await expect(
      asUser(a, (c) => c.query(`select public.admin_grant_role($1, 'enseignant')`, [a])),
    ).rejects.toThrow(/auto_modification_interdite/);
    await expect(
      asUser(a, (c) => c.query(`select public.admin_revoke_role($1, 'administrateur')`, [a])),
    ).rejects.toThrow(/auto_modification_interdite/);
  });

  it('permet à un administrateur d’attribuer un rôle à autrui, avec journal d’audit', async () => {
    const a = await signUp('Admin2', null);
    await bootstrapRole(a, 'administrateur');
    const t = await signUp('Professeur', null);
    await asUser(a, (c) => c.query(`select public.admin_grant_role($1, 'enseignant')`, [t]));

    const roles = await admin('select role, granted_by from public.user_roles where user_id = $1', [t]);
    expect(roles.rows).toEqual([{ role: 'enseignant', granted_by: a }]);
    const teacher = await admin('select 1 from public.teachers where user_id = $1', [t]);
    expect(teacher.rowCount).toBe(1);
    const audit = await admin(
      `select actor_id, details from public.audit_logs where action = 'role.attribue' and target_id = $1`,
      [t],
    );
    expect(audit.rows[0]).toMatchObject({ actor_id: a, details: { role: 'enseignant' } });

    // Retrait : le rôle disparaît, la fiche enseignant est conservée.
    await asUser(a, (c) => c.query(`select public.admin_revoke_role($1, 'enseignant')`, [t]));
    const after = await admin('select 1 from public.user_roles where user_id = $1', [t]);
    expect(after.rowCount).toBe(0);
  });

  it('admin_list_users (qui expose les e-mails) est réservé aux administrateurs', async () => {
    const e = await signUp('Curieux', 'eleve');
    await expect(asUser(e, (c) => c.query('select * from public.admin_list_users()'))).rejects.toThrow(
      /acces_refuse/,
    );
    const a = await signUp('Admin3', null);
    await bootstrapRole(a, 'administrateur');
    const res = await asUser(a, (c) =>
      c.query('select id, email, roles from public.admin_list_users($1)', ['Curieux']),
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({ id: e, email: `${e}@test.ci` });
  });

  it('un élève ne lit que ses propres rôles', async () => {
    const a = await signUp('A', 'eleve');
    await signUp('B', 'parent');
    const res = await asUser(a, (c) => c.query('select user_id from public.user_roles'));
    expect(res.rows.map((r) => r.user_id)).toEqual([a]);
  });
});

describe('Confidentialité des profils et fiches élèves', () => {
  it('un élève ne voit ni le profil ni la fiche d’un autre élève', async () => {
    const a = await signUp('Élève A', 'eleve');
    const b = await signUp('Élève B', 'eleve');
    const profiles = await asUser(a, (c) => c.query('select id from public.profiles where id = $1', [b]));
    expect(profiles.rowCount).toBe(0);
    const students = await asUser(a, (c) => c.query('select user_id from public.students'));
    expect(students.rows.map((r) => r.user_id)).toEqual([a]);
  });

  it('un visiteur non connecté ne peut pas lire les profils', async () => {
    await expect(asAnon((c) => c.query('select * from public.profiles'))).rejects.toThrow(
      /permission denied/,
    );
    await expect(asAnon((c) => c.query('select * from public.students'))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('un élève ne peut pas modifier la fiche d’un autre élève', async () => {
    const a = await signUp('Élève C', 'eleve');
    const b = await signUp('Élève D', 'eleve');
    const grade = await admin(`select id from public.grade_levels where code = '3E'`);
    const res = await asUser(a, (c) =>
      c.query('update public.students set grade_level_id = $1 where user_id = $2', [grade.rows[0]?.id, b]),
    );
    expect(res.rowCount).toBe(0);
  });

  it('un utilisateur ne peut modifier que son nom affiché, pas les autres colonnes', async () => {
    const a = await signUp('Nom Initial', 'eleve');
    await asUser(a, (c) => c.query(`update public.profiles set display_name = 'Nouveau Nom' where id = $1`, [a]));
    const p = await admin('select display_name from public.profiles where id = $1', [a]);
    expect(p.rows[0]?.display_name).toBe('Nouveau Nom');
    await expect(
      asUser(a, (c) => c.query(`update public.profiles set created_at = now() - interval '1 year' where id = $1`, [a])),
    ).rejects.toThrow(/permission denied/);
  });
});
