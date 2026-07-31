import { PageLayout, PageHeader } from '@/components/layout';
import { ApprovalKanban } from '@/components/ApprovalKanban';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/i18n';

export default function AdminApprovalKanban() {
  const { t } = useLanguage();

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.approvalKanbanTitle}
        icon={<ShieldCheck className="h-5 w-5" />}
      />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <ApprovalKanban />
      </main>
    </PageLayout>
  );
}
