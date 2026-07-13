import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MoodleClientService } from './moodle-client.service';
import { MoodleSyncService } from './moodle-sync.service';

const RUN_ROW = {
  id: 'run-1',
  status: 'running',
  startedAt: new Date('2026-07-13T10:00:00Z'),
  finishedAt: null,
  coursesCount: 0,
  studentsCount: 0,
  enrollmentsCount: 0,
  errorMessage: null
};

function makePrisma() {
  const table = () => ({
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 })
  });
  return {
    moodleSyncRun: {
      create: vi.fn().mockResolvedValue(RUN_ROW),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...RUN_ROW, ...data })
      )
    },
    moodleCourse: table(),
    moodleStudent: table(),
    moodleEnrollment: table(),
    moodleGrade: table(),
    $transaction: vi.fn().mockResolvedValue(undefined)
  } as unknown as PrismaService;
}

function makeClient(): MoodleClientService {
  return {
    isConfigured: true,
    getCourses: vi
      .fn()
      .mockResolvedValue([
        { id: 12, shortname: 'MAT101', fullname: 'Matemáticas I', categoryid: 3, visible: 1, startdate: 0 }
      ]),
    getCategories: vi.fn().mockResolvedValue([{ id: 3, name: 'Ciencias' }]),
    getEnrolledStudents: vi
      .fn()
      .mockResolvedValue([
        { id: 1, fullname: 'Alumna Uno', email: 'a1@test.dev', roles: [{ shortname: 'student' }] },
        { id: 2, fullname: 'Alumno Dos', email: 'a2@test.dev', roles: [{ shortname: 'student' }] }
      ]),
    getCourseGradeReport: vi.fn().mockResolvedValue({
      usergrades: [
        { userid: 1, gradeitems: [{ itemtype: 'course', itemname: 'Total del curso', graderaw: 8.5, grademax: 10 }] }
      ]
    })
  } as unknown as MoodleClientService;
}

function makeAudit(): AuditService {
  return { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
}

describe('MoodleSyncService.run — camino feliz', () => {
  it('reemplaza el replicado, marca el run como success y audita', async () => {
    const prisma = makePrisma();
    const client = makeClient();
    const audit = makeAudit();

    const result = await new MoodleSyncService(prisma, client, audit).run('admin-1');

    expect(result.status).toBe('success');
    expect(result.coursesCount).toBe(1);
    expect(result.studentsCount).toBe(2);

    expect(prisma.moodleCourse.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ shortname: 'MAT101', categoryName: 'Ciencias', visible: true })]
    });
    expect(prisma.moodleStudent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ fullname: 'Alumna Uno' }),
        expect.objectContaining({ fullname: 'Alumno Dos' })
      ]
    });
    // Solo el alumno 1 tiene item de nota total ("course") en el fixture.
    expect(prisma.moodleGrade.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ grade: 8.5, gradeMax: 10 })]
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'admin-1', action: 'moodle_insights.sync' })
    );
  });
});

describe('MoodleSyncService.run — camino de error', () => {
  it('si Moodle falla, marca el run como error sin tocar $transaction', async () => {
    const prisma = makePrisma();
    const client = {
      isConfigured: true,
      getCourses: vi.fn().mockRejectedValue(new Error('Moodle no responde')),
      getCategories: vi.fn().mockResolvedValue([]),
      getEnrolledStudents: vi.fn(),
      getCourseGradeReport: vi.fn()
    } as unknown as MoodleClientService;
    const audit = makeAudit();

    const result = await new MoodleSyncService(prisma, client, audit).run();

    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('Moodle no responde');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'moodle_insights.sync', metadata: expect.objectContaining({ status: 'error' }) })
    );
  });
});
