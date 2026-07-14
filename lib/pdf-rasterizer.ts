import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";
import fs from "fs";

export async function rasterizePdfToWebPBuffers(pdfBuffer: Buffer): Promise<Buffer[]> {
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data, disableFontFace: true, standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/" });
  const pdfDocument = await loadingTask.promise;
  
  const numPages = pdfDocument.numPages;
  const webPBuffers: Buffer[] = [];
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    // 200 DPI roughly translates to scale = 2.0 to 2.5 (standard is 72 DPI)
    const scale = 2.0; 
    const viewport = page.getViewport({ scale });
    
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    
    await page.render({
      canvasContext: context as any,
      viewport: viewport,
    } as any).promise;
    
    // Convert to WebP buffer
    // canvas.toBuffer can output image/jpeg or image/png. canvas may not support webp natively without specific build flags.
    // Let's use image/jpeg with high quality for now if webp is unsupported, or we can use sharp. 
    // The requirement says "WebP or optimized PNG". 
    // node-canvas supports PNG natively.
    const imageBuffer = canvas.toBuffer("image/png", { resolution: 200 });
    webPBuffers.push(imageBuffer);
  }
  
  return webPBuffers;
}
