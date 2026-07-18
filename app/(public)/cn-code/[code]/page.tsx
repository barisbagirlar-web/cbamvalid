import { redirect } from 'next/navigation';
import { getCnCodeEntry } from '@/lib/cbam/cn-codes/cn-code-registry';

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata() {
  return {
    robots: { index: false, follow: true }
  };
}

export default async function CNCodeLandingPage({ params }: PageProps) {
  const { code } = await params;
  const entry = getCnCodeEntry(code);

  if (entry) {
    redirect(`/cn-codes/${code}/${entry.sector}`);
  } else {
    redirect('/cn-codes');
  }
}
