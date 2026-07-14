import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { MoodleSyncRun } from '@awk/types';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { MoodleEnrolledUserDto, MoodleGradeReportDto } from './moodle-client.types';
import { MoodleClientService } from './moodle-client.service';
import { toSyncRunResponse } from './moodle-insights.mappers';
import { moodleBoolean, moodleDate } from './moodle-insights.util';

const SYNC_CONCURRENCY = 5;

interface CourseRow {
  id: string;
  moodleId: number;
  shortname: string;
  fullname: string;
  categoryId: number;
  categoryName: string | null;
  visible: boolean;
  startDate: Date | null;
}

interface StudentRow {
  id: string;
  moodleId: number;
  fullname: string;
  email: string;
}

interface EnrollmentRow {
  id: string;
  courseId: string;
  studentId: string;
}

interface GradeRow {
  id: string;
  courseId: string;
  studentId: string;
  grade: number | null;
  gradeMax: number | null;
}

/**
 * Orquesta un "Actualizar datos": llama a Moodle Web Services (D-022) y
 * reemplaza por completo el replicado en una transacción ("full refresh",
 * ver comentario en schema.prisma). Nunca se dispara solo — cada click queda
 * como un MoodleSyncRun (éxito o error) y un evento en core.audit_events.
 *
 * **Asíncrono desde 2026-07-13** (validado contra una instancia real de 627
 * cursos/5512 alumnos: el fetch+escritura completo tardó ~9m45s). Sostener
 * eso dentro de una sola request HTTP síncrona es frágil (timeout de
 * Nginx/proxy, pestaña del navegador cerrada, redeploy a medio camino) — el
 * controller llama a `start()` (rápido: un insert) para responder de
 * inmediato, y dispara `processPendingSync()` sin esperarlo (fire-and-forget,
 * mismo proceso Node, sin cola nueva: esto lo dispara un admin a mano de vez
 * en cuando, no hay concurrencia real que justificar más infraestructura). El
 * dashboard hace polling de `GET /summary` (`lastSync.status`) hasta que deja
 * de estar `running`. `processPendingSync` nunca rechaza — cualquier error se
 * captura y se refleja como `status: 'error'` en el propio MoodleSyncRun.
 */
@Injectable()
export class MoodleSyncService {
  private readonly logger = new Logger(MoodleSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: MoodleClientService,
    private readonly audit: AuditService
  ) {}

  /** Crea el sync_run en 'running' y responde ya — no espera el fetch real. */
  async start(triggeredById?: string): Promise<MoodleSyncRun> {
    const run = await this.prisma.moodleSyncRun.create({
      data: { triggeredById, status: 'running' }
    });
    return toSyncRunResponse(run);
  }

