/** Types métier partagés, alignés sur le schéma SQL (supabase/migrations). */

export const APP_ROLES = [
  'eleve',
  'parent',
  'enseignant',
  'responsable_pedagogique',
  'administrateur',
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  eleve: 'Élève',
  parent: 'Parent ou tuteur',
  enseignant: 'Enseignant',
  responsable_pedagogique: 'Responsable pédagogique',
  administrateur: 'Administrateur',
};

export type VerificationStatus = 'a_verifier' | 'en_verification' | 'valide';

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  a_verifier: 'À vérifier',
  en_verification: 'En cours de vérification',
  valide: 'Validé pédagogiquement',
};

export type ContentStatus = 'brouillon' | 'en_redaction' | 'soumis' | 'a_corriger' | 'valide' | 'publie' | 'archive';

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  brouillon: 'Brouillon',
  en_redaction: 'En cours de rédaction',
  soumis: 'Soumis à vérification',
  a_corriger: 'À corriger',
  valide: 'Validé pédagogiquement',
  publie: 'Publié',
  archive: 'Archivé',
};

export interface CourseChapterInfo {
  id: string;
  title: string;
  curricula: {
    id: string;
    title: string;
    verification_status: VerificationStatus;
    subjects: { name: string } | null;
    grade_levels: { label: string } | null;
  } | null;
}

export interface Course {
  id: string;
  chapter_id: string;
  title: string;
  body: string;
  status: ContentStatus;
  author_id: string;
  review_comment: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  published_at: string | null;
  updated_at: string;
  chapters: CourseChapterInfo | null;
}

export interface ChapterOption {
  id: string;
  title: string;
  parent_chapter_id: string | null;
  parent: { title: string } | null;
  curricula: {
    title: string;
    subjects: { name: string } | null;
    grade_levels: { label: string } | null;
    academic_series: { code: string } | null;
  } | null;
}

export interface Profile {
  id: string;
  display_name: string;
}

export interface StudentRecord {
  user_id: string;
  grade_level_id: string | null;
  series_id: string | null;
  school_year_id: string | null;
}

export interface AcademicSeries {
  id: string;
  grade_level_id: string;
  code: string;
  label: string;
}

export interface GradeLevel {
  id: string;
  code: string;
  label: string;
  cycle: 'premier_cycle' | 'second_cycle';
  position: number;
  exam_name: string | null;
  academic_series: AcademicSeries[];
}

export interface SchoolYear {
  id: string;
  label: string;
  is_current: boolean;
}

export interface FamilyLink {
  link_id: string;
  relation: 'enfant' | 'parent';
  other_user_id: string;
  other_display_name: string;
  linked_at: string;
}

export interface AdminUserRow {
  id: string;
  display_name: string;
  email: string;
  roles: AppRole[];
  created_at: string;
}

export interface PlatformSettings {
  platform_name: string;
  slogan: string;
  mastery_threshold: number;
}

export type RedeemStatus = 'lie' | 'deja_lie' | 'code_invalide' | 'trop_de_tentatives';
