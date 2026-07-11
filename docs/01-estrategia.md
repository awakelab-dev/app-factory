# 01 · Estrategia y visión

## El problema

Los gerentes, capacitados en Claude Cowork, generan prototipos que capturan con precisión el conocimiento del negocio — el gap negocio↔desarrollo quedó resuelto en la dirección correcta. Los efectos secundarios son tres:

1. **Sin arquitectura de producción**: prototipos sin API, sin base de datos real, sin seguridad ni escalabilidad. Convertirlos a mano satura al equipo de desarrollo.
2. **Fragmentación**: prototipos que duplican los mismos procesos con interfaces distintas, sin roles ni base común.
3. **Datos sensibles sin control de acceso**.

## La visión

Una **plataforma modular corporativa** + una **fábrica automatizada** que convierte cada prototipo en un módulo de esa plataforma:

- Los tres problemas se resuelven a la vez: la plataforma aporta la arquitectura (API, BD, deploy), el core común (auth, roles, usuarios, UI) elimina la duplicación, y el RBAC central + clasificación de datos controla los accesos.
- El equipo de desarrollo deja de convertir prototipos a mano: pasa a **revisar y aprobar** lo que la fábrica genera.
- El gerente conserva su flujo: prototipa en Cowork, envía a la fábrica desde Cowork, sigue el estado en una URL, y pide cambios futuros también desde Cowork.

## Principio rector: convención sobre configuración

La fábrica funciona porque **restringe el espacio de soluciones**. Un LLM genera código excelente cuando el destino es rígido: un stack único, plantillas de módulo fijas, contratos claros. Cada decisión de estos documentos (stack único TypeScript, PostgreSQL con esquemas explícitos, plantillas de módulo, spec intermedia) existe para reducir grados de libertad, no por preferencia tecnológica.

## Decisiones clave (resumen)

| Tema | Decisión | Detalle |
|---|---|---|
| Modelo | Plataforma modular: 1 frontend shell + 1 API + 1 BD; cada prototipo = un módulo | [03](03-arquitectura.md) |
| Stack | 100% TypeScript: React+Vite, NestJS, PostgreSQL+Prisma, monorepo | [02](02-stack.md) |
| Base de datos | Relacional (PostgreSQL). Tu intuición es correcta: el esquema explícito es una ventaja para la generación con IA, no un obstáculo | [02](02-stack.md) |
| Integración Cowork | Plugin de organización = skill de prototipado + conector MCP contra la API de la fábrica. Sin ZIPs manuales | [04](04-integracion-cowork.md) |
| Conversión | Pipeline con spec intermedia: prototipo → spec → gate humano → generación (Agent SDK headless) → verificación → PR → deploy | [04](04-integracion-cowork.md) |
| Deploy | AWS Lightsail (infra existente del grupo), Docker Compose + GitHub Actions + Nginx nativo, subdominios `*.awkfactory.com`, staging + producción. Lightsail managed PostgreSQL ($30/mes, cifrado, modo privado) desde el día 1; no Aurora | [03](03-arquitectura.md) |
| Mantenimiento | Cambios posteriores desde Cowork vía la misma tool MCP → la fábrica genera una PR sobre el módulo existente | [04](04-integracion-cowork.md) |
| Gobernanza | Gate de spec + revisión de PR. Automática si es trivial; humana obligatoria si hay datos sensibles, migraciones compartidas o complejidad alta | [05](05-gobernanza-seguridad.md) |

## Qué NO es este proyecto

- No es un generador de apps standalone infinitas: eso reproduciría la fragmentación con mejor tecnología.
- No elimina al equipo técnico: lo reposiciona como revisor/arquitecto. El gate humano es parte del diseño, no una limitación temporal.
- No es un producto para el grupo (30 empresas) en su fase inicial. Se diseña para Awakelab; la arquitectura multi-tenant para el grupo es una evolución posible (ver [06](06-roadmap.md)).
