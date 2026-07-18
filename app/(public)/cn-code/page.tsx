import { redirect } from 'next/navigation';

export async function generateMetadata() {
  return {
    robots: { index: false, follow: true }
  };
}

export default function CnCodeHubPage() {
  redirect('/cn-codes');
}
