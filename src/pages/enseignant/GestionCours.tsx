import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '@/components/Alert';
import { Button } from '@/components/Button';
import { Card, PageHeader } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SelectField, TextField } from '@/components/Field';
import { LoadingScreen } from '@/components/Loading';
import { useAuth } from '@/features/authentification/AuthProvider';
import { messageErreur } from '@/lib/errors';
import {
  courseAttachmentUrl,
  deleteCourse,
  fetchChapterOptions,
  fetchCourse,
  fetchCourses,
  saveCourse,
  transitionCourse,
  uploadCoursePdf,
} from '@/repositories/cours';
import { CONTENT_STATUS_LABELS, type ContentStatus, type Course } from '@/types/domain';

const EDITABLE: ContentStatus[] = ['brouillon', 'en_redaction', 'a_corriger'];

function canDeleteCourse(c: Course, myId: string | undefined, isStaff: boolean): boolean {
  if (c.status === 'publie') return false;
  return isStaff || (c.author_id === myId && EDITABLE.includes(c.status));
}

function StatusBadge({ status }: { status: ContentStatus }) {
  const tone =
    status === 'publie'
      ? 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100'
      : status === 'a_corriger'
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
        : 'bg-slate-100 text-slate-800 dark:bg-marine-800 dark:text-slate-100';
  return <span className={`rounded-full px-2 py-0.5 text-sm font-medium ${tone}`}>{CONTENT_STATUS_LABELS[status]}</span>;
}

function chapterLabel(c: Course): string {
  const cur = c.chapters?.curricula;
  return [cur?.subjects?.name, cur?.grade_levels?.label, c.chapters?.title].filter(Boolean).join(' · ');
}

