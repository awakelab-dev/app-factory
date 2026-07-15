import { Injectable } from '@nestjs/common';
import type { OrientadorAcademy, OrientadorLeadRow } from '@awk/types';
import { PrismaService } from '../../prisma/prisma.service';
import { toAcademyResponse, toLeadRow } from './orientador-ia.mappers';

/** Lado de lectura del módulo: leads (admin) y academias (público + admin). */
@Injectable()
export class OrientadorQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async leads(): Promise<OrientadorLeadRow[]> {
    const rows = await this.prisma.orientadorLead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { profile: true }
    });
    return rows.map(toLeadRow);
  }

  /** `onlyActive`: true para el endpoint público (candidato), false para el panel admin. */
  async academies(onlyActive: boolean): Promise<OrientadorAcademy[]> {
    const rows = await this.prisma.orientadorAcademy.findMany({
      where: onlyActive ? { active: true } : undefined,
      orderBy: { name: 'asc' }
    });
    return rows.map(toAcademyResponse);
  }
}
