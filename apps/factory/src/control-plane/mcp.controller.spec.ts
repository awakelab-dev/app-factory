import { ForbiddenException } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import type { ChangeRequestsService } from '../pipeline/change-requests.service';
import type { GatesService } from '../pipeline/gates.service';
import type { ProjectsService } from '../pipeline/projects.service';
import type { SubmissionsService } from '../pipeline/submissions.service';
import type { FactoryActorContext } from '../pipeline/types';
import { McpController } from './mcp.controller';

const gerente: FactoryActorContext = { email: 'gerente@awakelab.dev', role: 'gerente' };

function buildServices() {
  const projects = {
    listModules: vi.fn().mockResolvedValue([
      {
        id: 'proj-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        moduleSlug: 'gestor-proyectos',
        displayName: 'Gestor de proyectos',
        requestedBy: 'leonardo.barreto@awakelab.dev',
        sourceType: 'manual',
        sourceRef: '/ruta',
        status: 'deployed',
        specs: [{ version: 2, functionalContent: '# Título\n\nKanban de proyectos y sprints.' }]
      }
    ]),
    getFullStatus: vi.fn()
  } as unknown as ProjectsService;

  const submissions = {
    create: vi.fn().mockResolvedValue({
      project: { id: 'proj-2', moduleSlug: 'gestor-vacaciones', status: 'received' },
      submission: { id: 'sub-1' },
      // D-047: submit_prototype encola el análisis y devuelve su id.
      analysisJob: { id: 'job-1', status: 'queued' }
    })
  } as unknown as SubmissionsService;

  const changeRequests = { create: vi.fn() } as unknown as ChangeRequestsService;

  const gates = {
    decide: vi.fn().mockRejectedValue(new ForbiddenException('El gate technical es de revisión técnica — solo lo decide un admin.'))
  } as unknown as GatesService;

  return { projects, submissions, changeRequests, gates };
}

