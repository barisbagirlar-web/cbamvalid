import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CBAM Emissions Calculator Widget',
  description: 'Embeddable CBAM carbon cost calculator for customs and logistics platforms.',
  robots: { index: false, follow: false },
};

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
