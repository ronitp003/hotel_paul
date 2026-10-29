import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { renderToBuffer } from "@react-pdf/renderer";
import { invoiceService } from "@/server/services/invoice.service";
import { InvoicePdfDocument } from "@/features/invoices/components/invoice-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  try {
    await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const { invoiceId } = await params;
    const invoice = await invoiceService.getInvoice(invoiceId);

    const pdfBuffer = await renderToBuffer(
      InvoicePdfDocument({ snapshot: invoice.snapshot })
    );

    return new Response(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Invoice-${invoice.displayNo}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("PDF generation error:", err);
    return new Response("Unauthorized or Invoice Not Found", { status: 404 });
  }
}
