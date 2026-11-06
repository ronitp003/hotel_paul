
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

import {
  LoaderIcon,
  CircleAlertIcon,
  InfoIcon,
} from "@/lib/icons";

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
  const [invoiceServerError, setInvoiceServerError] = useState<string | null>(
    null
  );

  const [billingServerError, setBillingServerError] = useState<string | null>(
    null
  );

  // Invoice Settings Form
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
        setInvoiceServerError(
          res.message || "Failed to update invoice settings."
        );
        return;
      }

      toast.success("Invoice series and notes updated successfully.");
    },
  });

  // Billing Settings Form
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
        setBillingServerError(
          res.message || "Failed to update billing settings."
        );
        return;
      }

      toast.success("Billing rules updated successfully.");
    },
  });

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6">

      {/* 1. Invoice Series & Numbering */}
      <Card className="w-full min-w-0 overflow-hidden border-border/80 shadow-xs">
        <CardHeader className="space-y-1 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
          <CardTitle className="text-base font-semibold tracking-tight">
            Invoice Series & Formatting
          </CardTitle>

          <CardDescription className="text-sm leading-relaxed">
            Configure legal tax invoice prefixes, sequential counter, and
            footer notes.
          </CardDescription>
        </CardHeader>

        <form
          className="min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            invoiceForm.handleSubmit();
          }}
        >
          <CardContent className="min-w-0 space-y-4 px-4 pb-5 sm:px-5">

            {/* Server Error */}
            {invoiceServerError && (
              <Alert
                variant="destructive"
                className="items-start gap-2"
              >
                <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <AlertDescription className="min-w-0 break-words text-sm">
                  {invoiceServerError}
                </AlertDescription>
              </Alert>
            )}

            {/* Sequential Numbering Notice */}
            <Alert className="items-start gap-2 border-amber-500/30 bg-amber-500/10 py-3 text-foreground">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />

              <div className="min-w-0 space-y-1">
                <AlertTitle className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Sequential Numbering Notice
                </AlertTitle>

                <AlertDescription className="text-xs leading-relaxed text-muted-foreground">
                  Changing the next invoice number only affects future
                  invoices. It will not alter or renumber existing historical
                  invoices. By law, the sequence cannot be set lower than the
                  highest issued invoice number + 1.
                </AlertDescription>
              </div>
            </Alert>

            {/* Invoice Prefix & Number */}
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">

              <invoiceForm.Field name="invoicePrefix">
                {(field) => {
                  const error = field.state.meta.errors[0]?.message;

                  return (
                    <div className="min-w-0 space-y-2">
                      <Label
                        htmlFor={field.name}
                        className="text-sm font-medium"
                      >
                        Invoice Prefix
                      </Label>

                      <Input
                        id={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(e.target.value)
                        }
                        placeholder="e.g. HP-"
                        aria-invalid={Boolean(error)}
                        className="h-10 min-w-0"
                      />

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Prepended to the sequential invoice number
                        (e.g. HP-1001).
                      </p>

                      {error && (
                        <p className="text-xs font-medium text-destructive">
                          {error}
                        </p>
                      )}
                    </div>
                  );
                }}
              </invoiceForm.Field>

              <invoiceForm.Field name="nextNo">
                {(field) => {
                  const error = field.state.meta.errors[0]?.message;

                  return (
                    <div className="min-w-0 space-y-2">
                      <Label
                        htmlFor={field.name}
                        className="text-sm font-medium"
                      >
                        Next Invoice Number
                      </Label>

                      <Input
                        id={field.name}
                        type="number"
                        inputMode="numeric"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(
                            parseInt(e.target.value, 10) || 0
                          )
                        }
                        placeholder="1001"
                        aria-invalid={Boolean(error)}
                        className="h-10 min-w-0"
                      />

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Allocated sequentially in a database transaction
                        on checkout.
                      </p>

                      {error && (
                        <p className="text-xs font-medium text-destructive">
                          {error}
                        </p>
                      )}
                    </div>
                  );
                }}
              </invoiceForm.Field>

            </div>

            {/* Invoice Footer Notes */}
            <invoiceForm.Field name="invoiceNotes">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;

                return (
                  <div className="min-w-0 space-y-2">
                    <Label
                      htmlFor={field.name}
                      className="text-sm font-medium"
                    >
                      Invoice Footer / Policy Notes
                    </Label>

                    <Textarea
                      id={field.name}
                      rows={3}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value)
                      }
                      placeholder="Thank you for staying at Hotel Paul. Check-out time is 10:00 AM."
                      aria-invalid={Boolean(error)}
                      className="min-h-20 resize-y"
                    />

                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Max 2000 characters. Printed at the bottom of
                      customer invoices.
                    </p>

                    {error && (
                      <p className="text-xs font-medium text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              }}
            </invoiceForm.Field>

          </CardContent>

          {/* Invoice Save Action */}
          <CardFooter className="flex flex-col-reverse gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <invoiceForm.Subscribe
              selector={(state) => [
                state.canSubmit,
                state.isSubmitting,
              ]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting && (
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Invoice Settings
                </Button>
              )}
            </invoiceForm.Subscribe>
          </CardFooter>
        </form>
      </Card>

      {/* 2. Stay & Billing Calculation Rules */}
      <Card className="w-full min-w-0 overflow-hidden border-border/80 shadow-xs">
        <CardHeader className="space-y-1 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
          <CardTitle className="text-base font-semibold tracking-tight">
            Stay & Billing Policies
          </CardTitle>

          <CardDescription className="text-sm leading-relaxed">
            Configure late-checkout grace period and tax calculation toggles.
          </CardDescription>
        </CardHeader>

        <form
          className="min-w-0"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            billingForm.handleSubmit();
          }}
        >
          <CardContent className="min-w-0 space-y-5 px-4 pb-5 sm:px-5">

            {/* Billing Server Error */}
            {billingServerError && (
              <Alert
                variant="destructive"
                className="items-start gap-2"
              >
                <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <AlertDescription className="min-w-0 break-words text-sm">
                  {billingServerError}
                </AlertDescription>
              </Alert>
            )}

            {/* Grace Period */}
            <billingForm.Field name="graceMinutes">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;

                return (
                  <div className="w-full max-w-md min-w-0 space-y-2">
                    <Label
                      htmlFor={field.name}
                      className="text-sm font-medium"
                    >
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
                        field.handleChange(
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                      aria-invalid={Boolean(error)}
                      className="h-10"
                    />

                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Minutes allowed past the 24-hour cycle before an
                      additional day is billed. (Default: 0 minutes).
                    </p>

                    {error && (
                      <p className="text-xs font-medium text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              }}
            </billingForm.Field>

            {/* Billing Policy Toggles */}
            <div className="space-y-3 border-t border-border pt-4">

              {/* Round Bill */}
              <billingForm.Field name="roundBillToRupee">
                {(field) => (
                  <div className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-muted/20 sm:p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label
                        htmlFor={field.name}
                        className="cursor-pointer text-sm font-medium leading-snug"
                      >
                        Round Final Bill to Nearest Rupee
                      </Label>

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        When enabled, rounds fractional paisa totals to
                        the nearest whole ₹.
                      </p>
                    </div>

                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked)
                      }
                      aria-label="Round final bill to nearest rupee"
                      className="shrink-0"
                    />
                  </div>
                )}
              </billingForm.Field>

              {/* GST on Other Charges */}
              <billingForm.Field name="gstOnOtherCharges">
                {(field) => (
                  <div className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-border bg-card p-3.5 transition-colors hover:bg-muted/20 sm:p-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label
                        htmlFor={field.name}
                        className="cursor-pointer text-sm font-medium leading-snug"
                      >
                        Apply GST to Other Charges (Food, Laundry, Room Service)
                      </Label>

                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Whether standard GST rate applies to non-room
                        incidental charges.
                      </p>
                    </div>

                    <Switch
                      id={field.name}
                      checked={field.state.value}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked)
                      }
                      aria-label="Apply GST to other charges"
                      className="shrink-0"
                    />
                  </div>
                )}
              </billingForm.Field>

            </div>
          </CardContent>

          {/* Billing Save Action */}
          <CardFooter className="flex flex-col-reverse gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <billingForm.Subscribe
              selector={(state) => [
                state.canSubmit,
                state.isSubmitting,
              ]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {isSubmitting && (
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  )}
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
