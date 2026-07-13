/**
 * Formas de respuesta de las funciones de Moodle Web Services que usa este
 * módulo (protocolo REST, `moodlewsrestformat=json`). Documentación:
 * https://docs.moodle.org/dev/Web_service_API_functions
 *
 * Son tipos de un sistema EXTERNO que no controlamos — deliberadamente no son
 * schemas Zod de @awk/types (esos son para el contrato interno api↔web).
 */

export interface MoodleExceptionDto {
  exception: string;
  errorcode?: string;
  message: string;
}

/** `core_course_get_courses` (curso "Site" id=1 excluido por MoodleClientService). */
export interface MoodleCourseDto {
  id: number;
  shortname: string;
  fullname: string;
  categoryid: number;
  /** 0 | 1 */
  visible: number;
  /** epoch en segundos, 0 = sin fecha */
  startdate: number;
}

/** `core_course_get_categories` */
export interface MoodleCategoryDto {
  id: number;
  name: string;
}

/** `core_enrol_get_enrolled_users` (params: courseid) */
export interface MoodleEnrolledUserDto {
  id: number;
  fullname: string;
  email: string;
  roles: Array<{ shortname: string }>;
}

/** Item dentro de `gradereport_user_get_grade_items`; itemtype "course" = nota total del curso. */
export interface MoodleGradeItemDto {
  itemtype: string;
  itemname: string | null;
  graderaw: number | null;
  grademax: number | null;
}

export interface MoodleUserGradesDto {
  userid: number;
  gradeitems: MoodleGradeItemDto[];
}

/** `gradereport_user_get_grade_items` (params: courseid) */
export interface MoodleGradeReportDto {
  usergrades: MoodleUserGradesDto[];
}
