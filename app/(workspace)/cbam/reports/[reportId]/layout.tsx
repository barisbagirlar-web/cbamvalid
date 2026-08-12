import type { ReactNode } from "react";
import { ShareLinksPanel } from "@/components/verify/ShareLinksPanel";

export default async function SealedReportLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return (
    <>
      {children}
      <div className="bg-background px-4 pb-10 md:px-8">
        <ShareLinksPanel reportId={reportId} />
      </div>
    </>
  );
}
