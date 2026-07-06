import path from 'node:path';
import { expect, type Page } from '@playwright/test';

const PDFJS_STANDARD_FONTS = path.join(
  process.cwd(),
  'node_modules/pdfjs-dist/standard_fonts/',
);

async function readPdfBlobFromReactPdf(page: Page): Promise<Uint8Array | null> {
  const bytes = await page.evaluate(async () => {
    const doc = document.querySelector('.react-pdf__Document');
    if (!doc) return null;

    const fiberKey = Object.keys(doc).find((key) => key.startsWith('__reactFiber$'));
    if (!fiberKey) return null;

    let fiber: { memoizedProps?: { file?: Blob | string }; return?: unknown } | null =
      (doc as unknown as Record<string, unknown>)[fiberKey] as typeof fiber;

    while (fiber) {
      const file = fiber.memoizedProps?.file;
      if (file instanceof Blob) {
        const buffer = await file.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      }
      if (typeof file === 'string' && file.startsWith('blob:')) {
        const response = await fetch(file);
        const buffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(buffer));
      }
      fiber = fiber.return as typeof fiber;
    }

    return null;
  });

  return bytes ? Uint8Array.from(bytes) : null;
}

async function readPdfBytesFromPage(page: Page): Promise<Uint8Array | null> {
  const fromReactPdf = await readPdfBlobFromReactPdf(page);
  if (fromReactPdf) return fromReactPdf;

  const bytes = await page.evaluate(async () => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const blobUrls = resources
      .map((entry) => entry.name)
      .filter((name) => name.startsWith('blob:'));

    for (let i = blobUrls.length - 1; i >= 0; i--) {
      try {
        const response = await fetch(blobUrls[i]);
        const buffer = await response.arrayBuffer();
        const header = new Uint8Array(buffer.slice(0, 5));
        const isPdf =
          header.length >= 4 &&
          header[0] === 0x25 &&
          header[1] === 0x50 &&
          header[2] === 0x44 &&
          header[3] === 0x46;
        if (isPdf) {
          return Array.from(new Uint8Array(buffer));
        }
      } catch {
        // try older blob entries
      }
    }
    return null;
  });

  return bytes ? Uint8Array.from(bytes) : null;
}

export async function extractPdfText(page: Page): Promise<string> {
  await expect(
    page.locator('.react-pdf__Page canvas, .react-pdf__Page_afterload canvas').first(),
  ).toBeVisible({ timeout: 45_000 });

  let pdfBytes: Uint8Array | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    pdfBytes = await readPdfBytesFromPage(page);
    if (pdfBytes) break;
    await page.waitForTimeout(750);
  }

  expect(pdfBytes, 'PDF blob should be available on print view').toBeTruthy();

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: pdfBytes!,
    standardFontDataUrl: PDFJS_STANDARD_FONTS,
    useSystemFonts: true,
  }).promise;

  let text = '';
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const pdfPage = await doc.getPage(pageNum);
    const content = await pdfPage.getTextContent();
    text += content.items
      .map((item) => ('str' in item ? String(item.str) : ''))
      .join(' ');
    text += '\n';
  }

  return text.replace(/\s+/g, ' ').trim();
}

export async function assertPdfContains(
  page: Page,
  expectedTexts: readonly string[],
): Promise<string> {
  const pdfText = await extractPdfText(page);
  const normalizedPdf = pdfText.toLowerCase();

  for (const expected of expectedTexts) {
    expect(
      normalizedPdf.includes(expected.toLowerCase()),
      `PDF text should contain "${expected}". Got excerpt: ${pdfText.slice(0, 500)}`,
    ).toBe(true);
  }

  return pdfText;
}
