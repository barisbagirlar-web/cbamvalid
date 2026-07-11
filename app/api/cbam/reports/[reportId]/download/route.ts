import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/get-server-session";
import { getAdminDb } from "@/lib/firebase/admin";
import { buildPdfDossier } from "@/lib/cbam/report/pdf-builder";
import { buildWorkbook } from "@/lib/cbam/report/workbook-builder";
import { buildXml } from "@/lib/cbam/report/xml-builder";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ reportId: string }> }) {
  try {
    const params = await props.params;
    const reportId = params.reportId;
    
    // 1. Session check
    const session = await getServerSession();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    // 2. Fetch report
    const doc = await getAdminDb().collection("cbam_reports").doc(reportId).get();
    if (!doc.exists) {
      return new Response("Report not found", { status: 404 });
    }

    const report = doc.data() as any;

    // 3. Confirm ownership
    if (report.uid !== session.uid) {
      return new Response("Forbidden", { status: 403 });
    }

    // 4. Retrieve format type parameter
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (!type || !["pdf", "xlsx", "xml", "json"].includes(type)) {
      return new Response("Invalid type parameter", { status: 400 });
    }

    // Reconstruct artifacts dynamically using sealed record data
    if (type === "pdf") {
      const buffer = buildPdfDossier(report.calculation.inputs, report.calculation, report.documentHash);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="CBAM_Dossier_${reportId}.pdf"`,
        },
      });
    }

    if (type === "xlsx") {
      const buffer = buildWorkbook(report.calculation.inputs, report.calculation);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="CBAM_Workbook_${reportId}.xls"`, // XML Spreadsheet 2003
        },
      });
    }

    if (type === "xml") {
      const xmlString = buildXml(report.calculation.inputs, report.calculation, report.documentHash);
      return new Response(xmlString, {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": `attachment; filename="CBAM_Declaration_${reportId}.xml"`,
        },
      });
    }

    if (type === "json") {
      const jsonString = JSON.stringify({ data: report.calculation.inputs, calculation: report.calculation }, null, 2);
      return new Response(jsonString, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="CBAM_Data_${reportId}.json"`,
        },
      });
    }

    return new Response("Unsupported format", { status: 400 });

  } catch (error: any) {
    console.error("[REPORT DOWNLOAD ENDPOINT ERROR]:", error.message || error);
    return new Response(error.message || "Failed to download file", { status: 500 });
  }
}
