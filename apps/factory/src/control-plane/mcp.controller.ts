import { Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { factoryGateDecisionSchema, factorySubmissionRequestSchema } from '@awk/types';
import { ChangeRequestsService } from '../pipeline/change-requests.service';
import { GatesService } from '../pipeline/gates.service';
import { ProjectsService } from '../pipeline/projects.service';
import { SubmissionsService } from '../pipeline/submissions.service';
import type { FactoryActorContext, ProjectStatus } from '../pipeline/types';
import { CurrentActor } from './current-actor.decorator';
import { toChangeRequestDto, toGateDto, toModuleSummaryDto, toProjectDetailDto, toProjectSummaryDto } from './mappers';

/**
 * Conector MCP `awkfactory` (D-036, incremento A de Fase 2): MCP server
 * Streamable HTTP montado DENTRO del control plane en /factory-api/mcp —
 * cero contenedor/puerto/bloque Nginx nuevos. Las 5 tools del contrato v1
 * (docs/04) son wrappers FINOS sobre los mismos servicios que sirven a los
 * endpoints REST; el transporte no añade lógica.
 *
 * Auth: el guard global (FactoryAuthGuard) corre ANTES que esto — el plugin
 * de Cowork manda `Authorization: Bearer <PAT awkf_...>` y aquí ya llega el
 * actor {email, rol} resuelto. El scope por rol vive en los servicios.
 *
 * Modo STATELESS deliberado: un McpServer + transporte NUEVOS por request
 * (sin sesiones SSE persistentes) — las tools están ligadas al actor de ESTA
 * request y el volumen es mínimo (gerentes puntuales). Si algún día hace
 * falta streaming de servidor (notificaciones de progreso del pipeline), se
 * revisará con el incremento C.
 */
@Controller('mcp')
export class McpController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly submissions: SubmissionsService,
    private readonly changeRequests: ChangeRequestsService,
    private readonly gates: GatesService
  ) {}

  @Post()
  async handle(
    @Req() req: IncomingMessage & { body?: unknown },
    @Res() res: ServerResponse,
    @CurrentActor() actor: FactoryActorContext
  ): Promise<void> {
    const server = this.buildServer(actor);
    const transport = new StreamableHTTPServerTransport({
      // Stateless: sin session id — cada POST es autocontenido.
      sessionIdGenerator: undefined,
      // JSON plano en vez de SSE: respuestas cortas, sin streaming que sostener.
      enableJsonResponse: true
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  // En modo stateless no hay stream de servidor ni sesión que cerrar:
  // GET/DELETE responden 405 con un error JSON-RPC (patrón del SDK).
  @Get()
  rejectGet(@Res() res: ServerResponse): void {
    this.methodNotAllowed(res);
  }

  @Delete()
  rejectDelete(@Res() res: ServerResponse): void {
    this.methodNotAllowed(res);
  }

  private methodNotAllowed(res: ServerResponse): void {
    res.writeHead(405, { 'Content-Type': 'application/json' }).end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed: el MCP de la Fábrica es stateless, usa POST.' },
        id: null
      })
    );
  }

  /** Un server por request, con las tools ligadas al actor autenticado. */
  private buildServer(actor: FactoryActorContext): McpServer {
    const server = new McpServer({ name: 'awkfactory', version: '1.0.0' });

    server.registerTool(
      'list_modules',
      {
        title: 'Listar módulos existentes',
        description:
          'Catálogo de módulos de la plataforma Awakelab (existentes y en curso) con su estado y un resumen de su spec. ' +
          'ÚSALO ANTES de enviar un prototipo nuevo: si ya existe algo equivalente, propone request_change sobre ese módulo en vez de duplicarlo.',
        inputSchema: {}
      },
      async () => {
        const projects = await this.projects.listModules();
        return toolJson(projects.map(toModuleSummaryDto));
      }
    );

    server.registerTool(
      'list_projects',
      {
        title: 'Listar mis proyectos en la Fábrica',
        description:
          'Proyectos propios en curso con su fase del pipeline, versión de spec y cuántos gates están pendientes. ' +
          'Un gerente ve SOLO los suyos; un admin (Sistemas) ve todos — el alcance lo decide el servidor según el rol, no el parámetro. ' +
          'Úsalo para responder "¿cómo van mis proyectos?" y para alimentar vistas de seguimiento.',
        inputSchema: {}
      },
      async () =>
        this.guarded(async () => {
          const projects = await this.projects.list(actor);
          return projects.map(toProjectSummaryDto);
        })
    );

    server.registerTool(
      'submit_prototype',
      {
        title: 'Enviar un prototipo a la Fábrica',
        description:
          'Envía el HTML autocontenido del prototipo + su prototype.manifest.json (nombre, propósito, actores, entidades con sensibilidad declarada). ' +
          'Crea el proyecto en la Fábrica y ENCOLA su análisis automáticamente (tarda unos minutos): al terminar quedan abiertos los gates funcional y técnico. ' +
          'Consulta el avance con get_project_status.',
        inputSchema: factorySubmissionRequestSchema.shape
      },
      async (args) =>
        this.guarded(async () => {
          // Re-parse defensivo: aplica defaults del schema (p. ej.
          // relatedProcesses) por si el transporte no los materializó.
          const input = factorySubmissionRequestSchema.parse(args);
          const { project, submission, analysisJob } = await this.submissions.create({
            moduleSlug: input.moduleSlug,
            displayName: input.displayName,
            sourceHtml: input.sourceHtml,
            manifest: input.manifest,
            submittedBy: actor.email
          });
          return {
            projectId: project.id,
            submissionId: submission.id,
            analysisJobId: analysisJob.id,
            moduleSlug: project.moduleSlug,
            status: project.status as ProjectStatus,
            message:
              'Prototipo recibido y análisis ENCOLADO — arranca solo, sin que nadie lance nada a mano (D-047). ' +
              'Suele tardar unos minutos; cuando termina, el proyecto pasa a "pendiente de aprobación" con los gates funcional y técnico abiertos. ' +
              'Consulta el avance con get_project_status.'
          };
        })
    );

    server.registerTool(
      'get_project_status',
      {
        title: 'Estado de un proyecto',
        description:
          'Estado completo de un proyecto en el pipeline: fase actual, versiones de spec (con su contenido funcional para revisarlo), gates pendientes/decididos y runs. ' +
          'Un gerente solo ve sus propios proyectos.',
        inputSchema: { projectId: z.string().describe('UUID del proyecto (lo devuelve submit_prototype)') }
      },
      async ({ projectId }) =>
        this.guarded(async () => {
          const project = await this.projects.getFullStatus(projectId, actor);
          return toProjectDetailDto(project);
        })
    );

    server.registerTool(
      'request_change',
      {
        title: 'Pedir un cambio sobre un módulo vivo',
        description:
          'Registra una petición de cambio/mantenimiento sobre un módulo ya generado o desplegado (del propio gerente) y ENCOLA su análisis automáticamente. ' +
          'Al terminar quedan abiertos gates frescos sobre la mini-spec del cambio; consulta el avance con get_project_status.',
        inputSchema: {
          projectId: z.string().describe('UUID del proyecto del módulo a modificar'),
          requestText: z
            .string()
            .min(10)
            .max(4000)
            .describe('Qué debe cambiar y por qué, en lenguaje de negocio — cuanto más concreto, mejor análisis')
        }
      },
      async ({ projectId, requestText }) =>
        this.guarded(async () => {
          const changeRequest = await this.changeRequests.create({
            projectId,
            requestText,
            requestedBy: actor.email,
            actor
          });
          // Modelo ligero (2026-07-19): una iteración activa por módulo. Si ya
          // hay un análisis en curso, la petición queda registrada igual —
          // nunca se pierde lo que escribió el gerente— pero no se analiza
          // ahora, y hay que decirlo sin rodeos.
          const alreadyQueued = 'analysisAlreadyQueued' in changeRequest && changeRequest.analysisAlreadyQueued === true;
          return {
            ...toChangeRequestDto(changeRequest),
            message: alreadyQueued
              ? 'Petición de cambio registrada, PERO el módulo ya tiene una iteración en curso en la Fábrica: solo se trabaja una a la vez. ' +
                'Cuando esa termine (get_project_status lo muestra), vuelve a pedir este cambio para que entre al análisis.'
              : 'Petición de cambio registrada y análisis ENCOLADO — arranca solo. ' +
                'Suele tardar unos minutos; al terminar quedan abiertos los gates de la mini-spec del cambio. Consulta con get_project_status.'
          };
        })
    );

    server.registerTool(
      'approve_spec',
      {
        title: 'Decidir un gate',
        description:
          'Decide un gate pendiente: aprobar, rechazar (con motivo) o pedir cambios (complementar). ' +
          'Un gerente decide los gates functional y manager_acceptance de SUS proyectos; los gates técnicos son del revisor técnico. ' +
          'Lee la spec con get_project_status antes de decidir.',
        inputSchema: {
          gateId: z.string().describe('UUID del gate (aparece en get_project_status, dentro de cada spec)'),
          decision: factoryGateDecisionSchema,
          notes: z.string().max(4000).optional().describe('Obligatorio de facto al rechazar o pedir cambios: el porqué')
        }
      },
      async ({ gateId, decision, notes }) =>
        this.guarded(async () => {
          const gate = await this.gates.decide({ gateId, decision, notes, reviewer: actor.email, actor });
          return toGateDto(gate);
        })
    );

    return server;
  }

  /**
   * Las excepciones HTTP de los servicios (403 de scope, 409 de slug
   * duplicado, 400 de gate ya decidido…) se devuelven como resultado de tool
   * con isError — un error de protocolo JSON-RPC haría que Claude viera un
   * fallo opaco en vez del motivo accionable.
   */
  private async guarded(fn: () => Promise<unknown>) {
    try {
      return toolJson(await fn());
    } catch (error) {
      const message =
        error instanceof HttpException ? error.message : error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true
      };
    }
  }
}

function toolJson(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}
