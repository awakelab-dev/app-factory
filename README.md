# AwkFactory

Plataforma modular corporativa + fábrica que convierte prototipos de Claude Cowork en módulos de producción.

- **Empezar por**: [`CLAUDE.md`](CLAUDE.md) (protocolo de trabajo) y [`docs/`](docs/README.md) (estrategia completa).
- **Estado actual**: [`docs/STATUS.md`](docs/STATUS.md).
- `legacy/`: prototipo original (Express+Mongo+React). Solo referencia conceptual — el dashboard de seguimiento se reconstruirá en Fase 1 sobre el stack estándar. No usar como base de código.

## Monorepo (pnpm + Turborepo)

```
apps/web        Shell React+Vite+Tailwind v4 (marca Awakelab 2026)
apps/api        API NestJS + Prisma (PostgreSQL)
packages/types  Contratos Zod compartidos front↔back
packages/ui     Componentes de marca (patrón shadcn/ui) + tokens Tailwind
packages/auth   Stub de auth (contratos JWT/roles; IdP pendiente)
```

```bash
pnpm install
pnpm dev        # api en :3000, web en :5173 (proxy /api)
pnpm build && pnpm test && pnpm lint && pnpm typecheck
```

Requisitos: Node ≥22, pnpm 11.
