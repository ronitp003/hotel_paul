"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoaderIcon, CircleAlertIcon, InfoIcon } from "@/lib/icons";
import {
  invoiceSettingsSchema,
  billingSettingsSchema,
} from "../schemas";
import {
  updateInvoiceSettingsAction,
  updateBillingSettingsAction,
} from "@/server/actions/settings.actions";

interface InvoiceBillingFormProps {
  initialInvoice: {
    invoicePrefix: string;
    invoiceNotes: string;
    nextNo: number;
  };
  initialBilling: {
    graceMinutes: number;
    roundBillToRupee: boolean;
    gstOnOtherCharges: boolean;
  };
}

export function InvoiceBillingForm({
  initialInvoice,
  initialBilling,
}: InvoiceBillingFormProps) {
  const [invoiceServerError, setInvoiceServerError] = useState<string | null>(null);
  const [billingServerError, setBillingServerError] = useState<string | null>(null);

  const invoiceForm = useForm({
    defaultValues: {
      invoicePrefix: initialInvoice.invoicePrefix,
      invoiceNotes: initialInvoice.invoiceNotes,
      nextNo: initialInvoice.nextNo,
    },
    validators: {
      onChange: invoiceSettingsSchema,
    },
    onSubmit: async ({ value }) => {
      setInvoiceServerError(null);
      const res = await updateInvoiceSettingsAction(value);
      if (!res.ok) {
        setInvoiceServerError(res.message || "Failed to update invoice settings.");
        return;
      }
      toast.success("Invoice series and notes updated successfully.");
    },
  });

  const billingForm = useForm({
    defaultValues: {
      graceMinutes: initialBilling.graceMinutes,
      roundBillToRupee: initialBilling.roundBillToRupee,
      gstOnOtherCharges: initialBilling.gstOnOtherCharges,
    },
    validators: {
      onChange: billingSettingsSchema,
    },
    onSubmit: async ({ value }) => {
      setBillingServerError(null);
      const res = await updateBillingSettingsAction(value);
      if (!res.ok) {
        setBillingServerError(res.message || "Failed to update billing settings.");
        return;
      }
      toast.success("Billing rules updated successfully.");
    },
  });

  return (
    <div className="space-y-6">
      {/* 1. Invoice Series & Numbering */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Series & Formatting</CardTitle>
          <CardDescription>
            Configure legal tax invoice prefixes, sequential counter, and footer notes.
          </CardDescription>
        </CardHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            invoiceForm.handleSubmit();
          }}
        >
          <CardContent className="space-y-4">
            {invoiceServerError && (
              <Alert variant="destructive">
                <CircleAlertIcon className="h-4 w-4" />
                <AlertDescription>{invoiceServerError}</AlertDescription>
              </Alert>
            )}

            <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200">
              <InfoIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="font-semibold">Sequential Numbering Notice</AlertTitle>
              <AlertDescription className="text-xs">
                Changing the next invoice number only affects future invoices. It will not alter
                or renumber existing historical invoices. By law, the sequence cannot be set
                lower than the highest issued invoice number + 1.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <invoiceForm.Field name="invoicePrefix">
                {(field) => {
                  const error = field.state.meta.errors[0]?.message;
                  return (
                    <div className="space-y-1.5">
                      <Label htmlFor={field.name}>Invoice Prefix</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="e.g. HP-"
                        aria-invalid={Boolean(error)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Prepended to the sequential invoice number (e.g. HP-1001).
                      </p>
                      {error && (
                        <p className="text-sm font-medium text-destructive">{error}</p>
                      )}
                    </div>
                  );
                }}
              </invoiceForm.Field>

              <invoiceForm.Field name="nextNo">
                {(field) => {
                  const error = field.state.meta.errors[0]?.message;
                  return (
                    <div className="space-y-1.5">
                      <Label htmlFor={field.name}>Next Invoice Number</Label>
                      <Input
                        id={field.name}
                        type="number"
                        inputMode="numeric"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(parseInt(e.target.value, 10) || 0)
                        }
                        placeholder="1001"
                        aria-invalid={Boolean(error)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Allocated sequentially in a database transaction on checkout.
                      </p>
                      {error && (
                        <p className="text-sm font-medium text-destructive">{error}</p>
                      )}
                    </div>
                  );
                }}
              </invoiceForm.Field>
            </div>

            <invoiceForm.Field name="invoiceNotes">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor={field.name}>Invoice Footer / Policy Notes</Label>
                    <Textarea
                      id={field.name}
                      rows={3}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Thank you for staying at Hotel Paul. Check-out time is 10:00 AM."
                      aria-invalid={Boolean(error)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Max 2000 characters. Printed at the bottom of customer invoices.
                    </p>
                    {error && (
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    )}
                  </div>
                );
              }}
            </invoiceForm.Field>
          </CardContent>

          <CardFooter className="flex justify-end border-t pt-4">
            <invoiceForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && <LoaderIcon className="h-4 w-4 animate-spin mr-2" />}
                  Save Invoice Settings
                </Button>
              )}
            </invoiceForm.Subscribe>
          </CardFooter>
        </form>
      </Card>

      {/* 2. Stay & Billing Calculation Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Stay & Billing Policies</CardTitle>
          <CardDescription>
            Configure late-checkout grace period and tax calculation toggles.
          </CardDescription>
        </CardHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            billingForm.handleSubmit();
          }}
        >
          <CardContent className="space-y-6">
            {billingServerError && (
              <Alert variant="destructive">
                <CircleAlertIcon className="h-4 w-4" />
                <AlertDescription>{billingServerError}</AlertDescription>
              </Alert>
            )}

            <billingForm.Field name="graceMinutes">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;
                return (
                  <div className="space-y-1.5 max-w-sm">
                    <Label htmlFor={field.name}>
                      Late-Checkout Grace Period (Minutes)
                    </Label>
                    <Input
                      id={field.name}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={1440}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(parseInt(e.target.value, 10) || 0)
                      }
                      aria-invalid={Boolean(error)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Minutes allowed past the 24-hour cycle before an additional day is billed.
                      (Default: 0 minutes).
                    </p>
                    {error && (
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    )}
                  </div>
                );
              }}
            </billingForm.Field>

            <div className="border-t pt-4 space-y-4">
              <billingForm.Field name="roundBillToRupee">
                {(field) => (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor={field.name} className="text-sm font-medium">
                        Round Final Bill to Nearest Rupee
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        When enabled, rounds fractional paisa totals to the nearest whole ₹.
                      </p>
                    </div>
                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(checked)}
                    />
                  </div>
                )}
              </billingForm.Field>

              <billingForm.Field name="gstOnOtherCharges">
                {(field) => (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor={field.name} className="text-sm font-medium">
                        Apply GST to Other Charges (Food, Laundry, Room Service)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Whether standard GST rate applies to non-room incidental charges.
                      </p>
                    </div>
                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) => field.handleChange(checked)}
                    />
                  </div>
                )}
              </billingForm.Field>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end border-t pt-4">
            <billingForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && <LoaderIcon className="h-4 w-4 animate-spin mr-2" />}
                  Save Billing Policies
                </Button>
              )}
            </billingForm.Subscribe>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
