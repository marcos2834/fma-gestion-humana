// Genera un PDF desde HTML usando Puppeteer + Chromium serverless (compatible Vercel).
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';

chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

// URL del binario de Chromium pre-empaquetado para serverless.
// Mantener versión sincronizada con @sparticuz/chromium-min.
const CHROMIUM_PACK_URL = 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

export async function generatePDF(html) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--font-render-hinting=none',
        '--disable-dev-shm-usage'
      ],
      defaultViewport: { width: 794, height: 1123 }, // A4 a 96 DPI
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Cargar HTML y esperar a que renderice las fuentes/CSS
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 25000
    });

    // Forzar uso del CSS @media print
    await page.emulateMediaType('print');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) { /* no-op */ }
    }
  }
}
