import { Injectable } from '@nestjs/common';
import type { MoodleCourseRow, MoodleStudentRow, MoodleSummary } from '@awk/types';
import { PrismaService } from '../../prisma/prisma.service';
import { toSyncRunResponse } from './moodle-insights.mappers';
import { average } from './moodle-insights.util';

/** Lado de lectura del módulo: consultas sobre el replicado ya sincronizado. */
@Injectable()
export class MoodleQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(): Promise<MoodleSummary> {
    const [totalCourses, visibleCourses, totalStudents, totalEnrollments, grades, categoryGroups, lastSyncRow] =
      await Promise.all([
        this.prisma.moodleCourse.count(),
        this.prisma.moodleCourse.count({ where: { visible: true } }),
        this.prisma.moodleStudent.count(),
        this.prisma.moodleEnrollment.count(),
        this.prisma.moodleGrade.findMany({ select: { grade: true } }),
        this.prisma.moodleCourse.groupBy({ by: ['categoryName'], _count: { _all: true } }),
        this.prisma.moodleSyncRun.findFirst({ orderBy: { startedAt: 'desc' } })
      ]);

    return {
      totalCourses,
      visibleCourses,
      totalStudents,
      totalEnrollments,
      avgGrade: average(grades.map((g) => g.grade)),
      coursesByCategory: categoryGroups
        .map((group) => ({ categoryName: group.categoryName ?? 'Sin categoría', count: group._count._all }))
        .sort((a, b) => b.count - a.count),
      lastSync: lastSyncRow ? toSyncRunResponse(lastSyncRow) : null
    };
  }

  async courses(): Promise<MoodleCourseRow[]> {
    const rows = await this.prisma.moodleCourse.findMany({
      orderBy: { fullname: 'asc' },
      include: {
        _count: { select: { enrollments: true } },
        grades: { select: { grade: true } }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      moodleId: row.moodleId,
      shortname: row.shortname,
      fullname: row.fullname,
      categoryName: row.categoryName,
      visible: row.visible,
      studentsCount: row._count.enrollments,
      avgGrade: average(row.grades.map((g) => g.grade))
    }));
  }

  async students(): Promise<MoodleStudentRow[]> {
    const rows = await this.prisma.moodleStudent.findMany({
      orderBy: { fullname: 'asc' },
      include: {
        _count: { select: { enrollments: true } },
        grades: { select: { grade: true } }
      }
    });

    return rows.map((row) => ({
      id: row.id,
      moodleId: row.moodleId,
      fullname: row.fullname,
      email: row.email,
      coursesCount: row._count.enrollments,
      avgGrade: average(row.grades.map((g) => g.grade))
    }));
  }
}
