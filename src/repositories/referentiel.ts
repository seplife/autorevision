import { getSupabase } from '@/lib/supabase';
import type { GradeLevel, SchoolYear } from '@/types/domain';

export async function fetchGradeLevels(): Promise<GradeLevel[]> {
  const { data, error } = await getSupabase()
    .from('grade_levels')
    .select('id, code, label, cycle, position, exam_name, academic_series(id, grade_level_id, code, label)')
    .eq('is_active', true)
    .order('position');
  if (error) throw error;
  return ((data ?? []) as GradeLevel[]).map((g) => ({
    ...g,
    academic_series: [...(g.academic_series ?? [])].sort((a, b) => a.code.localeCompare(b.code)),
  }));
}

export async function fetchCurrentSchoolYear(): Promise<SchoolYear | null> {
  const { data, error } = await getSupabase()
    .from('school_years')
    .select('id, label, is_current')
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw error;
  return (data as SchoolYear | null) ?? null;
}

/** Libellé lisible d'une classe : « Troisième », « Terminale — Série D »… */
export function classLabel(grades: GradeLevel[], gradeId: string | null, seriesId: string | null): string | null {
  const grade = grades.find((g) => g.id === gradeId);
  if (!grade) return null;
  const series = grade.academic_series.find((s) => s.id === seriesId);
  return series ? `${grade.label} — ${series.label}` : grade.label;
}
