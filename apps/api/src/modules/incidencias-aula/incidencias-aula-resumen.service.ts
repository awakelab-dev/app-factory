import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { currentMonth, parseMonth } from './incidencias-aula-dates';
import type { IncidenciaResumenRow } from './incidencias-aula.mappers';
import { toResumenMensualDto } from './incidencias-aula.mappers';
import type { ResumenMensual } from './incidencias-aula.types';

/**
 * Resumen mensual de Dirección — MINIMIZACIÓN OBLIGATORIA de campos (gate
 * funcional decisión 2 / gate técnico nota 5, requisito verificable en PR):
 * el `select` de Prisma de abajo es, a propósito, la única fuente de verdad
 * de qué campos existen para este servicio — NO incluye `alumnoNombre`,
 * `relato` ni `seguimientos`. No es un filtro de presentación: esos campos
 * nunca llegan desde la base de datos a este proceso, así que un fallo de
 * frontend (o de un mapper distinto) no puede filtrarlos por accidente.
 *
 * Alcance del mes: por `fechaHecho` (fecha del hecho, la que registra el
 * docente), no por `createdAt` — es el dato operativo que Dirección espera
 * ver agrupado por mes. "Aulas" incluye también las INACTIVAS (gate
 * funcional, decisión 4): desactivar un aula no debe hacer desaparecer su
 * historial de incidencias del resumen.
 */
@Injectable()
export class IncidenciasResumenService {
  constructor(private readonly prisma: PrismaService) {}

  async resumenMensual(mes: string | undefined): Promise<ResumenMensual> {
    const mesResuelto = mes ?? currentMonth();
    const { start, end } = parseMonth(mesResuelto);

    const rows: IncidenciaResumenRow[] = await this.prisma.incidencia.findMany({
      where: { fechaHecho: { gte: start, lt: end } },
      select: {
        id: true,
        aulaId: true,
        tipo: true,
        gravedad: true,
        fechaHecho: true,
        estado: true,
        createdAt: true,
        cerradaAt: true
      },
      orderBy: { fechaHecho: 'asc' }
    });

    const aulaIds = [...new Set(rows.map((r) => r.aulaId))];
    const aulas =
      aulaIds.length === 0
        ? []
        : await this.prisma.aula.findMany({ where: { id: { in: aulaIds } }, select: { id: true, nombre: true } });
    const aulaNames = new Map(aulas.map((a) => [a.id, a.nombre]));

    return toResumenMensualDto(mesResuelto, rows, aulaNames);
  }
}
