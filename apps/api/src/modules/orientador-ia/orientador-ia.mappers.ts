import type { OrientadorAcademy, OrientadorLeadRow, OrientadorProfile } from '@awk/types';

/** Forma mínima que necesitamos de una fila `orientador.profiles` de Prisma. */
export interface ProfileRow {
  leadId: string;
  recommendedSector: string;
  rationale: string;
  estimatedLevel: string;
  skillGaps: unknown;
  createdAt: Date;
}

/** Forma mínima que necesitamos de una fila `orientador.leads` (+ su profile) de Prisma. */
export interface LeadRow {
  id: string;
  createdAt: Date;
  fullName: string;
  email: string;
  phone: string | null;
  consentMarketing: boolean;
  rawInputType: string;
  declaredSector: string | null;
  analysisCount: number;
  profile: ProfileRow | null;
}

/** Forma mínima que necesitamos de una fila `orientador.academies` de Prisma. */
export interface AcademyRow {
  id: string;
  sector: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  duration: string;
  durationWeeks: number;
  synchronous: string;
  asynchronous: string;
  challenge: string;
  modules: unknown;
  outcomes: unknown;
  priceEur: string;
  priceUsd: string;
  purchaseUrl: string;
  active: boolean;
}

/** Prisma guarda `modules`/`outcomes`/`skillGaps` como Json — siempre se
 * escriben como array de strings (nunca otra forma), así que el cast es seguro. */
function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? (value as string[]) : [];
}

export function toProfileResponse(row: ProfileRow): OrientadorProfile {
  return {
    leadId: row.leadId,
    recommendedSector: row.recommendedSector as OrientadorProfile['recommendedSector'],
    rationale: row.rationale,
    estimatedLevel: row.estimatedLevel as OrientadorProfile['estimatedLevel'],
    skillGaps: asStringArray(row.skillGaps),
    createdAt: row.createdAt.toISOString()
  };
}

export function toLeadRow(row: LeadRow): OrientadorLeadRow {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    consentMarketing: row.consentMarketing,
    rawInputType: row.rawInputType as OrientadorLeadRow['rawInputType'],
    declaredSector: row.declaredSector as OrientadorLeadRow['declaredSector'],
    analysisCount: row.analysisCount,
    profile: row.profile ? toProfileResponse(row.profile) : null
  };
}

export function toAcademyResponse(row: AcademyRow): OrientadorAcademy {
  return {
    id: row.id,
    sector: row.sector as OrientadorAcademy['sector'],
    name: row.name,
    shortName: row.shortName,
    icon: row.icon,
    color: row.color,
    duration: row.duration,
    durationWeeks: row.durationWeeks,
    synchronous: row.synchronous,
    asynchronous: row.asynchronous,
    challenge: row.challenge,
    modules: asStringArray(row.modules),
    outcomes: asStringArray(row.outcomes),
    priceEur: row.priceEur,
    priceUsd: row.priceUsd,
    purchaseUrl: row.purchaseUrl,
    active: row.active
  };
}