/** Conecta un Client MCP en memoria al server que el controller construye para el actor — mismo camino que una request real, sin HTTP. */
async function connectClient(controller: McpController, actor: FactoryActorContext) {
  // buildServer es privado a propósito (solo lo usa handle()); el test lo
  // ejercita directamente para no montar el transporte HTTP.
  const server = (controller as unknown as { buildServer(actor: FactoryActorContext): { connect(t: unknown): Promise<void> } }).buildServer(
    actor
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('McpController (conector awkfactory, D-036)', () => {
  it('expone exactamente las 5 tools del contrato v1', async () => {
    const { projects, submissions, changeRequests, gates } = buildServices();
    const controller = new McpController(projects, submissions, changeRequests, gates);
    const client = await connectClient(controller, gerente);

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'approve_spec',
      'get_project_status',
      'list_modules',
      'list_projects',
      'request_change',
      'submit_prototype'
    ]);
  });

  // list_projects (D-044): alimenta la vista de seguimiento. El scope lo decide
  // el SERVIDOR por rol — el gerente ve los suyos, Sistemas (admin) ve todos.
  it('list_projects delega en ProjectsService.list con el actor (scope por rol) y mapea el resumen', async () => {
    const { projects, submissions, changeRequests, gates } = buildServices();
    (projects as unknown as { list: unknown }).list = vi.fn().mockResolvedValue([
      {
        id: 'proj-9',
        createdAt: new Date('2026-07-20T10:00:00Z'),
        updatedAt: new Date('2026-07-21T10:00:00Z'),
        moduleSlug: 'gestor-vacaciones',
        displayName: 'Gestor de vacaciones',
        requestedBy: gerente.email,
        sourceType: 'cowork_prototype',
        status: 'pending_approval',
        specs: [{ version: 1, gates: [{ status: 'pending' }, { status: 'approved' }] }]
      }
    ]);
    const controller = new McpController(projects, submissions, changeRequests, gates);
    const client = await connectClient(controller, gerente);

    const result = await client.callTool({ name: 'list_projects', arguments: {} });

    expect((projects as unknown as { list: ReturnType<typeof vi.fn> }).list).toHaveBeenCalledWith(gerente);
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    expect(JSON.parse(text)).toEqual([
      expect.objectContaining({
        id: 'proj-9',
        moduleSlug: 'gestor-vacaciones',
        status: 'pending_approval',
        requestedBy: gerente.email,
        latestSpecVersion: 1,
        pendingGates: 1
      })
    ]);
  });

  it('list_projects con actor admin (Sistemas) pide la lista SIN filtrar por email', async () => {
    const { projects, submissions, changeRequests, gates } = buildServices();
    const admin: FactoryActorContext = { email: 'leonardo.barreto@awakelab.dev', role: 'admin' };
    (projects as unknown as { list: unknown }).list = vi.fn().mockResolvedValue([]);
    const controller = new McpController(projects, submissions, changeRequests, gates);
    const client = await connectClient(controller, admin);

    await client.callTool({ name: 'list_projects', arguments: {} });

    // El servicio recibe el actor admin → ProjectsService.list no aplica filtro.
    expect((projects as unknown as { list: ReturnType<typeof vi.fn> }).list).toHaveBeenCalledWith(admin);
  });

  it('list_modules devuelve el catálogo mapeado (slug, estado, resumen de spec)', async () => {
    const { projects, submissions, changeRequests, gates } = buildServices();
    const controller = new McpController(projects, submissions, changeRequests, gates);
    const client = await connectClient(controller, gerente);

    const result = await client.callTool({ name: 'list_modules', arguments: {} });

    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    const modules = JSON.parse(text);
    expect(modules).toEqual([
      {
        moduleSlug: 'gestor-proyectos',
        displayName: 'Gestor de proyectos',
        status: 'deployed',
        latestSpecVersion: 2,
        specSummary: 'Kanban de proyectos y sprints.'
      }
    ]);
  });

  it('submit_prototype liga submittedBy al actor autenticado y responde con el análisis ya encolado (D-047)', async () => {
    const { projects, submissions, changeRequests, gates } = buildServices();
    const controller = new McpController(projects, submissions, changeRequests, gates);
    const client = await connectClient(controller, gerente);

    const result = await client.callTool({
      name: 'submit_prototype',
      arguments: {
        moduleSlug: 'gestor-vacaciones',
        displayName: 'Gestor de vacaciones',
        sourceHtml: '<html>proto</html>',
        manifest: {
          name: 'Gestor de vacaciones',
          purpose: 'Solicitar y aprobar vacaciones.',
          actors: [{ role: 'empleado' }],
          entities: [{ name: 'solicitud', sensitivity: 'interno' }]
        }
      }
    });

    expect(submissions.create).toHaveBeenCalledWith(expect.objectContaining({ submittedBy: gerente.email }));
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    expect(JSON.parse(text)).toMatchObject({
      projectId: 'proj-2',
      submissionId: 'sub-1',
      analysisJobId: 'job-1',
      status: 'received'
    });
    // El gerente debe entender que no tiene que pedirle nada a nadie.
    expect(text).toContain('ENCOLADO');
  });

  it('un 403 del servicio llega como resultado isError con el motivo, no como error de protocolo', async () => {
    const { projects, submissions, changeRequests, gates } = buildServices();
    const controller = new McpController(projects, submissions, changeRequests, gates);
    const client = await connectClient(controller, gerente);

    const result = await client.callTool({
      name: 'approve_spec',
      arguments: { gateId: 'gate-1', decision: 'approved' }
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? '';
    expect(text).toContain('solo lo decide un admin');
    // El actor viajó hasta GatesService (el modelo de roles vive allí).
    expect(gates.decide).toHaveBeenCalledWith(expect.objectContaining({ actor: gerente, reviewer: gerente.email }));
  });

  it('rechaza una submission con manifest sin sensibilidad por entidad (validación Zod del contrato)', async () => {
    const { projects, submissions, changeRequests, gates } = buildServices();
    const controller = new McpController(projects, submissions, changeRequests, gates);
    const client = await connectClient(controller, gerente);

    const result = await client.callTool({
      name: 'submit_prototype',
      arguments: {
        moduleSlug: 'gestor-vacaciones',
        displayName: 'Gestor de vacaciones',
        sourceHtml: '<html>proto</html>',
        manifest: {
          name: 'Gestor de vacaciones',
          purpose: 'Solicitar y aprobar vacaciones.',
          actors: [{ role: 'empleado' }],
          entities: [{ name: 'solicitud' }]
        }
      }
    });

    // El SDK valida el inputSchema y devuelve un error de tool, sin llegar al servicio.
    expect(result.isError).toBe(true);
    expect(submissions.create).not.toHaveBeenCalled();
  });
});
