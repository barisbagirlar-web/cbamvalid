import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const pdfPath = path.join(process.cwd(), "scratch", "pdf-pages", "dossier-sample.pdf");
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, disableFontFace: true }).promise;

  console.log(`Analyzing PDF: ${doc.numPages} pages.`);
  let totalOverlaps = 0;
  let totalClipping = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter(item => item.str && item.str.trim());

    console.log(`\n--- PAGE ${i} (${items.length} text items) ---`);
    
    // Sort items by y (top to bottom), then x (left to right)
    // In PDF coordinate space, y = 0 is bottom of page, so top of page has high y.
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 2) return yDiff;
      return a.transform[4] - b.transform[4];
    });

    let pageOverlaps = 0;
    for (let j = 0; j < items.length - 1; j++) {
      const itemA = items[j];
      const itemB = items[j + 1];

      const xA = itemA.transform[4];
      const yA = itemA.transform[5];
      const wA = itemA.width;
      const hA = itemA.height || 8;

      const xB = itemB.transform[4];
      const yB = itemB.transform[5];
      const wB = itemB.width;
      const hB = itemB.height || 8;

      // Check vertical collision (same column / x overlap)
      const sameLine = Math.abs(yA - yB) < 2;
      if (sameLine) {
        // Horizontally overlapping text on the same line
        if (xA + wA > xB + 1 && xA < xB + wB) {
          console.warn(`  [OVERLAP] Page ${i} line overlap between "${itemA.str}" and "${itemB.str}" (x1=${xA.toFixed(1)}, x2=${xB.toFixed(1)})`);
          pageOverlaps++;
        }
      } else {
        // Vertical collision: line above overlapping line below
        // yA is higher on page than yB, so bottom of A is yA, top of B is yB + hB
        if (yA - hA < yB + 1) {
          // Check horizontal overlap
          if (xA < xB + wB && xA + wA > xB) {
            console.warn(`  [VERTICAL COLLISION] Page ${i}: "${itemA.str}" (y=${yA.toFixed(1)}) collides vertically with "${itemB.str}" (y=${yB.toFixed(1)})`);
            pageOverlaps++;
          }
        }
      }

      // Check if text exceeds printable page width (210mm = ~595 pt)
      if (xA + wA > 570) {
        console.warn(`  [PAGE CLIP] Page ${i}: "${itemA.str}" extends past right margin (xEnd=${(xA + wA).toFixed(1)})`);
        totalClipping++;
      }
    }

    if (pageOverlaps === 0) {
      console.log(`  ✓ Page ${i}: No text collisions detected.`);
    } else {
      totalOverlaps += pageOverlaps;
    }
  }

  console.log(`\n==========================================`);
  console.log(`TOTAL OVERLAPS: ${totalOverlaps}`);
  console.log(`TOTAL CLIPPING: ${totalClipping}`);
  console.log(`==========================================`);
}

main().catch(console.error);
