import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';
import { MoodleQueryService } from './moodle-query.service';

describe('MoodleQueryService.summary', () => {
  it('agrega totales, promedio de notas y usa "Sin categoría" cuando falta', async () => {
    const prisma = {
      moodleCourse: {
        count: vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(4),
        groupBy: vi.fn().mockResolvedValue([
          { categoryName: 'Ciencias', _count: { _all: 3 } },
          { categoryName: null, _count: { _all: 2 } }
        ])
      },
      moodleStudent: { count: vi.fn().mockResolvedValue(40) },
      moodleEnrollment: { count: vi.fn().mockResolvedValue(55) },
      moodleGrade: { findMany: vi.fn().mockResolvedValue([{ grade: 8 }, { grade: 6 }, { grade: null }]) },
      moodleSyncRun: { findFirst: vi.fn().mockResolvedValue(null) }
    } as unknown as PrismaService;

    const summary = await new MoodleQueryService(prisma).summary();

    expect(summary).toEqual({
      totalCourses: 5,
      visibleCourses: 4,
      totalStudents: 40,
      totalEnrollments: 55,
      avgGrade: 7,
      coursesByCategory: [
        { categoryName: 'Ciencias', count: 3 },
        { categoryName: 'Sin categoría', count: 2 }
      ],
      lastSync: null
    });
  });
});

describe('MoodleQueryService.courses', () => {
  it('mapea cada curso con su contador de alumnos y promedio de notas', async () => {
    const prisma = {
      moodleCourse: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'c-1',
            moodleId: 12,
            shortname: 'MAT101',
            fullname: 'Matemáticas I',
            categoryName: 'Ciencias',
            visible: true,
            _count: { enrollments: 2 },
            grades: [{ grade: 8 }, { grade: 6 }]
          }
        ])
      }
    } as unknown as PrismaService;

    const rows = await new MoodleQueryService(prisma).courses();

    expect(rows).toEqual([
      {
        id: 'c-1',
        moodleId: 12,
        shortname: 'MAT101',
        fullname: 'Matemáticas I',
        categoryName: 'Ciencias',
        visible: true,
        studentsCount: 2,
        avgGrade: 7
      }
    ]);
  });
});

describe('MoodleQueryService.students', () => {
  it('mapea cada alumno con su contador de cursos y promedio de notas', async () => {
    const prisma = {
      moodleStudent: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 's-1',
            moodleId: 1,
            fullname: 'Alumna Uno',
            email: 'a1@test.dev',
            _count: { enrollments: 1 },
            grades: [{ grade: 9 }]
          }
        ])
      }
    } as unknown as PrismaService;

    const rows = await new MoodleQueryService(prisma).students();

    expect(rows).toEqual([
      {
        id: 's-1',
        moodleId: 1,
        fullname: 'Alumna Uno',
        email: 'a1@test.dev',
        coursesCount: 1,
        avgGrade: 9
      }
    ]);
  });
});
