/**
 * G-17 — PDF/A-3b archive hardening: embedded source data and XMP metadata.
 *
 * jsPDF output is post-processed with pdf-lib (user-approved approach): the
 * data integrity manifest, calculation trace/graph and the verification CLI
 * are embedded as PDF attachments, and PDF/A XMP metadata (dc:title,
 * dc:creator, dc:description, pdf:Producer, xmp:CreateDate, custom
 * cbamvalid:* namespace) is attached to the catalog. A reader can extract the
 * attachments from Acrobat's "Attachments" panel and re-verify the package.
 */
import { PDFDocument, PDFName, type PDFArray, type PDFDict, type PDFStream } from "pdf-lib";
import { inflateSync } from "node:zlib";

export interface ArchiveAttachment {
  readonly fileName: string;
  readonly mimeType: string;
  readonly description: string;
  readonly bytes: Uint8Array;
}

export interface ArchiveXmpParams {
  readonly title: string;
  readonly creator: string;
  readonly description: string;
  readonly producer: string;
  readonly createDate: string;
  readonly reportId: string;
  readonly packageCode: string;
  readonly calculationRootHash: string;
}

const XML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => XML_ESCAPE[ch] ?? ch);
}

/**
 * PDF/A XMP packet covering the mandatory core fields plus the custom
 * cbamvalid namespace that ties the document to its sealed report.
 */
export function buildArchiveXmpMetadata(params: ArchiveXmpParams): string {
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="CBAMValid">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:cbamvalid="https://cbamvalid.app/ns/1.0">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(params.title)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${xmlEscape(params.creator)}</rdf:li></rdf:Seq></dc:creator>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${xmlEscape(params.description)}</rdf:li></rdf:Alt></dc:description>
   <pdf:Producer>${xmlEscape(params.producer)}</pdf:Producer>
   <xmp:CreateDate>${xmlEscape(params.createDate)}</xmp:CreateDate>
   <cbamvalid:reportId>${xmlEscape(params.reportId)}</cbamvalid:reportId>
   <cbamvalid:packageCode>${xmlEscape(params.packageCode)}</cbamvalid:packageCode>
   <cbamvalid:calculationRootHash>${xmlEscape(params.calculationRootHash)}</cbamvalid:calculationRootHash>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function embedArchiveAttachments(
  pdfBytes: Uint8Array,
  attachments: readonly ArchiveAttachment[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  for (const attachment of attachments) {
    await pdfDoc.attach(attachment.bytes, attachment.fileName, {
      mimeType: attachment.mimeType,
      description: attachment.description,
    });
  }
  return pdfDoc.save();
}

export async function embedXmpMetadata(pdfBytes: Uint8Array, xmpXml: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  // Uncompressed XMP packet per the PDF/A conventions so it stays readable
  // without a flate filter.
  const xmpStream = pdfDoc.context.stream(new TextEncoder().encode(xmpXml), {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  });
  pdfDoc.catalog.set(PDFName.of("Metadata"), xmpStream);
  return pdfDoc.save();
}

export interface ExtractedArchiveAttachment {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/**
 * Programmatic extraction of embedded attachments (mirrors what Acrobat's
 * "Attachments" panel exposes). Returns every EmbeddedFiles name/filespec pair.
 */
export async function extractArchiveAttachments(
  pdfBytes: Uint8Array
): Promise<ExtractedArchiveAttachment[]> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const extracted: ExtractedArchiveAttachment[] = [];
  const namesDict = pdfDoc.catalog.lookup(PDFName.of("Names")) as PDFDict | undefined;
  if (!namesDict) return extracted;
  const embeddedFiles = namesDict.lookup(PDFName.of("EmbeddedFiles")) as PDFDict | undefined;
  if (!embeddedFiles) return extracted;
  const pairs = embeddedFiles.lookup(PDFName.of("Names")) as PDFArray | undefined;
  if (!pairs) return extracted;
  for (let index = 0; index + 1 < pairs.size(); index += 2) {
    const fileSpec = pairs.lookup(index + 1) as PDFDict | undefined;
    if (!fileSpec) continue;
    const ef = fileSpec.lookup(PDFName.of("EF")) as PDFDict | undefined;
    if (!ef) continue;
    const stream = ef.lookup(PDFName.of("F")) as PDFStream | undefined;
    if (!stream) continue;
    const nameEntry = pairs.lookup(index);
    const fileName =
      nameEntry &&
      typeof (nameEntry as unknown as { decodeText?: () => string }).decodeText === "function"
        ? (nameEntry as unknown as { decodeText: () => string }).decodeText()
        : "attachment";
    let bytes = stream.getContents();
    try {
      // Embedded file streams are FlateDecode-compressed by pdf-lib.
      bytes = inflateSync(bytes);
    } catch {
      // Already-plain stream: keep as-is.
    }
    extracted.push({ fileName, bytes });
  }
  return extracted;
}
