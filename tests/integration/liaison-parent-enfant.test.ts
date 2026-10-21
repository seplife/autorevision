import { afterAll, describe, expect, it } from 'vitest';
import { admin, asUser, bootstrapRole, closePool, signUp } from './helpers';

afterAll(closePool);

async function newCode(studentId: string): Promise<string> {
  const res = await asUser(studentId, (c) => c.query('select code, expires_at from public.create_parent_link_code()'));
  return res.rows[0]?.code as string;
}

async function redeem(parentId: string, code: string): Promise<{ status: string; link_id: string | null }> {
  const res = await asUser(parentId, (c) => c.query('select * from public.redeem_parent_link_code($1)', [code]));
  return res.rows[0] as { status: string; link_id: string | null };
}

describe('Code de liaison', () => {
  it('produit un code de 8 caractères lisibles, valable 48 h', async () => {
    const s = await signUp('Élève', 'eleve');
    const res = await asUser(s, (c) =>
      c.query(
        `select code, extract(epoch from expires_at - now()) / 3600 as heures from public.create_parent_link_code()`,
      ),
    );
    expect(res.rows[0]?.code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const hours = Number(res.rows[0]?.heures);
    expect(hours).toBeGreaterThan(47.9);
    expect(hours).toBeLessThanOrEqual(48);
  });

  it('ne stocke que le hachage et le cache aux clients', async () => {
    const s = await signUp('Élève', 'eleve');
    const code = await newCode(s);
    const stored = await admin('select code_hash from public.invitations where student_id = $1', [s]);
    expect(Buffer.from(stored.rows[0]?.code_hash).toString('utf8')).not.toContain(code.replace('-', ''));
    await expect(
      asUser(s, (c) => c.query('select code_hash from public.invitations')),
    ).rejects.toThrow(/permission denied/);
    const visible = await asUser(s, (c) => c.query('select id, expires_at from public.invitations'));
    expect(visible.rowCount).toBe(1);
  });

  it('un nouveau code annule le précédent', async () => {
    const s = await signUp('Élève', 'eleve');
    const p = await signUp('Parent', 'parent');
    const first = await newCode(s);
    await newCode(s);
    expect((await redeem(p, first)).status).toBe('code_invalide');
  });

  it('un parent ne peut pas générer de code, un élève ne peut pas en utiliser', async () => {
    const s = await signUp('Élève', 'eleve');
    const p = await signUp('Parent', 'parent');
    await expect(asUser(p, (c) => c.query('select * from public.create_parent_link_code()'))).rejects.toThrow(
      /acces_refuse/,
    );
    const code = await newCode(s);
    const other = await signUp('Autre élève', 'eleve');
    await expect(
      asUser(other, (c) => c.query('select * from public.redeem_parent_link_code($1)', [code])),
    ).rejects.toThrow(/acces_refuse/);
  });
});

describe('Liaison et accès du parent', () => {
  it('lie le parent, qui voit alors l’enfant ; un autre parent ne voit rien', async () => {
    const s = await signUp('Aya', 'eleve');
    const p = await signUp('Maman Aya', 'parent');
    const stranger = await signUp('Parent étranger', 'parent');

    const code = await newCode(s);
    // Saisie tolérante : minuscules et sans tiret.
    const r = await redeem(p, code.toLowerCase().replace('-', ' '));
    expect(r.status).toBe('lie');

    const links = await asUser(p, (c) => c.query('select relation, other_user_id, other_display_name from public.my_family_links()'));
    expect(links.rows).toEqual([{ relation: 'enfant', other_user_id: s, other_display_name: 'Aya' }]);

    const childProfile = await asUser(p, (c) => c.query('select display_name from public.profiles where id = $1', [s]));
    expect(childProfile.rowCount).toBe(1);
    const childStudent = await asUser(p, (c) => c.query('select user_id from public.students where user_id = $1', [s]));
    expect(childStudent.rowCount).toBe(1);

    const studentSide = await asUser(s, (c) => c.query('select relation, other_user_id from public.my_family_links()'));
    expect(studentSide.rows).toEqual([{ relation: 'parent', other_user_id: p }]);

    // Parent étranger : aucun accès, même en connaissant l'identifiant de l'enfant.
    const leakProfile = await asUser(stranger, (c) => c.query('select 1 from public.profiles where id = $1', [s]));
    const leakStudent = await asUser(stranger, (c) => c.query('select 1 from public.students where user_id = $1', [s]));
    const leakLinks = await asUser(stranger, (c) => c.query('select * from public.my_family_links()'));
    expect([leakProfile.rowCount, leakStudent.rowCount, leakLinks.rowCount]).toEqual([0, 0, 0]);
  });

  it('un code ne sert qu’une fois', async () => {
    const s = await signUp('Élève', 'eleve');
    const p1 = await signUp('Parent 1', 'parent');
    const p2 = await signUp('Parent 2', 'parent');
    const code = await newCode(s);
    expect((await redeem(p1, code)).status).toBe('lie');
    expect((await redeem(p2, code)).status).toBe('code_invalide');
  });

  it('un code expiré est refusé', async () => {
    const s = await signUp('Élève', 'eleve');
    const p = await signUp('Parent', 'parent');
    const code = await newCode(s);
    await admin(
      `update public.invitations set created_at = now() - interval '3 days', expires_at = now() - interval '1 hour' where student_id = $1`,
      [s],
    );
    expect((await redeem(p, code)).status).toBe('code_invalide');
  });

  it('bloque après 5 essais erronés en une heure, même avec un code valide ensuite', async () => {
    const s = await signUp('Élève', 'eleve');
    const p = await signUp('Parent', 'parent');
    for (let i = 0; i < 5; i++) {
      expect((await redeem(p, `ZZZZ-ZZZ${i + 2}`)).status).toBe('code_invalide');
    }
    const code = await newCode(s);
    expect((await redeem(p, code)).status).toBe('trop_de_tentatives');
    const attempts = await admin('select count(*)::int as n from public.invitation_attempts where user_id = $1', [p]);
    expect(attempts.rows[0]?.n).toBe(5);
  });

  it('la révocation coupe immédiatement l’accès ; un tiers ne peut pas révoquer', async () => {
    const s = await signUp('Élève', 'eleve');
    const p = await signUp('Parent', 'parent');
    const intruder = await signUp('Intrus', 'parent');
    const { link_id } = await redeem(p, await newCode(s));

    await expect(
      asUser(intruder, (c) => c.query('select public.revoke_parent_link($1)', [link_id])),
    ).rejects.toThrow(/lien_introuvable/);

    await asUser(s, (c) => c.query('select public.revoke_parent_link($1)', [link_id]));
    const after = await asUser(p, (c) => c.query('select 1 from public.students where user_id = $1', [s]));
    expect(after.rowCount).toBe(0);
    const history = await admin('select status, revoked_by from public.parent_student_links where id = $1', [link_id]);
    expect(history.rows[0]).toEqual({ status: 'revoque', revoked_by: s });
  });

  it('un parent dont le rôle est retiré perd l’accès aux enfants liés', async () => {
    const s = await signUp('Élève', 'eleve');
    const p = await signUp('Parent', 'parent');
    const a = await signUp('Admin', null);
    await bootstrapRole(a, 'administrateur');
    await redeem(p, await newCode(s));
    await asUser(a, (c) => c.query(`select public.admin_revoke_role($1, 'parent')`, [p]));
    const res = await asUser(p, (c) => c.query('select 1 from public.students where user_id = $1', [s]));
    expect(res.rowCount).toBe(0);
  });

  it('aucune écriture directe dans les liens n’est possible', async () => {
    const s = await signUp('Élève', 'eleve');
    const p = await signUp('Parent', 'parent');
    await expect(
      asUser(p, (c) =>
        c.query('insert into public.parent_student_links (parent_id, student_id) values ($1, $2)', [p, s]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
