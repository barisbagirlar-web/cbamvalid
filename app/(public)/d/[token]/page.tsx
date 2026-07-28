import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ token: string }>;
};

/**
 * R7 short buyer share surface.
 * Canonical integrity view remains /verify/[publicToken]; /d/[token] is the short link alias.
 */
export default async function BuyerShareAliasPage({ params }: PageProps) {
  const { token } = await params;
  if (!token || token.trim().length === 0) {
    redirect("/verify");
  }
  redirect(`/verify/${encodeURIComponent(token.trim())}`);
}
