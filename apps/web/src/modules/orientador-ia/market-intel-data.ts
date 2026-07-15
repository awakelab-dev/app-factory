import type { OrientadorSector } from '@awk/types';

/**
 * Datos de "Inteligencia de mercado" (D-028) — sección pública y libre
 * (sin login, sin entrevista) que replica la pantalla homónima del
 * prototipo original de Refactika (`legacy/backend/uploads/*orientadorRefactika.zip`,
 * componente `MarketIntel` en `app.js`). Solo mercado España (D-025: single
 * mercado; el toggle "LATAM" del header ya muestra "Próximamente").
 *
 * Los números (ofertas, salarios, % IA, empresas, ciudades, skills) son el
 * contenido original del prototipo — no provienen de una fuente de datos
 * viva todavía. Si en el futuro se conecta una fuente real (SEPE, InfoJobs,
 * LinkedIn Economic Graph...), este archivo es el único punto de cambio.
 */
export interface SectorMarketData {
  tagline: string;
  aiImpact: string;
  offers: number;
  aiOffers: number;
  avgSalaryEur: number;
  growthPct: number;
  cities: Array<[city: string, weight: number]>;
  companies: string[];
  hotSkills: Array<{ skill: string; demand: number }>;
  trends: Array<{ label: string; value: string }>;
}

