/**
 * Contenido real de las 13 "academias" del prototipo original (app.js,
 * const ACADEMIES), copiado literalmente vía script (no retranscrito a mano)
 * para garantizar fidelidad — gate funcional D-025: "se mantiene tal cual,
 * sin revisión adicional antes de producción". `id`/`purchaseUrl` conservan
 * el dominio `refactika.com` del prototipo (marca del cliente, Grupo
 * Aspasia) tal como fue aprobado.
 */
export interface OrientadorAcademySeed {
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
  modules: string[];
  outcomes: string[];
  priceEur: string;
  priceUsd: string;
  purchaseUrl: string;
}

export const ORIENTADOR_ACADEMIES: OrientadorAcademySeed[] = [
  {
    id: 'ia-marketing',
    sector: 'marketing',
    name: 'Escuela de IA Aplicada al Marketing',
    shortName: 'IA · Marketing',
    icon: '📣',
    color: '#FF6A00',
    duration: '5 meses',
    durationWeeks: 22,
    synchronous: '3 sesiones/semana en vivo',
    asynchronous: 'Biblioteca de casos + labs 24/7',
    challenge:
      'Lanza una campaña completa con IA generativa para una marca real y defiende el ROI ante un panel.',
    modules: [
      'Fundamentos de IA generativa para marketers',
      'Copywriting avanzado con LLMs',
      'Creatividad visual con IA (image + video)',
      'Automatización de campañas end-to-end',
      'Analítica predictiva y atribución IA',
      'SEO/AEO/GEO — posicionar en la era de la IA'
    ],
    outcomes: [
      'Dominar 15+ herramientas de IA aplicadas',
      'Lanzar campañas 10x más rápido',
      'Reducir 40% el coste de creación de contenido'
    ],
    priceEur: '1.490 €',
    priceUsd: '1.690 USD',
    purchaseUrl: 'https://refactika.com/ia-marketing'
  },
  {
    id: 'ia-desarrollo',
    sector: 'desarrollo',
    name: 'Escuela de IA Aplicada al Desarrollo Web',
    shortName: 'IA · Desarrollo',
    icon: '💻',
    color: '#FF6A00',
    duration: '6 meses',
    durationWeeks: 26,
    synchronous: 'Pair programming 2 veces/semana',
    asynchronous: 'Labs con feedback IA + code reviews',
    challenge:
      'Construye un agente IA funcional con RAG, evals y despliegue productivo. Demuéstralo en Demo Day.',
    modules: [
      'AI-assisted coding (Copilot, Cursor, Claude Code)',
      'Arquitectura de agentes IA (LangChain, MCP)',
      'RAG y vectorización de conocimiento',
      'Fine-tuning y embeddings prácticos',
      'Evals, observability y guardrails',
      'Despliegue productivo (Vercel AI SDK, Bedrock)'
    ],
    outcomes: [
      'Triplicar tu velocidad de desarrollo',
      'Construir productos IA end-to-end',
      'Acceder a perfiles +25K € sobre el mercado'
    ],
    priceEur: '1.890 €',
    priceUsd: '2.090 USD',
    purchaseUrl: 'https://refactika.com/ia-desarrollo'
  },
  {
    id: 'ia-ventas',
    sector: 'ventas',
    name: 'Escuela de IA Aplicada a las Ventas',
    shortName: 'IA · Ventas',
    icon: '💼',
    color: '#FF6A00',
    duration: '4 meses',
    durationWeeks: 18,
    synchronous: '2 sesiones/semana + role-plays IA',
    asynchronous: 'Simuladores de venta + transcripciones IA',
    challenge:
      'Diseña y ejecuta un pipeline de prospección con IA que genere 50 leads cualificados en 30 días.',
    modules: [
      'Prospección automatizada con IA',
      'Lead scoring predictivo',
      'Asistentes de venta y transcripción',
      'Generación de propuestas con IA',
      'CRM con IA (HubSpot, Salesforce)',
      'Análisis y forecasting comercial'
    ],
    outcomes: [
      'Aumentar tu ratio de conversión 25%+',
      'Automatizar 60% de tu trabajo admin',
      'Conseguir perfiles de RevOps (+30% salario)'
    ],
    priceEur: '1.290 €',
    priceUsd: '1.490 USD',
    purchaseUrl: 'https://refactika.com/ia-ventas'
  },
  {
    id: 'ia-logistica',
    sector: 'logistica',
    name: 'Escuela de IA Aplicada a la Logística',
    shortName: 'IA · Logística',
    icon: '📦',
    color: '#FF6A00',
    duration: '5 meses',
    durationWeeks: 22,
    synchronous: 'Case studies semanales + mentoría',
    asynchronous: 'Simuladores de cadena + datos reales',
    challenge: 'Optimiza una cadena de suministro real con IA y presenta el ahorro conseguido.',
    modules: [
      'Forecasting de demanda con ML',
      'Optimización de rutas con IA',
      'Digital twins de supply chain',
      'Computer vision en almacén',
      'Análisis de stocks con IA',
      'KPIs logísticos en tiempo real'
    ],
    outcomes: [
      'Reducir costes logísticos 15-25%',
      'Dominar plataformas líderes (SAP IBP, o9)',
      'Acceder a puestos de Supply Chain Analyst'
    ],
    priceEur: '1.590 €',
    priceUsd: '1.790 USD',
    purchaseUrl: 'https://refactika.com/ia-logistica'
  },
  {
    id: 'ia-gestion',
    sector: 'gestion',
    name: 'Escuela de IA Aplicada a la Administración y Gestión',
    shortName: 'IA · Gestión',
    icon: '📊',
    color: '#FF6A00',
    duration: '5 meses',
    durationWeeks: 22,
    synchronous: 'Workshops ejecutivos semanales',
    asynchronous: 'Simuladores de gestión + casos reales',
    challenge:
      'Diseña un sistema de BI con copilots IA que transforme la toma de decisiones en una pyme real.',
    modules: [
      'BI con IA (Power BI, Tableau Pulse)',
      'Automatización RPA + IA',
      'Análisis financiero con IA generativa',
      'Gestión de proyectos con copilots',
      'Forecasting estratégico con ML',
      'Liderazgo data-driven'
    ],
    outcomes: [
      'Automatizar 50% de tareas de gestión',
      'Dominar copilots de productividad',
      'Acceder a roles de Head of Operations IA'
    ],
    priceEur: '1.690 €',
    priceUsd: '1.890 USD',
    purchaseUrl: 'https://refactika.com/ia-gestion'
  },
  {
    id: 'ia-operaciones',
    sector: 'operaciones',
    name: 'Escuela de IA Aplicada a Operaciones',
    shortName: 'IA · Operaciones',
    icon: '⚙️',
    color: '#FF6A00',
    duration: '5 meses',
    durationWeeks: 22,
    synchronous: '10 sesiones sincrónicas con mentor',
    asynchronous: 'Labs asíncronos + casos reales 24/7',
    challenge:
      'Diseña y despliega un asistente IA para un proceso operativo real y mide su impacto en margen bruto.',
    modules: [
      'Copilots para operaciones y servicios',
      'Mantenimiento predictivo con IA',
      'Automatización con agentes IA',
      'Monitoreo en tiempo real + computer vision',
      'KPIs operativos con analítica IA',
      'Lean + IA como palanca continua'
    ],
    outcomes: [
      'Reducir 15% costes operativos',
      'Dominar copilots operativos',
      'Acceder a roles de Ops Analyst con IA'
    ],
    priceEur: '1.590 €',
    priceUsd: '1.790 USD',
    purchaseUrl: 'https://refactika.com/ia-operaciones'
  },
  {
    id: 'ia-rrhh',
    sector: 'rrhh',
    name: 'Escuela de IA Aplicada a RRHH',
    shortName: 'IA · RRHH',
    icon: '👥',
    color: '#FF6A00',
    duration: '4 meses',
    durationWeeks: 18,
    synchronous: '5 sesiones sincrónicas + role-plays',
    asynchronous: 'Casos de selección y desarrollo + simuladores',
    challenge:
      'Construye un flujo de reclutamiento con IA end-to-end y analiza su impacto en tiempo y calidad del hire.',
    modules: [
      'Reclutamiento con IA (screening, matching)',
      'People analytics con IA generativa',
      'Learning personalizado con copilots',
      'Clima laboral con análisis de sentimiento',
      'Onboarding automatizado',
      'Compensación y carrera data-driven'
    ],
    outcomes: [
      'Reducir 40% tiempo de selección',
      'Personalizar la carrera de cada persona',
      'Acceder a roles HR Analytics'
    ],
    priceEur: '1.290 €',
    priceUsd: '1.490 USD',
    purchaseUrl: 'https://refactika.com/ia-rrhh'
  },
  {
    id: 'ia-factoria',
    sector: 'factoria',
    name: 'Escuela de IA Aplicada a la Factoría de Software',
    shortName: 'IA · Factoría Software',
    icon: '🏭',
    color: '#FF6A00',
    duration: '6 meses',
    durationWeeks: 26,
    synchronous: '10 sesiones sincrónicas + pair programming',
    asynchronous: 'Labs diarios + code reviews con IA',
    challenge:
      'Lidera la transformación de una factoría de software: pipelines IA, code review automático, agentes e indicadores. Demuestra 3x de throughput.',
    modules: [
      'Agentic engineering (MCP, LangChain, autonomía)',
      'CI/CD con agentes IA',
      'AI code review y quality gates',
      'Test generation con IA',
      'Platform engineering + IA',
      'Observabilidad y trust en producción'
    ],
    outcomes: ['Triplicar throughput del equipo', 'Liderar factorías con 30-70 shifts', 'Acceder a roles +60K €'],
    priceEur: '1.890 €',
    priceUsd: '2.090 USD',
    purchaseUrl: 'https://refactika.com/ia-factoria'
  },
  {
    id: 'ia-innovacion',
    sector: 'innovacion',
    name: 'Escuela de IA Aplicada a la Innovación',
    shortName: 'IA · Innovación',
    icon: '💡',
    color: '#FF6A00',
    duration: '5 meses',
    durationWeeks: 22,
    synchronous: '10 sesiones sincrónicas + pitch day',
    asynchronous: 'Prototipado con IA + casos de clientes',
    challenge:
      'Identifica, prototipa y valida una oportunidad de producto con IA en 90 días. Presenta ante panel real.',
    modules: [
      'Prototipado con IA generativa (Bolt, Artifacts, Figma Make)',
      'Descubrimiento de oportunidades con IA',
      'Validación acelerada con usuarios simulados',
      'Design thinking + IA',
      'Métricas de innovación',
      'Venture building con IA'
    ],
    outcomes: [
      'Llegar a MVP 4x más rápido',
      'Validar ideas con datos',
      'Acceder a roles de Product/Innovation Lead'
    ],
    priceEur: '1.790 €',
    priceUsd: '1.990 USD',
    purchaseUrl: 'https://refactika.com/ia-innovacion'
  },
  {
    id: 'ia-finanzas',
    sector: 'finanzas',
    name: 'Escuela de IA Aplicada a Finanzas',
    shortName: 'IA · Finanzas',
    icon: '💰',
    color: '#FF6A00',
    duration: '5 meses',
    durationWeeks: 22,
    synchronous: '10 sesiones sincrónicas + casos financieros reales',
    asynchronous: 'Simuladores financieros + datasets reales',
    challenge:
      'Implementa un sistema de forecasting y reporting financiero con IA. Demuestra ahorro en tiempo de cierre.',
    modules: [
      'FP&A con IA generativa',
      'Cierre contable automatizado',
      'Risk scoring con ML',
      'Financial copilots (Power BI, Tableau)',
      'Tesorería predictiva',
      'Análisis financiero con agentes'
    ],
    outcomes: ['Reducir 50% tiempo de cierre', 'Hacer forecasts en tiempo real', 'Acceder a FP&A leadership'],
    priceEur: '1.790 €',
    priceUsd: '1.990 USD',
    purchaseUrl: 'https://refactika.com/ia-finanzas'
  },
  {
    id: 'ia-sostenibilidad',
    sector: 'sostenibilidad',
    name: 'Escuela de IA Aplicada a Sostenibilidad, RSC y Economía Circular',
    shortName: 'IA · Sostenibilidad',
    icon: '🌱',
    color: '#FF6A00',
    duration: '4 meses',
    durationWeeks: 14,
    synchronous: '5 sesiones sincrónicas + workshops',
    asynchronous: 'Casos ESG y circular + métricas',
    challenge:
      'Diseña un sistema de cálculo de huella + reporting ESG con IA para una empresa real. Entrega el dashboard.',
    modules: [
      'Cálculo de huella con IA',
      'Reporting ESG (CSRD, GRI)',
      'Economía circular con IA',
      'Climate risk modeling',
      'Trazabilidad sostenible',
      'Gobernanza y compliance'
    ],
    outcomes: [
      'Automatizar reporting ESG',
      'Reducir 15-20% huella organizacional',
      'Acceder a ESG + IA roles'
    ],
    priceEur: '1.490 €',
    priceUsd: '1.690 USD',
    purchaseUrl: 'https://refactika.com/ia-sostenibilidad'
  },
  {
    id: 'ia-tecnologia',
    sector: 'tecnologia',
    name: 'Escuela de IA Aplicada a Tecnología (IT)',
    shortName: 'IA · Tecnología',
    icon: '🖥️',
    color: '#FF6A00',
    duration: '6 meses',
    durationWeeks: 26,
    synchronous: '10 sesiones sincrónicas + labs de arquitectura',
    asynchronous: 'Entornos cloud reales + retos de seguridad',
    challenge:
      'Diseña la arquitectura cloud + IA de una empresa real: copilots, seguridad y gobernanza. Demuestra un ROI claro.',
    modules: [
      'Cloud con copilots (AWS, Azure, GCP)',
      'Ciberseguridad con IA (SOC + detección)',
      'Data platforms (Databricks, Snowflake) + IA',
      'MLOps y AIOps en producción',
      'Gobernanza de IA (políticas, acceso, auditoría)',
      'Agentic infra e integración MCP'
    ],
    outcomes: [
      'Arquitectar plataformas IA seguras',
      'Reducir 30% el mean time to detect',
      'Acceder a roles de Cloud/AI Architect'
    ],
    priceEur: '1.890 €',
    priceUsd: '2.090 USD',
    purchaseUrl: 'https://refactika.com/ia-tecnologia'
  },
  {
    id: 'ia-proyectos',
    sector: 'proyectos',
    name: 'Escuela de IA Aplicada a la Gestión de Proyectos',
    shortName: 'IA · Proyectos',
    icon: '📋',
    color: '#FF6A00',
    duration: '4 meses',
    durationWeeks: 18,
    synchronous: '5 sesiones sincrónicas + workshops de gestión',
    asynchronous: 'Simuladores de proyectos + plantillas IA',
    challenge: 'Gestiona un proyecto real usando copilots IA end-to-end. Demuestra ahorros en tiempo y coste.',
    modules: [
      'Copilots de gestión (ClickUp Brain, Notion AI)',
      'Gestión de riesgos con IA',
      'Planificación automática de sprints',
      'Minutas y seguimiento con IA',
      'Comunicación multilingüe IA',
      'Portfolio management con IA'
    ],
    outcomes: [
      'Gestionar proyectos 3x más rápido',
      'Reducir sobrecostes 20%+',
      'Acceder a roles de PMO con IA'
    ],
    priceEur: '1.490 €',
    priceUsd: '1.690 USD',
    purchaseUrl: 'https://refactika.com/ia-proyectos'
  }
];
