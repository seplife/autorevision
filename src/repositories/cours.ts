import { getSupabase } from '@/lib/supabase';
import type { ChapterOption, ContentStatus, Course } from '@/types/domain';

const COURSE_SELECT =
  'id, chapter_id, title, body, status, author_id, review_comment, attachment_path, attachment_name, published_at, updated_at, ' +
  'chapters(id, title, curricula(id, title, verification_status, subjects(name), grade_levels(label)))';

/** Cours visibles par l'utilisateur : les siens, ou tous pour le staff (la RLS filtre). */
export async function fetchCourses(): Promise<Course[]> {
  const { data, error } = await getSupabase()
    .from('courses')
    .select(COURSE_SELECT)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Course[];
}

export async function fetchCourse(id: string): Promise<Course | null> {
  const { data, error } = await getSupabase().from('courses').select(COURSE_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as unknown as Course | null) ?? null;
}

export async function fetchChapterOptions(): Promise<ChapterOption[]> {
  const { data, error } = await getSupabase()
    .from('chapters')
    .select('id, title, parent_chapter_id, position, curricula(title, subjects(name), grade_levels(label), academic_series(code))')
    .order('position');
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<ChapterOption & { position: number }>;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return rows.map((r) => ({
    ...r,
    parent: r.parent_chapter_id ? { title: byId.get(r.parent_chapter_id)?.title ?? '' } : null,
  }));
}

export async function uploadCoursePdf(file: File): Promise<{ path: string; name: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await getSupabase().storage.from('course-files').upload(path, file, {
    contentType: file.type || 'application/pdf',
    upsert: false,
  });
  if (error) throw error;
  return { path, name: file.name };
}

export function courseAttachmentUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const { data } = getSupabase().storage.from('course-files').getPublicUrl(path);
  return data.publicUrl;
}

export async function saveCourse(input: {
  id: string | null;
  chapterId: string;
  title: string;
  body: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc('course_save', {
    p_id: input.id,
    p_chapter_id: input.chapterId,
    p_title: input.title,
    p_body: input.body,
    p_attachment_path: input.attachmentPath ?? null,
    p_attachment_name: input.attachmentName ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function transitionCourse(id: string, to: ContentStatus, comment?: string): Promise<void> {
  const { error } = await getSupabase().rpc('course_transition', {
    p_id: id,
    p_to: to,
    p_comment: comment ?? null,
  });
  if (error) throw error;
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('course_delete', { p_id: id });
  if (error) throw error;
}

export interface PublishedCourse {
  id: string;
  course_id: string;
  version_number: number;
  title: string;
  body: string;
  attachment_path: string | null;
  attachment_name: string | null;
  published_at: string;
  course: {
    status: ContentStatus;
    published_version_id: string | null;
    chapters: {
      title: string;
      curricula: {
        grade_level_id: string;
        series_id: string | null;
        subjects: { name: string } | null;
      } | null;
    } | null;
  };
}

/** Versions publiées (figées) des cours. Seule la version courante de chaque cours est conservée. */
export async function fetchPublishedCourses(): Promise<PublishedCourse[]> {
  const { data, error } = await getSupabase()
    .from('course_versions')
    .select(
      'id, course_id, version_number, title, body, attachment_path, attachment_name, published_at, ' +
        'course:courses!course_versions_course_id_fkey!inner(status, published_version_id, ' +
        'chapters(title, curricula(grade_level_id, series_id, subjects(name))))',
    )
    .eq('course.status', 'publie')
    .order('published_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as PublishedCourse[]).filter((v) => v.id === v.course.published_version_id);
}
