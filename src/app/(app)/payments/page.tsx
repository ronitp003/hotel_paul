import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { invoiceService } from "@/server/services/invoice.service";
import { PaymentsView } from "@/features/payments/components/payments-view";
import { PaymentIcon } from "@/lib/icons";

export const metadata = {
  title: "Payments & Invoices | Hotel Paul",
  description:
    "Track guest payments, advance deposits, refunds, and issued GST tax invoices",
};

export default async function PaymentsPage() {
  const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);

  const [invoicesResult, paymentsResult] = await Promise.all([
    invoiceService.listInvoices({ limit: 500 }),
    invoiceService.listPayments({ limit: 500 }),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <PaymentIcon className="size-6 text-primary" aria-hidden="true" />
            Payments & Tax Invoices
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Track stay billing, advances, settlement transactions, and download
            official A4 GST invoices.
          </p>
        </div>
      </div>

      <PaymentsView
        invoices={invoicesResult.invoices}
        payments={paymentsResult.payments}
        isOwner={actor.role === ROLES.OWNER}
      />
    </div>
  );
}
