import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, asAnon, asUser, bootstrapRole, closePool, signUp } from './helpers';

afterAll(closePool);

let grade3e: string;
let gradeTle: string;
let seriesA: string;

beforeAll(async () => {
  const g = await admin(`select id, code from public.grade_levels`);
  grade3e = g.rows.find((r) => r.code === '3E')?.id;
  gradeTle = g.rows.find((r) => r.code === 'TLE')?.id;
  const s = await admin(`select id from public.academic_series where code = 'A' and grade_level_id = $1`, [gradeTle]);
  seriesA = s.rows[0]?.id;
});

describe('Catalogue public', () => {
  it('un visiteur peut lire les classes et séries prioritaires', async () => {
    const res = await asAnon((c) =>
      c.query(`
        select g.code as classe, s.code as serie, g.exam_name
        from public.grade_levels g left join public.academic_series s on s.grade_level_id = g.id
        order by g.position, s.code`),
    );
    expect(res.rows).toEqual([
      { classe: '3E', serie: null, exam_name: 'BEPC' },
      { classe: 'TLE', serie: 'A', exam_name: 'BAC' },
      { classe: 'TLE', serie: 'D', exam_name: 'BAC' },
    ]);
  });

  it('aucune matière n’est inventée par les migrations', async () => {
    const res = await admin('select count(*)::int as n from public.subjects');
    expect(res.rows[0]?.n).toBe(0);
  });

  it('un visiteur ne peut rien écrire dans le référentiel', async () => {
    await expect(
      asAnon((c) => c.query(`insert into public.subjects (code, name) values ('X', 'X')`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('Choix de la classe par l’élève', () => {
  it('accepte une classe et une série cohérentes', async () => {
    const s = await signUp('Élève Tle A', 'eleve');
    const res = await asUser(s, (c) =>
      c.query('update public.students set grade_level_id = $1, series_id = $2 where user_id = $3', [gradeTle, seriesA, s]),
    );
    expect(res.rowCount).toBe(1);
  });

  it('refuse une série qui n’appartient pas à la classe choisie', async () => {
    const s = await signUp('Élève incohérent', 'eleve');
    await expect(
      asUser(s, (c) =>
        c.query('update public.students set grade_level_id = $1, series_id = $2 where user_id = $3', [grade3e, seriesA, s]),
      ),
    ).rejects.toThrow(/students_series_in_grade_fk/);
  });
});

describe('Gestion et validation des programmes', () => {
  it('un élève ne peut pas créer de matière', async () => {
    const s = await signUp('Élève', 'eleve');
    await expect(
      asUser(s, (c) => c.query(`insert into public.subjects (code, name) values ('MATH', 'Mathématiques')`)),
    ).rejects.toThrow(/row-level security/);
  });

  it('un enseignant ne peut pas modifier la structure du référentiel', async () => {
    const t = await signUp('Enseignant', null);
    await bootstrapRole(t, 'enseignant');
    await expect(
      asUser(t, (c) => c.query(`insert into public.subjects (code, name) values ('ENS', 'Essai')`)),
    ).rejects.toThrow(/row-level security/);
  });

  it('un programme ne peut être validé sans référence documentaire ; le validateur est imposé par le serveur', async () => {
    const r = await signUp('Responsable', null);
    await bootstrapRole(r, 'responsable_pedagogique');
    const someoneElse = await signUp('Autre', 'eleve');

    const curriculumId = await asUser(r, async (c) => {
      const subj = await c.query(`insert into public.subjects (code, name) values ('TEST_SVT', 'Matière de test') returning id`);
      const cur = await c.query(
        `insert into public.curricula (grade_level_id, subject_id, title) values ($1, $2, 'Programme de test') returning id, verification_status, created_by`,
        [grade3e, subj.rows[0]?.id],
      );
      expect(cur.rows[0]).toMatchObject({ verification_status: 'a_verifier', created_by: r });
      return cur.rows[0]?.id as string;
    });

    // Validation sans référence : refusée par la contrainte.
    await expect(
      asUser(r, (c) => c.query(`update public.curricula set verification_status = 'valide' where id = $1`, [curriculumId])),
    ).rejects.toThrow(/curricula_valide_documente/);

    // Avec référence, en essayant d'usurper le validateur : le serveur impose auth.uid().
    await asUser(r, (c) =>
      c.query(
        `update public.curricula
           set verification_status = 'valide', issuing_body = 'Organisme de test',
               document_reference = 'REF-TEST-001', verified_by = $2, verified_at = '2000-01-01'
         where id = $1`,
        [curriculumId, someoneElse],
      ),
    );
    const row = await admin('select verified_by, verified_at > now() - interval \'1 minute\' as recent from public.curricula where id = $1', [curriculumId]);
    expect(row.rows[0]).toEqual({ verified_by: r, recent: true });

    const audit = await admin(`select details from public.audit_logs where action = 'programme.statut' and target_id = $1`, [curriculumId]);
    expect(audit.rows[0]?.details).toEqual({ de: 'a_verifier', vers: 'valide' });

    // Retour à « à vérifier » : la validation est effacée.
    await asUser(r, (c) => c.query(`update public.curricula set verification_status = 'a_verifier' where id = $1`, [curriculumId]));
    const reset = await admin('select verified_by, verified_at from public.curricula where id = $1', [curriculumId]);
    expect(reset.rows[0]).toEqual({ verified_by: null, verified_at: null });
  });
});

describe('Paramètres de la plateforme', () => {
  it('seul un administrateur modifie le nom et le seuil ; les bornes sont contrôlées', async () => {
    const s = await signUp('Élève', 'eleve');
    const a = await signUp('Admin', null);
    await bootstrapRole(a, 'administrateur');

    const denied = await asUser(s, (c) => c.query(`update public.platform_settings set platform_name = 'Piraté'`));
    expect(denied.rowCount).toBe(0);

    await asUser(a, (c) => c.query(`update public.platform_settings set platform_name = 'Réussite CI', mastery_threshold = 75`));
    const row = await asAnon((c) => c.query('select platform_name, mastery_threshold from public.platform_settings'));
    expect(row.rows[0]).toEqual({ platform_name: 'Réussite CI', mastery_threshold: '75.00' });

    await expect(
      asUser(a, (c) => c.query(`update public.platform_settings set mastery_threshold = 30`)),
    ).rejects.toThrow(/check constraint/);
    await admin(`update public.platform_settings set platform_name = 'Réussite Scolaire CI', mastery_threshold = 80`);
  });
});

describe('Contrôles transverses de sécurité', () => {
  it('la RLS est activée sur toutes les tables du schéma public', async () => {
    const res = await admin(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(res.rows).toEqual([]);
  });

  it('aucune fonction du schéma public n’est exécutable par un visiteur anonyme', async () => {
    const res = await admin(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
      order by 1`);
    expect(res.rows).toEqual([]);
  });

  it('les fonctions SECURITY DEFINER fixent toutes leur search_path', async () => {
    const res = await admin(`
      select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')`);
    expect(res.rows).toEqual([]);
  });
});
