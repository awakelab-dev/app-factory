import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoodleClientService } from './moodle-client.service';

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  vi.stubEnv('MOODLE_URL', 'https://moodle.test');
  vi.stubEnv('MOODLE_TOKEN', 'test-token');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('MoodleClientService.isConfigured', () => {
  it('false si falta MOODLE_URL o MOODLE_TOKEN', () => {
    vi.stubEnv('MOODLE_URL', '');
    expect(new MoodleClientService().isConfigured).toBe(false);
  });

  it('true con ambas variables', () => {
    expect(new MoodleClientService().isConfigured).toBe(true);
  });
});

describe('MoodleClientService.getCourses', () => {
  it('llama a core_course_get_courses y excluye el curso "Site" (id 1)', async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL) =>
      ok([
        { id: 1, shortname: 'Site', fullname: 'Site home', categoryid: 0, visible: 1, startdate: 0 },
        { id: 12, shortname: 'MAT101', fullname: 'Matemáticas I', categoryid: 3, visible: 1, startdate: 1700000000 }
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    const courses = await new MoodleClientService().getCourses();

    expect(courses).toHaveLength(1);
    expect(courses.at(0)?.shortname).toBe('MAT101');
    const [firstCall] = fetchMock.mock.calls;
    const calledUrl = new URL(String(firstCall?.[0]));
    expect(calledUrl.searchParams.get('wsfunction')).toBe('core_course_get_courses');
    expect(calledUrl.searchParams.get('wstoken')).toBe('test-token');
    expect(calledUrl.searchParams.get('moodlewsrestformat')).toBe('json');
  });

  it('sin credenciales lanza ServiceUnavailableException sin llegar a llamar a fetch', async () => {
    vi.stubEnv('MOODLE_TOKEN', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(new MoodleClientService().getCourses()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propaga el error si Moodle devuelve una excepción', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => ok({ exception: 'invalid_parameter_exception', errorcode: 'invalidparameter', message: 'token inválido' }))
    );
    await expect(new MoodleClientService().getCourses()).rejects.toThrow('token inválido');
  });

  it('propaga el error si la respuesta HTTP no es ok', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 })));
    await expect(new MoodleClientService().getCourses()).rejects.toThrow('HTTP 500');
  });
});

describe('MoodleClientService.getEnrolledStudents', () => {
  it('filtra solo usuarios con rol student', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        ok([
          { id: 1, fullname: 'Alumna Uno', email: 'a1@test.dev', roles: [{ shortname: 'student' }] },
          { id: 2, fullname: 'Profesor', email: 'p1@test.dev', roles: [{ shortname: 'teacher' }] }
        ])
      )
    );

    const students = await new MoodleClientService().getEnrolledStudents(12);
    expect(students).toHaveLength(1);
    expect(students.at(0)?.fullname).toBe('Alumna Uno');
  });
});