  /**
   * Hace el trabajo real (fetch a Moodle + transacción de reemplazo) sobre un
   * sync_run ya creado por `start()`. Pensado para invocarse sin `await` desde
   * el controller — nunca lanza: cualquier error queda como `status: 'error'`
   * en el propio run devuelto.
   */
  async processPendingSync(runId: string, triggeredById?: string): Promise<MoodleSyncRun> {
    try {
      const { courseRows, studentRows, enrollmentRows, gradeRows } = await this.fetchAll();

      await this.prisma.$transaction([
        this.prisma.moodleGrade.deleteMany({}),
        this.prisma.moodleEnrollment.deleteMany({}),
        this.prisma.moodleCourse.deleteMany({}),
        this.prisma.moodleStudent.deleteMany({}),
        ...(courseRows.length ? [this.prisma.moodleCourse.createMany({ data: courseRows })] : []),
        ...(studentRows.length ? [this.prisma.moodleStudent.createMany({ data: studentRows })] : []),
        ...(enrollmentRows.length
          ? [this.prisma.moodleEnrollment.createMany({ data: enrollmentRows })]
          : []),
        ...(gradeRows.length ? [this.prisma.moodleGrade.createMany({ data: gradeRows })] : [])
      ]);

      const finished = await this.prisma.moodleSyncRun.update({
        where: { id: runId },
        data: {
          status: 'success',
          finishedAt: new Date(),
          coursesCount: courseRows.length,
          studentsCount: studentRows.length,
          enrollmentsCount: enrollmentRows.length
        }
      });

      await this.audit.log({
        actorId: triggeredById,
        action: 'moodle_insights.sync',
        metadata: {
          status: 'success',
          coursesCount: courseRows.length,
          studentsCount: studentRows.length,
          enrollmentsCount: enrollmentRows.length
        }
      });

      return toSyncRunResponse(finished);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Sync de moodle-insights falló: ${message}`);

      const finished = await this.prisma.moodleSyncRun.update({
        where: { id: runId },
        data: { status: 'error', finishedAt: new Date(), errorMessage: message }
      });
      await this.audit.log({
        actorId: triggeredById,
        action: 'moodle_insights.sync',
        metadata: { status: 'error', errorMessage: message }
      });

      return toSyncRunResponse(finished);
    }
  }

  /** Trae cursos+categorías y, por lote acotado (SYNC_CONCURRENCY), alumnos+notas de cada curso. */
  private async fetchAll(): Promise<{
    courseRows: CourseRow[];
    studentRows: StudentRow[];
    enrollmentRows: EnrollmentRow[];
    gradeRows: GradeRow[];
  }> {
    const [courses, categories] = await Promise.all([
      this.client.getCourses(),
      this.client.getCategories()
    ]);
    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

    const courseRows: CourseRow[] = [];
    const studentById = new Map<number, StudentRow>();
    const enrollmentRows: EnrollmentRow[] = [];
    const gradeRows: GradeRow[] = [];

    for (let i = 0; i < courses.length; i += SYNC_CONCURRENCY) {
      const batch = courses.slice(i, i + SYNC_CONCURRENCY);
      await Promise.all(
        batch.map(async (course) => {
          const courseId = randomUUID();
          courseRows.push({
            id: courseId,
            moodleId: course.id,
            shortname: course.shortname,
            fullname: course.fullname,
            categoryId: course.categoryid,
            categoryName: categoryNameById.get(course.categoryid) ?? null,
            visible: moodleBoolean(course.visible),
            startDate: moodleDate(course.startdate)
          });

          // Cada llamada se aísla con su propio catch: en una instancia grande
          // (cientos de cursos) un solo curso con datos que Moodle no puede
          // validar (p.ej. gradereport_user_get_grade_items respondiendo
          // "invalidresponse" por un grade item con un campo nulo que Moodle
          // no debería permitir — bug de esa instancia, no de este cliente,
          // validado 2026-07-13) no debe tumbar el sync completo de los demás
          // cursos. Ese curso queda sin alumnos y/o sin notas para esta
          // corrida, con un warning en el log identificándolo.
          const students = await this.client.getEnrolledStudents(course.id).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `moodle-insights: no se pudieron traer alumnos del curso ${course.shortname} (id ${course.id}): ${message}`
            );
            return [] as MoodleEnrolledUserDto[];
          });
          const gradeReport = await this.client.getCourseGradeReport(course.id).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `moodle-insights: no se pudieron traer notas del curso ${course.shortname} (id ${course.id}): ${message}`
            );
            return { usergrades: [] } as MoodleGradeReportDto;
          });

          const courseGradeByStudentId = new Map<number, { grade: number | null; gradeMax: number | null }>();
          for (const userGrades of gradeReport.usergrades) {
            const courseTotal = userGrades.gradeitems.find((item) => item.itemtype === 'course');
            if (courseTotal) {
              courseGradeByStudentId.set(userGrades.userid, {
                grade: courseTotal.graderaw,
                gradeMax: courseTotal.grademax
              });
            }
          }

          for (const student of students) {
            let row = studentById.get(student.id);
            if (!row) {
              row = { id: randomUUID(), moodleId: student.id, fullname: student.fullname, email: student.email };
              studentById.set(student.id, row);
            }
            enrollmentRows.push({ id: randomUUID(), courseId, studentId: row.id });

            const grade = courseGradeByStudentId.get(student.id);
            if (grade) {
              gradeRows.push({ id: randomUUID(), courseId, studentId: row.id, ...grade });
            }
          }
        })
      );
    }

    return { courseRows, studentRows: [...studentById.values()], enrollmentRows, gradeRows };
  }
}
