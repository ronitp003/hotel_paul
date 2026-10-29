import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { settingsService } from "@/server/services/settings.service";
import { HotelDetailsForm } from "@/features/settings/components/hotel-details-form";
import { InvoiceBillingForm } from "@/features/settings/components/invoice-billing-form";
import { GstSlabsManager } from "@/features/settings/components/gst-slabs-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SettingsPage() {
  await requireRole([ROLES.OWNER]);
  const settings = await settingsService.getSettings();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="hotel" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="hotel">Hotel Details</TabsTrigger>
          <TabsTrigger value="gst">GST Slabs</TabsTrigger>
          <TabsTrigger value="invoicing">Invoice & Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="hotel" className="space-y-4">
          <HotelDetailsForm
            initialData={{
              name: settings.hotel.name,
              address: settings.hotel.address,
              phone: settings.hotel.phone,
              gstin: settings.hotel.gstin,
            }}
          />
        </TabsContent>

        <TabsContent value="gst" className="space-y-4">
          <GstSlabsManager initialSlabs={settings.gstSlabs} />
        </TabsContent>

        <TabsContent value="invoicing" className="space-y-4">
          <InvoiceBillingForm
            initialInvoice={{
              invoicePrefix: settings.hotel.invoicePrefix,
              invoiceNotes: settings.hotel.invoiceNotes,
              nextNo: settings.invoiceSequence.nextNo,
            }}
            initialBilling={{
              graceMinutes: settings.hotel.graceMinutes,
              roundBillToRupee: settings.hotel.roundBillToRupee,
              gstOnOtherCharges: settings.hotel.gstOnOtherCharges,
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
