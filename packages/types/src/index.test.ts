import { describe, expect, it } from 'vitest';
import {
  devLoginRequestSchema,
  helloResponseSchema,
  moduleManifestSchema,
  moodleCourseRowSchema,
  moodleSummarySchema,
  moodleSyncRunSchema
} from './index';

describe('helloResponseSchema', () => {
  it('acepta una respuesta válida', () => {
    const result = helloResponseSchema.safeParse({
      service: 'awk-api',
      message: 'hola',
      timestamp: new Date().toISOString()
    });
    expect(result.success).toBe(true);
  });

  it('rechaza timestamp no ISO', () => {
    const result = helloResponseSchema.safeParse({
      service: 'awk-api',
      message: 'hola',
      timestamp: 'ayer'
    });
    expect(result.success).toBe(false);
  });

  it('rechaza campos faltantes', () => {
    expect(helloResponseSchema.safeParse({ message: 'hola' }).success).toBe(false);
  });
});

describe('devLoginRequestSchema', () => {
  it('acepta un email válido', () => {
    expect(devLoginRequestSchema.safeParse({ email: 'a@awakelab.dev' }).success).toBe(true);
  });

  it('rechaza emails inválidos', () => {
    expect(devLoginRequestSchema.safeParse({ email: 'no-es-email' }).success).toBe(false);
  });
});

describe('moduleManifestSchema', () => {
  const base = {
    id: 'core-admin',
    name: 'Administración',
    basePath: '/admin',
    nav: [{ label: 'Usuarios', path: '/admin/usuarios', requiredRoles: ['admin'] }]
  };

  it('acepta un manifest válido (requiredRoles opcional)', () => {
    expect(moduleManifestSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza ids que no sean kebab-case', () => {
    expect(moduleManifestSchema.safeParse({ ...base, id: 'CoreAdmin' }).success).toBe(false);
  });

  it('rechaza paths no absolutas', () => {
    expect(
      moduleManifestSchema.safeParse({ ...base, basePath: 'admin' }).success
    ).toBe(false);
  });
});

describe('moodle-insights schemas', () => {
  it('moodleSyncRunSchema acepta un run terminado con éxito', () => {
    const result = moodleSyncRunSchema.safeParse({
      id: 'run-1',
      status: 'success',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      coursesCount: 3,
      studentsCount: 42,
      enrollmentsCount: 50,
      errorMessage: null
    });
    expect(result.success).toBe(true);
  });

  it('moodleSyncRunSchema rechaza un status fuera del enum', () => {
    expect(
      moodleSyncRunSchema.safeParse({
        id: 'run-1',
        status: 'queued',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        coursesCount: 0,
        studentsCount: 0,
        enrollmentsCount: 0,
        errorMessage: null
      }).success
    ).toBe(false);
  });

  it('moodleCourseRowSchema acepta avgGrade nulo (curso sin calificaciones)', () => {
    expect(
      moodleCourseRowSchema.safeParse({
        id: 'c-1',
        moodleId: 12,
        shortname: 'MAT101',
        fullname: 'Matemáticas I',
        categoryName: 'Ciencias',
        visible: true,
        studentsCount: 30,
        avgGrade: null
      }).success
    ).toBe(true);
  });

  it('moodleSummarySchema acepta lastSync nulo (nunca se ha sincronizado)', () => {
    expect(
      moodleSummarySchema.safeParse({
        totalCourses: 0,
        visibleCourses: 0,
        totalStudents: 0,
        totalEnrollments: 0,
        avgGrade: null,
        coursesByCategory: [],
        lastSync: null
      }).success
    ).toBe(true);
  });
});
