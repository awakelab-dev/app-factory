import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  MoodleCategoryDto,
  MoodleCourseDto,
  MoodleEnrolledUserDto,
  MoodleExceptionDto,
  MoodleGradeReportDto
} from './moodle-client.types';

const SITE_COURSE_ID = 1; // "Site home" — no es un curso real, todas las instalaciones lo tienen.
// Default generoso: en instancias grandes (cientos de cursos, miles de
// alumnos) gradereport_user_get_grade_items puede tardar bastante más que
// unos pocos segundos por curso — Moodle recalcula el gradebook al vuelo.
// 15s (valor original) abortaba de forma real contra una instancia así
// ("The operation was aborted due to timeout", validado 2026-07-13).
// Configurable por si una instancia concreta necesita más margen todavía.
const REQUEST_TIMEOUT_MS = Number(process.env.MOODLE_REQUEST_TIMEOUT_MS) || 60_000;

/**
 * Cliente REST de Moodle Web Services (D-022): una sola instancia por
 * variables de entorno MOODLE_URL/MOODLE_TOKEN (single-tenant, sin selector —
 * ver .env.example para qué funciones habilitar en el servicio externo).
 * Usa el fetch nativo de Node: no añade una dependencia HTTP nueva al monorepo.
 */
@Injectable()
export class MoodleClientService {
  /** false si faltan las credenciales — MoodleSyncService debe comprobarlo antes de sincronizar. */
  get isConfigured(): boolean {
    return Boolean(process.env.MOODLE_URL && process.env.MOODLE_TOKEN);
  }

  async getCourses(): Promise<MoodleCourseDto[]> {
    const courses = await this.call<MoodleCourseDto[]>('core_course_get_courses');
    return courses.filter((course) => course.id !== SITE_COURSE_ID);
  }

  async getCategories(): Promise<MoodleCategoryDto[]> {
    return this.call<MoodleCategoryDto[]>('core_course_get_categories');
  }

  async getEnrolledStudents(courseId: number): Promise<MoodleEnrolledUserDto[]> {
    const users = await this.call<MoodleEnrolledUserDto[]>('core_enrol_get_enrolled_users', {
      courseid: String(courseId)
    });
    return users.filter((user) => user.roles.some((role) => role.shortname === 'student'));
  }

  async getCourseGradeReport(courseId: number): Promise<MoodleGradeReportDto> {
    return this.call<MoodleGradeReportDto>('gradereport_user_get_grade_items', {
      courseid: String(courseId)
    });
  }

  private async call<T>(wsfunction: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'MOODLE_URL/MOODLE_TOKEN no configuradas — moodle-insights no puede sincronizar (ver .env.example).'
      );
    }

    const url = new URL('/webservice/rest/server.php', process.env.MOODLE_URL);
    url.searchParams.set('wstoken', process.env.MOODLE_TOKEN as string);
    url.searchParams.set('wsfunction', wsfunction);
    url.searchParams.set('moodlewsrestformat', 'json');
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`Moodle respondió HTTP ${res.status} en ${wsfunction}`);
    }

    const body = (await res.json()) as unknown;
    if (isMoodleException(body)) {
      throw new Error(`Moodle rechazó ${wsfunction} (${body.errorcode ?? body.exception}): ${body.message}`);
    }
    return body as T;
  }
}

function isMoodleException(body: unknown): body is MoodleExceptionDto {
  return Boolean(body && typeof body === 'object' && 'exception' in body);
}
