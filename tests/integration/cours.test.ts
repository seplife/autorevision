import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, asUser, bootstrapRole, closePool, signUp } from './helpers';

afterAll(closePool);

let chapterId: string;
let curriculumId: string;
let teacher: string;
let reviewer: string;
let student: string;

beforeAll(async () => {
  const g = await admin(`select id from public.grade_levels where code = '3E'`);
  const subj = await admin(`insert into public.subjects (code, name) values ('COURS_T', 'Matière cours') returning id`);
  const cur = await admin(
    `insert into public.curricula (grade_level_id, subject_id, title) values ($1, $2, 'Programme cours') returning id`,
    [g.rows[0]?.id, subj.rows[0]?.id],
  );
  curriculumId = cur.rows[0]?.id;
  const ch = await admin(`insert into public.chapters (curriculum_id, title) values ($1, 'Chapitre 1') returning id`, [curriculumId]);
  chapterId = ch.rows[0]?.id;

  teacher = await signUp('Enseignant cours', null);
  await bootstrapRole(teacher, 'enseignant');
  reviewer = await signUp('Responsable cours', null);
  await bootstrapRole(reviewer, 'responsable_pedagogique');
  student = await signUp('Élève cours', 'eleve');
});

const save = (user: string, id: string | null, title = 'Cours test', body = 'Contenu') =>
  asUser(user, (c) => c.query(`select public.course_save($1, $2, $3, $4) as id`, [id, chapterId, title, body]));
const move = (user: string, id: string, to: string, comment: string | null = null) =>
  asUser(user, (c) => c.query(`select public.course_transition($1, $2::public.content_status, $3)`, [id, to, comment]));

describe('Circuit de publication des cours', () => {
  it('un élève ne peut pas créer de cours ni écrire directement', async () => {
    await expect(save(student, null)).rejects.toThrow(/acces_refuse/);
    await expect(
      asUser(student, (c) => c.query(`insert into public.courses (chapter_id, title, author_id) values ($1, 'x', $2)`, [chapterId, student])),
    ).rejects.toThrow(/permission denied/);
  });

  it('parcours complet : rédaction, soumission, validation, publication figée', async () => {
    const id = (await save(teacher, null)).rows[0]?.id as string;
    await save(teacher, id, 'Cours test', 'Contenu v1');

    // L'élève ne voit rien tant que le cours n'est pas publié.
    const before = await asUser(student, (c) => c.query(`select id from public.courses where id = $1`, [id]));
    expect(before.rowCount).toBe(0);

    await move(teacher, id, 'soumis');
    // L'auteur ne peut pas valider son propre cours ; un enseignant non plus.
    await expect(move(teacher, id, 'valide')).rejects.toThrow(/transition_interdite/);
    await move(reviewer, id, 'valide');

    // Programme non validé : publication refusée.
    await expect(move(reviewer, id, 'publie')).rejects.toThrow(/programme_non_valide/);
    await admin(
      `update public.curricula set verification_status = 'valide', issuing_body = 'Organisme test', document_reference = 'REF-C-1' where id = $1`,
      [curriculumId],
    );
    await move(reviewer, id, 'publie');

    const seen = await asUser(student, (c) =>
      c.query(`select v.title, v.body, v.version_number from public.course_versions v join public.courses c on c.id = v.course_id where c.id = $1`, [id]),
    );
    expect(seen.rows).toEqual([{ title: 'Cours test', body: 'Contenu v1', version_number: 1 }]);

    // Le cours publié n'est plus modifiable ; les versions sont immuables.
    await expect(save(teacher, id, 'Piraté', 'x')).rejects.toThrow(/cours_non_modifiable/);
    await expect(admin(`update public.course_versions set body = 'x' where course_id = $1`, [id])).rejects.toThrow(/version_immuable/);

    // Archivage puis nouvelle version.
    await move(reviewer, id, 'archive');
    expect((await asUser(student, (c) => c.query(`select id from public.courses where id = $1`, [id]))).rowCount).toBe(0);
    await move(reviewer, id, 'brouillon');
    await save(teacher, id, 'Cours test', 'Contenu v2');
    await move(teacher, id, 'soumis');
    await move(reviewer, id, 'valide');
    await move(reviewer, id, 'publie');
    const versions = await admin(`select version_number from public.course_versions where course_id = $1 order by 1`, [id]);
    expect(versions.rows.map((r) => r.version_number)).toEqual([1, 2]);

    const audit = await admin(`select count(*)::int as n from public.audit_logs where action = 'cours.statut' and target_id = $1`, [id]);
    expect(audit.rows[0]?.n).toBeGreaterThanOrEqual(8);
  });

  it('refuse la soumission d’un cours vide et exige un commentaire pour les corrections', async () => {
    const id = (await save(teacher, null, 'Vide', '')).rows[0]?.id as string;
    await expect(move(teacher, id, 'soumis')).rejects.toThrow(/contenu_requis/);
    await save(teacher, id, 'Vide', 'Un peu de contenu');
    await move(teacher, id, 'soumis');
    await expect(move(reviewer, id, 'a_corriger', ' ')).rejects.toThrow(/commentaire_requis/);
    await move(reviewer, id, 'a_corriger', 'Précisez la définition.');
    const row = await asUser(teacher, (c) => c.query(`select status, review_comment from public.courses where id = $1`, [id]));
    expect(row.rows[0]).toEqual({ status: 'a_corriger', review_comment: 'Précisez la définition.' });
  });

  it('un enseignant ne voit pas les brouillons des autres', async () => {
    const other = await signUp('Autre enseignant', null);
    await bootstrapRole(other, 'enseignant');
    const id = (await save(teacher, null, 'Privé', 'x')).rows[0]?.id as string;
    expect((await asUser(other, (c) => c.query(`select id from public.courses where id = $1`, [id]))).rowCount).toBe(0);
    await expect(save(other, id, 'Vol', 'x')).rejects.toThrow(/acces_refuse/);
  });
});
