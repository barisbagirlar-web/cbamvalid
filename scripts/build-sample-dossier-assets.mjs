import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import canvasModule from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { createCanvas, Image } = canvasModule;
globalThis.Image = Image;

function sha256File(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function srtToVtt(srtContent) {
  let vtt = 'WEBVTT\n\n';
  const blocks = srtContent.replace(/\r/g, '').split('\n\n');
  for (const block of blocks) {
    if (!block.trim()) continue;
    const lines = block.split('\n');
    if (lines.length >= 3) {
      let timestamp = lines[1].replace(/,/g, '.');
      vtt += `${timestamp}\n`;
      vtt += lines.slice(2).join('\n') + '\n\n';
    }
  }
  return vtt;
}

async function processMedia() {
  console.log('Processing media...');
  const srtPath = path.join(__dirname, '..', 'user_desk_video', 'CBAMValid_English_Walkthrough_Subtitles.srt');
  const vttPath = path.join(__dirname, '..', 'public', 'media', 'cbamvalid-product-walkthrough.en.vtt');
  if (fs.existsSync(srtPath)) {
    fs.writeFileSync(vttPath, srtToVtt(fs.readFileSync(srtPath, 'utf8')));
    console.log('  -> Wrote VTT');
  }

  const pngPath = path.join(__dirname, '..', 'CBAMValid_English_A_to_Z_Walkthrough.mp4.png');
  const webpPath = path.join(__dirname, '..', 'public', 'media', 'cbamvalid-product-walkthrough-poster.webp');
  if (fs.existsSync(pngPath)) {
    await sharp(pngPath).webp({ quality: 80 }).toFile(webpPath);
    console.log('  -> Wrote poster WebP');
  }
}

async function processPdf() {
  console.log('Processing PDF...');
  const pdfPath = path.join(__dirname, '..', 'private-assets', 'sample-dossier', 'cbam_rapor_.pdf');
  const outDir = path.join(__dirname, '..', 'public', 'sample-dossier', 'v1', 'pages');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const pdfData = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ 
    data: pdfData, 
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/"
  }).promise;
  const numPages = doc.numPages;

  console.log(`  -> Loaded PDF (${numPages} pages)`);
  
  const manifest = {
    version: 'v1',
    title: 'CBAMValid Sample Dossier',
    language: 'en',
    pageCount: numPages,
    canonicalSha256: sha256File(pdfPath),
    pages: []
  };

  const forbiddenPatterns = [
    /baris/i, /bagirlar/i, /mimar/i, /tr\d/i, /tc\d/i, /@gmail\.com/i
  ];

  let hasError = false;

  class NodeCanvasFactory {
    create(width, height) {
      const canvas = createCanvas(width, height);
      const context = canvas.getContext('2d');
      return { canvas, context };
    }
    reset(canvasAndContext, width, height) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    }
    destroy(canvasAndContext) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  }
  const canvasFactory = new NodeCanvasFactory();

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(item => item.str).join(' ');

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) {
        console.error(`  -> ERROR: Forbidden pattern ${pattern} found on page ${i}`);
        hasError = true;
      }
    }

    const scale = 2.0; 
    const viewport = page.getViewport({ scale });
    
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    const origDrawImage = context.drawImage;
    context.drawImage = function(image, ...args) {
      if (image && image.constructor && image.constructor.name === 'CanvasElement') {
        try {
          const buf = image.toBuffer('image/png');
          const img = new Image();
          img.src = buf;
          return origDrawImage.apply(this, [img, ...args]);
        } catch (e) {
          console.error("Failed to convert CanvasElement:", e.message);
        }
      }
      try {
        return origDrawImage.apply(this, [image, ...args]);
      } catch (err) {
        // Skip incompatible images
      }
    };

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvasFactory: canvasFactory
    }).promise;

    const buffer = canvas.toBuffer('image/png');
    const webpFilename = `page-${String(i).padStart(3, '0')}.webp`;
    const webpPath = path.join(outDir, webpFilename);

    await sharp(buffer).webp({ quality: 85 }).toFile(webpPath);
    
    manifest.pages.push({
      page: i,
      src: `/sample-dossier/v1/pages/${webpFilename}`,
      width: viewport.width,
      height: viewport.height,
      sha256: sha256File(webpPath)
    });
    
    console.log(`  -> Rasterized page ${i}`);
  }

  if (hasError) {
    console.error('Privacy check failed! Found forbidden data in sample PDF.');
    process.exit(1);
  }

  const manifestPath = path.join(__dirname, '..', 'public', 'sample-dossier', 'v1', 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('  -> Wrote manifest.json');
}

async function main() {
  await processMedia();
  await processPdf();
}

main().catch(console.error);
