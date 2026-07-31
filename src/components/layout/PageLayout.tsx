import { ReactNode, memo } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { PageTransition } from '@/components/PageTransition';

interface PageLayoutProps {
  children: ReactNode;
}

export const PageLayout = memo(function PageLayout({ children }: PageLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <PageTransition>
          {children}
        </PageTransition>
      </div>
    </SidebarProvider>
  );
});
