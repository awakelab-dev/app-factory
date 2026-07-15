import { Injectable, NotFoundException } from '@nestjs/common';
import type { OrientadorAcademy, OrientadorAcademyUpdate } from '@awk/types';
import { PrismaService } from '../../prisma/prisma.service';
import { toAcademyResponse } from './orientador-ia.mappers';

/** Escritura del catálogo de academias (panel admin, rol orientador_admin). */
@Injectable()
export class OrientadorAcademiesService {
  constructor(private readonly prisma: PrismaService) {}

  async update(id: string, patch: OrientadorAcademyUpdate): Promise<OrientadorAcademy> {
    const exists = await this.prisma.orientadorAcademy.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException(`No existe la academia "${id}"`);

    const row = await this.prisma.orientadorAcademy.update({
      where: { id },
      data: patch
    });
    return toAcademyResponse(row);
  }
}