export const MARKET_DATA: Record<OrientadorSector, SectorMarketData> = {
  marketing: {
    tagline: 'Vender en la era de la IA generativa',
    aiImpact: 'Alto',
    offers: 8420,
    aiOffers: 3240,
    avgSalaryEur: 38500,
    growthPct: 18,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 92],
      ['Valencia', 58],
      ['Sevilla', 52],
      ['Bilbao', 48],
      ['Málaga', 44]
    ],
    companies: ['Telefónica', 'Inditex', 'Banco Santander', 'BBVA', 'Mahou San Miguel', 'El Corte Inglés'],
    hotSkills: [
      { skill: 'Generative AI content', demand: 96 },
      { skill: 'Prompt engineering', demand: 92 },
      { skill: 'Marketing automation IA', demand: 88 },
      { skill: 'Atribución con ML', demand: 76 },
      { skill: 'AEO / GEO (SEO para IA)', demand: 72 },
      { skill: 'Vídeo generativo', demand: 68 }
    ],
    trends: [
      { label: 'IA generativa aplicada al contenido', value: '+148%' },
      { label: 'Marketing automation con IA', value: '+92%' },
      { label: 'Vídeo generativo', value: '+210%' }
    ]
  },
  desarrollo: {
    tagline: 'Construir software con IA como copiloto',
    aiImpact: 'Muy alto',
    offers: 15280,
    aiOffers: 7100,
    avgSalaryEur: 48900,
    growthPct: 32,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 96],
      ['Valencia', 64],
      ['Bilbao', 56],
      ['Sevilla', 50],
      ['Zaragoza', 42]
    ],
    companies: ['Telefónica Tech', 'BBVA', 'Glovo', 'Cabify', 'Tuenti', 'Idealista'],
    hotSkills: [
      { skill: 'AI agents / LangChain', demand: 98 },
      { skill: 'Copilot workflows', demand: 95 },
      { skill: 'RAG + vector DBs', demand: 92 },
      { skill: 'Fine-tuning y embeddings', demand: 84 },
      { skill: 'Evals & observability', demand: 78 },
      { skill: 'MCP / model integration', demand: 74 }
    ],
    trends: [
      { label: 'Desarrolladores con IA', value: '+182%' },
      { label: 'Ingeniería de prompts', value: '+240%' },
      { label: 'AI agents engineering', value: '+310%' }
    ]
  },
  ventas: {
    tagline: 'Cerrar más con menos, con IA',
    aiImpact: 'Alto',
    offers: 9840,
    aiOffers: 2100,
    avgSalaryEur: 35200,
    growthPct: 14,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 88],
      ['Valencia', 60],
      ['Sevilla', 56],
      ['Málaga', 50],
      ['Bilbao', 46]
    ],
    companies: ['Salesforce Iberia', 'HubSpot España', 'SAP Iberia', 'Oracle', 'Microsoft', 'Cisco España'],
    hotSkills: [
      { skill: 'Revenue Operations', demand: 92 },
      { skill: 'AI-powered prospecting', demand: 88 },
      { skill: 'Conversational AI', demand: 82 },
      { skill: 'CRM + IA (HubSpot, Salesforce)', demand: 80 },
      { skill: 'Sales forecasting ML', demand: 72 },
      { skill: 'Call analytics (Gong, Chorus)', demand: 70 }
    ],
    trends: [
      { label: 'Sales ops con IA', value: '+96%' },
      { label: 'Revenue operations', value: '+72%' },
      { label: 'Conversational AI sales', value: '+134%' }
    ]
  },
  logistica: {
    tagline: 'Optimización inteligente de la cadena',
    aiImpact: 'Alto',
    offers: 6210,
    aiOffers: 980,
    avgSalaryEur: 32800,
    growthPct: 11,
    cities: [
      ['Valencia', 100],
      ['Barcelona', 96],
      ['Madrid', 88],
      ['Algeciras', 70],
      ['Zaragoza', 60],
      ['Bilbao', 52]
    ],
    companies: ['SEUR', 'Inditex Logística', 'DHL España', 'Correos Express', 'ID Logistics', 'Maersk España'],
    hotSkills: [
      { skill: 'Demand forecasting ML', demand: 88 },
      { skill: 'Route optimization IA', demand: 82 },
      { skill: 'Digital twins supply chain', demand: 76 },
      { skill: 'Computer vision almacén', demand: 70 },
      { skill: 'SAP IBP / o9 platforms', demand: 68 },
      { skill: 'Sustainable logistics', demand: 64 }
    ],
    trends: [
      { label: 'Supply chain analytics', value: '+88%' },
      { label: 'Last-mile con IA', value: '+112%' },
      { label: 'Warehouse automation', value: '+70%' }
    ]
  },
  gestion: {
    tagline: 'Dirigir con datos y copilotos IA',
    aiImpact: 'Muy alto',
    offers: 7180,
    aiOffers: 2460,
    avgSalaryEur: 42400,
    growthPct: 21,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 88],
      ['Bilbao', 56],
      ['Valencia', 52],
      ['Sevilla', 46],
      ['Málaga', 40]
    ],
    companies: ['Deloitte', 'EY España', 'KPMG España', 'BBVA', 'Banco Santander', 'Mapfre'],
    hotSkills: [
      { skill: 'BI con copilots IA', demand: 94 },
      { skill: 'FP&A con IA', demand: 88 },
      { skill: 'Process automation (RPA+IA)', demand: 82 },
      { skill: 'Power BI Copilot', demand: 80 },
      { skill: 'Notion AI / ClickUp Brain', demand: 74 },
      { skill: 'Strategic forecasting ML', demand: 70 }
    ],
    trends: [
      { label: 'FP&A con IA', value: '+102%' },
      { label: 'BI + copilots', value: '+156%' },
      { label: 'Process automation', value: '+84%' }
    ]
  },
  operaciones: {
    tagline: 'Fábricas, servicios y procesos con IA',
    aiImpact: 'Alto',
    offers: 5920,
    aiOffers: 1460,
    avgSalaryEur: 38200,
    growthPct: 17,
    cities: [
      ['Barcelona', 100],
      ['Madrid', 92],
      ['Valencia', 70],
      ['Bilbao', 60],
      ['Zaragoza', 54],
      ['Sevilla', 48]
    ],
    companies: ['Repsol', 'Iberdrola', 'Ferrovial', 'Acciona', 'Naturgy', 'Mercadona'],
    hotSkills: [
      { skill: 'Asistentes IA para operaciones', demand: 92 },
      { skill: 'Mantenimiento predictivo', demand: 88 },
      { skill: 'Automatización con agentes', demand: 82 },
      { skill: 'Computer vision operativa', demand: 76 },
      { skill: 'Lean + IA', demand: 72 },
      { skill: 'IoT + edge AI', demand: 68 }
    ],
    trends: [
      { label: 'Copilots operativos', value: '+118%' },
      { label: 'Predictive maintenance', value: '+92%' },
      { label: 'Process automation', value: '+104%' }
    ]
  },
  rrhh: {
    tagline: 'Personas y talento potenciados por IA',
    aiImpact: 'Alto',
    offers: 4820,
    aiOffers: 1280,
    avgSalaryEur: 36800,
    growthPct: 19,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 84],
      ['Valencia', 52],
      ['Bilbao', 48],
      ['Sevilla', 42],
      ['Málaga', 38]
    ],
    companies: ['Adecco España', 'Randstad España', 'Manpower España', 'Hays España', 'Page Group', 'Eurofirms'],
    hotSkills: [
      { skill: 'Reclutamiento con IA', demand: 90 },
      { skill: 'People analytics', demand: 86 },
      { skill: 'Learning personalizado con IA', demand: 82 },
      { skill: 'Clima + sentimiento IA', demand: 76 },
      { skill: 'Compensación data-driven', demand: 70 },
      { skill: 'Onboarding con agentes', demand: 66 }
    ],
    trends: [
      { label: 'People analytics con IA', value: '+124%' },
      { label: 'Talent matching IA', value: '+98%' },
      { label: 'Learning personalizado', value: '+142%' }
    ]
  },
  factoria: {
    tagline: 'Software con IA de inicio a fin',
    aiImpact: 'Muy alto',
    offers: 11240,
    aiOffers: 5620,
    avgSalaryEur: 52600,
    growthPct: 36,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 98],
      ['Sevilla', 60],
      ['Valencia', 58],
      ['Bilbao', 50],
      ['Málaga', 46]
    ],
    companies: ['NTT Data Spain', 'Indra', 'Capgemini Iberia', 'Everis', 'Globant Iberia', 'Accenture'],
    hotSkills: [
      { skill: 'Agentic software engineering', demand: 96 },
      { skill: 'AI pair programming', demand: 92 },
      { skill: 'DevOps + IA', demand: 86 },
      { skill: 'Test generation con IA', demand: 82 },
      { skill: 'Platform engineering', demand: 78 },
      { skill: 'AI observability', demand: 72 }
    ],
    trends: [
      { label: 'Agentic engineering', value: '+286%' },
      { label: 'AI code review', value: '+168%' },
      { label: 'Testing con IA', value: '+94%' }
    ]
  },
  innovacion: {
    tagline: 'Diseñar el próximo producto con IA',
    aiImpact: 'Muy alto',
    offers: 3920,
    aiOffers: 1820,
    avgSalaryEur: 48400,
    growthPct: 28,
    cities: [
      ['Barcelona', 100],
      ['Madrid', 96],
      ['Valencia', 60],
      ['Bilbao', 54],
      ['Málaga', 48],
      ['Zaragoza', 40]
    ],
    companies: [
      'Telefónica Innovation',
      'BBVA Next',
      'Banco Santander X',
      'Repsol Lab',
      'Iberdrola Ventures',
      'Bankinter Innov.'
    ],
    hotSkills: [
      { skill: 'Prototipado generativo', demand: 94 },
      { skill: 'Product discovery IA', demand: 88 },
      { skill: 'Validación acelerada', demand: 80 },
      { skill: 'Design systems IA', demand: 74 },
      { skill: 'Innovation metrics', demand: 68 },
      { skill: 'Venture building con IA', demand: 64 }
    ],
    trends: [
      { label: 'Rapid prototyping con IA', value: '+212%' },
      { label: 'AI product discovery', value: '+158%' },
      { label: 'Synthetic user research', value: '+96%' }
    ]
  },
  finanzas: {
    tagline: 'Finanzas inteligentes con IA',
    aiImpact: 'Muy alto',
    offers: 8640,
    aiOffers: 2980,
    avgSalaryEur: 49200,
    growthPct: 24,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 86],
      ['Bilbao', 64],
      ['Valencia', 50],
      ['Málaga', 42],
      ['Sevilla', 40]
    ],
    companies: ['BBVA', 'Banco Santander', 'CaixaBank', 'Bankinter', 'Mapfre', 'Sabadell'],
    hotSkills: [
      { skill: 'FP&A con IA', demand: 94 },
      { skill: 'Forecasting automatizado', demand: 88 },
      { skill: 'Risk scoring ML', demand: 84 },
      { skill: 'Financial copilots', demand: 80 },
      { skill: 'Cierre automatizado', demand: 74 },
      { skill: 'Tesorería predictiva', demand: 68 }
    ],
    trends: [
      { label: 'FP&A con IA', value: '+142%' },
      { label: 'Risk scoring ML', value: '+98%' },
      { label: 'Financial copilots', value: '+176%' }
    ]
  },
  sostenibilidad: {
    tagline: 'Impacto positivo acelerado con IA',
    aiImpact: 'Alto',
    offers: 2840,
    aiOffers: 780,
    avgSalaryEur: 40800,
    growthPct: 26,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 92],
      ['Valencia', 60],
      ['Sevilla', 54],
      ['Bilbao', 50],
      ['Zaragoza', 42]
    ],
    companies: ['Iberdrola', 'Acciona', 'Naturgy', 'Repsol', 'Endesa', 'Ferrovial'],
    hotSkills: [
      { skill: 'ESG reporting IA', demand: 86 },
      { skill: 'Huella carbono automatizada', demand: 82 },
      { skill: 'Economía circular IA', demand: 78 },
      { skill: 'Climate risk ML', demand: 74 },
      { skill: 'Trazabilidad sostenible', demand: 68 },
      { skill: 'Compliance CSRD/GRI', demand: 62 }
    ],
    trends: [
      { label: 'ESG reporting con IA', value: '+156%' },
      { label: 'Circular economy IA', value: '+92%' },
      { label: 'Climate analytics', value: '+118%' }
    ]
  },
  tecnologia: {
    tagline: 'Infra, cloud, datos y ciberseguridad con IA',
    aiImpact: 'Muy alto',
    offers: 13200,
    aiOffers: 6240,
    avgSalaryEur: 50600,
    growthPct: 31,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 94],
      ['Bilbao', 60],
      ['Valencia', 56],
      ['Sevilla', 48],
      ['Zaragoza', 42]
    ],
    companies: ['AWS Spain', 'Microsoft Iberia', 'Google Cloud España', 'Telefónica Tech', 'IBM España', 'Oracle Iberia'],
    hotSkills: [
      { skill: 'Cloud con copilots (AWS, Azure)', demand: 94 },
      { skill: 'Ciberseguridad con IA', demand: 92 },
      { skill: 'Data platforms + IA', demand: 88 },
      { skill: 'MLOps / AIOps', demand: 82 },
      { skill: 'Gobierno de IA', demand: 74 },
      { skill: 'Arquitectura de agentes', demand: 70 }
    ],
    trends: [
      { label: 'AI-driven cloud architecture', value: '+148%' },
      { label: 'Ciberseguridad con IA', value: '+176%' },
      { label: 'MLOps / AIOps', value: '+124%' }
    ]
  },
  proyectos: {
    tagline: 'Dirigir proyectos 3x más rápido con IA',
    aiImpact: 'Alto',
    offers: 6420,
    aiOffers: 2140,
    avgSalaryEur: 44200,
    growthPct: 22,
    cities: [
      ['Madrid', 100],
      ['Barcelona', 86],
      ['Bilbao', 52],
      ['Valencia', 50],
      ['Sevilla', 46],
      ['Zaragoza', 38]
    ],
    companies: ['Accenture', 'Deloitte España', 'EY España', 'KPMG España', 'PwC España', 'Capgemini'],
    hotSkills: [
      { skill: 'Project copilots (ClickUp, Notion)', demand: 90 },
      { skill: 'Gestión de riesgos con IA', demand: 84 },
      { skill: 'Sprints con IA', demand: 80 },
      { skill: 'Minutas automáticas', demand: 76 },
      { skill: 'Comunicación multilingüe IA', demand: 68 },
      { skill: 'Portfolio management IA', demand: 64 }
    ],
    trends: [
      { label: 'Project copilots', value: '+156%' },
      { label: 'Risk prediction con IA', value: '+104%' },
      { label: 'Agile + IA', value: '+92%' }
    ]
  }
};

/** Mensajes tipo "lo que dice el mercado" (McKinsey 2026, prototipo original). */
export const MARKET_INTRO_THEMES = [
  {
    title: 'La ventaja no es la tecnología, son las capacidades.',
    detail: 'Quien aprende a usar la IA con método gana. Quien no, queda atrás.'
  },
  {
    title: 'Cada transformación es una transformación de personas.',
    detail: 'El 78% de los perfiles senior ya usan IA a diario. ¿Y tú?'
  }
];

/** Fuentes citadas al pie (España + globales, prototipo original). */
export const MARKET_SOURCES = [
  { name: 'LinkedIn', desc: 'Red profesional global' },
  { name: 'InfoJobs', desc: 'Portal líder en España' },
  { name: 'SEPE', desc: 'Servicio Público de Empleo Estatal' },
  { name: 'Indeed', desc: 'Agregador global' },
  { name: 'McKinsey Global Institute', desc: 'Workforce of the future + AI impact' },
  { name: 'World Economic Forum', desc: 'Future of Jobs Report 2026' },
  { name: 'Stanford HAI Index', desc: 'AI Index Report — indicadores globales' },
  { name: 'GitHub Octoverse', desc: 'Tendencias globales de desarrollo' }
];
