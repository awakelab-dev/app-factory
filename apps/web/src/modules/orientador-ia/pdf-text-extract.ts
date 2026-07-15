/**
 * Extracción de texto de un CV en PDF, 100% client-side (spec técnica,
 * "Extracción de CV/LinkedIn"): el backend solo recibe el texto ya extraído,
 * nunca el PDF binario — reduce la superficie de datos personales que toca
 * la API. `pdfjs-dist` corre en un worker separado (config recomendada por el
 * propio proyecto para bundlers tipo Vite: URL del worker vía `import.meta.url`).
 *
 * Import DINÁMICO a propósito (no en el top-level del módulo): el propio
 * módulo de pdfjs-dist toca `DOMMatrix`/canvas al cargarse, que no existe en
 * jsdom (entorno de los tests, ver src/test/setup.ts) — cargarlo solo cuando
 * el candidato de verdad sube un PDF evita que toda la suite de tests del
 * shell (que importa <App/> y por tanto este módulo transitivamente) reviente
 * por un side-effect de una dependencia que la mayoría de tests ni ejercita.
 */
const MAX_CHARS = 2000; // mismo tope que rawInputText en @awk/types (orientadorIntakeRequestSchema)

export async function extractPdfText(file: File): Promise<string> {
  const { GlobalWorkerOptions, getDocument } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pageTexts.push(text);
  }

  const fullText = pageTexts.join('\n').replace(/\s+/g, ' ').trim();
  if (!fullText) {
    throw new Error('No se pudo extraer texto de este PDF (¿es una imagen escaneada sin texto?).');
  }
  return fullText.slice(0, MAX_CHARS);
}
