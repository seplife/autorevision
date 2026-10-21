import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { useAuth } from '@/features/authentification/AuthProvider';
import { messageErreur } from '@/lib/errors';
import { courseAttachmentUrl, fetchPublishedCourses } from '@/repositories/cours';

/** Cours publiés pour la classe de l'élève (versions figées, texte brut et support PDF éventuel). */
export default function MesCours() {
  const { account } = useAuth();
  const student = account?.student;
  const courses = useQuery({ queryKey: ['published-courses'], queryFn: fetchPublishedCourses });
  const [openId, setOpenId] = useState<string | null>(null);

  const mine = (courses.data ?? []).filter((v) => {
    const cur = v.course.chapters?.curricula;
    if (!cur || !student?.grade_level_id) return false;
    return cur.grade_level_id === student.grade_level_id && (cur.series_id === null || cur.series_id === student.series_id);
  });
  const opened = mine.find((v) => v.id === openId);
  const openedPdfUrl = courseAttachmentUrl(opened?.attachment_path);

  return (
    <div className="space-y-4">
      <PageHeader title="Mes cours" description="Les cours publiés pour ta classe." />
      {!student?.grade_level_id && <Alert tone="warning">Choisis d’abord ta classe pour voir tes cours.</Alert>}
      {courses.error && <Alert tone="error">{messageErreur(courses.error)}</Alert>}
      {courses.isLoading && <p>Chargement…</p>}
      {student?.grade_level_id && courses.data && mine.length === 0 && (
        <Alert tone="info">Aucun cours n’est encore publié pour ta classe.</Alert>
      )}
      {opened ? (
        <Card title={opened.title}>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            {[opened.course.chapters?.curricula?.subjects?.name, opened.course.chapters?.title].filter(Boolean).join(' · ')}
          </p>
          {openedPdfUrl && (
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-marine-700 dark:bg-marine-800">
              <a
                href={openedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-marine-800 underline dark:text-ciel-300"
              >
                Télécharger / Ouvrir le support PDF ({opened.attachment_name ?? 'Document PDF'})
              </a>
            </div>
          )}
          {opened.body && <div className="whitespace-pre-wrap">{opened.body}</div>}
          <Button className="mt-4" variant="secondary" onClick={() => setOpenId(null)}>
            Retour à la liste
          </Button>
        </Card>
      ) : (
        <ul className="space-y-3">
          {mine.map((v) => (
            <li key={v.id}>
              <Card>
                <button type="button" className="text-left text-lg font-semibold underline" onClick={() => setOpenId(v.id)}>
                  {v.title}
                </button>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {[v.course.chapters?.curricula?.subjects?.name, v.course.chapters?.title].filter(Boolean).join(' · ')}
                  {v.attachment_name ? ` · PDF : ${v.attachment_name}` : ''}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