/** Liste des cours : les siens (enseignant) ou tous (responsable / administrateur). */
export function ListeCours() {
  const courses = useQuery({ queryKey: ['courses'], queryFn: fetchCourses });
  const qc = useQueryClient();
  const { account, roles } = useAuth();
  const myId = account?.profile?.id;
  const isStaff = roles.includes('responsable_pedagogique') || roles.includes('administrateur');
  const [toPublish, setToPublish] = useState<Course | null>(null);
  const [toDelete, setToDelete] = useState<Course | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const publish = useMutation({
    mutationFn: (id: string) => transitionCourse(id, 'publie'),
    onSuccess: async () => {
      setToPublish(null);
      setNotice('Cours publié : il est maintenant visible par les élèves.');
      await qc.invalidateQueries({ queryKey: ['courses'] });
      await qc.invalidateQueries({ queryKey: ['published-courses'] });
    },
    onError: () => setToPublish(null),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCourse(id),
    onSuccess: async () => {
      setToDelete(null);
      setNotice('Cours supprimé.');
      await qc.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: () => setToDelete(null),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Cours" description="Rédaction, vérification et publication des cours." />
      <Link
        to="/enseignant/cours/nouveau"
        className="inline-flex min-h-11 items-center rounded-lg bg-marine-900 px-4 py-2 font-semibold text-white dark:bg-ciel-400 dark:text-marine-950"
      >
        Nouveau cours
      </Link>
      {notice && <Alert tone="success">{notice}</Alert>}
      {publish.error && <Alert tone="error">{messageErreur(publish.error)}</Alert>}
      {remove.error && <Alert tone="error">{messageErreur(remove.error)}</Alert>}
      {courses.isLoading && <p>Chargement…</p>}
      {courses.error && <Alert tone="error">{messageErreur(courses.error)}</Alert>}
      {courses.data?.length === 0 && (
        <Alert tone="info">Aucun cours pour le moment. Créez-en un pour commencer.</Alert>
      )}
      <ul className="space-y-3">
        {courses.data?.map((c) => (
          <li key={c.id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link to={`/enseignant/cours/${c.id}`} className="text-lg font-semibold underline">
                    {c.title}
                  </Link>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {chapterLabel(c)}
                    {c.attachment_name ? ` · PDF : ${c.attachment_name}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={c.status} />
                  {isStaff && c.status === 'valide' && (
                    <Button
                      variant="success"
                      onClick={() => {
                        setNotice(null);
                        setToPublish(c);
                      }}
                    >
                      Publier
                    </Button>
                  )}
                  {canDeleteCourse(c, myId, isStaff) && (
                    <Button
                      variant="danger"
                      onClick={() => {
                        setNotice(null);
                        setToDelete(c);
                      }}
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={toPublish !== null}
        title="Publier le cours"
        message={`« ${toPublish?.title ?? ''} » deviendra visible par les élèves. Une version figée sera enregistrée.`}
        confirmLabel="Publier"
        loading={publish.isPending}
        onCancel={() => setToPublish(null)}
        onConfirm={() => toPublish && publish.mutate(toPublish.id)}
      />
      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer ce cours ?"
        message={`Le cours « ${toDelete?.title ?? ''} » sera définitivement supprimé. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        loading={remove.isPending}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

type Pending = { to: ContentStatus; title: string; message: string; label: string; needsComment?: boolean };

interface CourseDraft {
  chapterId: string;
  title: string;
  body: string;
  attachmentPath: string | null;
  attachmentName: string | null;
}

/** Création / édition d'un cours et actions du circuit de publication. */
export function EditeurCours() {
  const { id } = useParams();
  const isNew = !id || id === 'nouveau';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { account, roles } = useAuth();
  const myId = account?.profile?.id;
  const isStaff = roles.includes('responsable_pedagogique') || roles.includes('administrateur');

  const course = useQuery({ queryKey: ['course', id], queryFn: () => fetchCourse(id as string), enabled: !isNew });
  const chapters = useQuery({ queryKey: ['chapter-options'], queryFn: fetchChapterOptions });

  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [comment, setComment] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const c = course.data;
  const form: CourseDraft = draft ?? {
    chapterId: c?.chapter_id ?? '',
    title: c?.title ?? '',
    body: c?.body ?? '',
    attachmentPath: c?.attachment_path ?? null,
    attachmentName: c?.attachment_name ?? null,
  };
  const isAuthor = isNew || c?.author_id === myId;
  const editable = isNew || (isAuthor && c !== undefined && c !== null && EDITABLE.includes(c.status));
  const deletable = !isNew && c !== undefined && c !== null && canDeleteCourse(c, myId, isStaff);

  const refresh = () => qc.invalidateQueries({ queryKey: ['courses'] }).then(() => qc.invalidateQueries({ queryKey: ['course', id] }));

  const save = useMutation({
    mutationFn: () =>
      saveCourse({
        id: isNew ? null : (id as string),
        chapterId: form.chapterId,
        title: form.title,
        body: form.body,
        attachmentPath: form.attachmentPath,
        attachmentName: form.attachmentName,
      }),
    onSuccess: async (savedId) => {
      setDraft(null);
      setNotice('Cours enregistré.');
      await refresh();
      if (isNew) navigate(`/enseignant/cours/${savedId}`, { replace: true });
    },
  });

  const uploadPdf = useMutation({
    mutationFn: (file: File) => uploadCoursePdf(file),
    onSuccess: ({ path, name }) => {
      setFileError(null);
      const suggestedTitle = form.title.trim() === '' ? name.replace(/\.pdf$/i, '') : form.title;
      setDraft({ ...form, title: suggestedTitle, attachmentPath: path, attachmentName: name });
      setNotice(`Document « ${name} » téléversé. Cliquez sur « Enregistrer » pour valider.`);
    },
  });

  const transition = useMutation({
    mutationFn: (p: Pending) => transitionCourse(id as string, p.to, p.needsComment ? comment : undefined),
    onSuccess: async () => {
      setPending(null);
      setComment('');
      setNotice('Statut mis à jour.');
      await refresh();
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteCourse(id as string),
    onSuccess: async () => {
      setConfirmDelete(false);
      await qc.invalidateQueries({ queryKey: ['courses'] });
      navigate('/enseignant/cours', { replace: true });
    },
    onError: () => setConfirmDelete(false),
  });

  const handleImportTextFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError(null);
    if (file.size > 1_000_000) {
      setFileError('Le fichier texte est trop volumineux (maximum 1 Mo).');
      return;
    }
    try {
      const text = await file.text();
      const suggestedTitle = form.title.trim() === '' ? file.name.replace(/\.(txt|md)$/i, '') : form.title;
      setDraft({ ...form, title: suggestedTitle, body: text.slice(0, 100000) });
      setNotice(`Texte importé depuis « ${file.name} ». Vérifiez le contenu puis cliquez sur « Enregistrer ».`);
    } catch {
      setFileError('Impossible de lire ce fichier texte.');
    }
  };

  const handleUploadPdfFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileError(null);
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Seuls les fichiers au format PDF sont acceptés.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setFileError('Le fichier PDF dépasse la taille maximale autorisée (15 Mo).');
      return;
    }
    uploadPdf.mutate(file);
  };

  if (!isNew && course.isLoading) return <LoadingScreen />;
  if (!isNew && !c) return <Alert tone="error">Ce cours est introuvable ou vous n’y avez pas accès.</Alert>;

  const actions: Pending[] = [];
  if (c && !isNew) {
    if (isAuthor && EDITABLE.includes(c.status))
      actions.push({ to: 'soumis', title: 'Soumettre à vérification', message: 'Le cours ne sera plus modifiable tant qu’il n’aura pas été examiné.', label: 'Soumettre' });
    if (isStaff && !isAuthor && c.status === 'soumis') {
      actions.push({ to: 'valide', title: 'Valider le cours', message: 'Confirmez que le contenu est exact et conforme au programme.', label: 'Valider' });
      actions.push({ to: 'a_corriger', title: 'Demander des corrections', message: 'Indiquez à l’auteur ce qui doit être corrigé.', label: 'Demander des corrections', needsComment: true });
    }
    if (isStaff && c.status === 'valide')
      actions.push({ to: 'publie', title: 'Publier le cours', message: 'Le cours deviendra visible par les élèves. Une version figée sera enregistrée.', label: 'Publier' });
    if (isStaff && c.status === 'publie')
      actions.push({ to: 'archive', title: 'Archiver le cours', message: 'Le cours ne sera plus visible par les élèves.', label: 'Archiver' });
    if (isStaff && c.status === 'archive')
      actions.push({ to: 'brouillon', title: 'Rouvrir en brouillon', message: 'Le cours repassera en brouillon pour préparer une nouvelle version.', label: 'Rouvrir' });
  }

  const error = save.error ?? transition.error ?? remove.error ?? uploadPdf.error;
  const cannotSubmit = !form.chapterId || form.title.trim() === '';
  const attachmentUrl = courseAttachmentUrl(form.attachmentPath);

  return (
    <div className="space-y-4">
      <PageHeader title={isNew ? 'Nouveau cours' : 'Cours'} description={c ? <StatusBadge status={c.status} /> : undefined} />
      <Link to="/enseignant/cours" className="underline">
        ← Retour aux cours
      </Link>
      {notice && <Alert tone="success">{notice}</Alert>}
      {fileError && <Alert tone="error">{fileError}</Alert>}
      {error && <Alert tone="error">{messageErreur(error)}</Alert>}
      {c?.status === 'a_corriger' && c.review_comment && (
        <Alert tone="warning" title="Corrections demandées">
          {c.review_comment}
        </Alert>
      )}
      {chapters.data?.length === 0 && (
        <Alert tone="warning" title="Aucun chapitre disponible">
          Un cours est rattaché à un chapitre d’un programme. Aucun chapitre n’a encore été saisi dans le référentiel.
        </Alert>
      )}
      {c && c.chapters?.curricula?.verification_status !== 'valide' && (
        <Alert tone="info">
          Le programme de ce chapitre n’est pas encore « Validé pédagogiquement » : le cours ne pourra pas être publié tant
          qu’il ne l’est pas.
        </Alert>
      )}

      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(null);
            save.mutate();
          }}
        >
          <SelectField
            label="Chapitre"
            value={form.chapterId}
            disabled={!editable}
            onChange={(e) => setDraft({ ...form, chapterId: e.target.value })}
            required
          >
            <option value="">— Choisir un chapitre —</option>
            {chapters.data?.map((ch) => {
              const grade = [ch.curricula?.grade_levels?.label, ch.curricula?.academic_series?.code].filter(Boolean).join(' ');
              return (
                <option key={ch.id} value={ch.id}>
                  {[ch.curricula?.subjects?.name, grade, ch.parent?.title, ch.title].filter(Boolean).join(' · ')}
                </option>
              );
            })}
          </SelectField>
          <TextField
            label="Titre"
            value={form.title}
            disabled={!editable}
            maxLength={200}
            onChange={(e) => setDraft({ ...form, title: e.target.value })}
            required
          />

          {editable && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-marine-700 dark:bg-marine-950/50">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Téléverser un cours ou une leçon depuis votre ordinateur
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Importez un fichier texte (<code>.txt</code>, <code>.md</code>) pour remplir automatiquement le contenu, ou
                joignez un support de cours au format <code>.pdf</code> (15 Mo max.) téléchargeable par les élèves.
              </p>
              <input
                ref={textInputRef}
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={handleImportTextFile}
              />
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleUploadPdfFile}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => textInputRef.current?.click()}>
                  Importer un fichier texte (.txt, .md)
                </Button>
                <Button variant="secondary" loading={uploadPdf.isPending} onClick={() => pdfInputRef.current?.click()}>
                  Téléverser un support PDF
                </Button>
              </div>
            </div>
          )}

          {form.attachmentPath && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-marine-700 dark:bg-marine-800">
              <div>
                <span className="font-semibold">Document PDF joint : </span>
                {attachmentUrl ? (
                  <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {form.attachmentName ?? 'Ouvrir le PDF'}
                  </a>
                ) : (
                  <span>{form.attachmentName ?? form.attachmentPath}</span>
                )}
              </div>
              {editable && (
                <Button
                  variant="ghost"
                  onClick={() => setDraft({ ...form, attachmentPath: null, attachmentName: null })}
                >
                  Retirer le PDF
                </Button>
              )}
            </div>
          )}

          <div>
            <label htmlFor="course-body" className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
              Contenu du cours
            </label>
            <textarea
              id="course-body"
              rows={16}
              value={form.body}
              disabled={!editable}
              maxLength={100000}
              onChange={(e) => setDraft({ ...form, body: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-marine-600 dark:bg-marine-900 dark:text-white"
            />
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Texte brut : les sauts de ligne sont conservés.</p>
          </div>
          {(editable || deletable) && (
            <div className="flex flex-wrap gap-2">
              {editable && (
                <Button type="submit" loading={save.isPending} disabled={cannotSubmit}>
                  Enregistrer
                </Button>
              )}
              {deletable && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setNotice(null);
                    setConfirmDelete(true);
                  }}
                >
                  Supprimer le cours
                </Button>
              )}
            </div>
          )}
        </form>
      </Card>

      {actions.length > 0 && (
        <Card title="Circuit de publication">
          {actions.some((a) => a.needsComment) && (
            <div className="mb-4">
              <label htmlFor="review-comment" className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                Commentaire pour l’auteur (obligatoire pour demander des corrections)
              </label>
              <textarea
                id="review-comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-marine-600 dark:bg-marine-900"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <Button
                key={a.to}
                variant={a.to === 'publie' ? 'success' : a.to === 'a_corriger' || a.to === 'archive' ? 'secondary' : 'primary'}
                disabled={a.needsComment && comment.trim() === ''}
                onClick={() => {
                  setNotice(null);
                  setPending(a);
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>

          {isStaff && isAuthor && c?.status === 'soumis' && (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Vous êtes l’auteur : un autre responsable doit valider ce cours.
            </p>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ''}
        message={pending?.message ?? ''}
        confirmLabel={pending?.label ?? ''}
        loading={transition.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          if (pending.needsComment && comment.trim() === '') return;
          transition.mutate(pending);
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer ce cours ?"
        message={`Le cours « ${c?.title ?? ''} » sera définitivement supprimé. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
