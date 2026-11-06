
"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { LoaderIcon, CircleAlertIcon } from "@/lib/icons";
import { hotelDetailsSchema } from "../schemas";
import { updateHotelDetailsAction } from "@/server/actions/settings.actions";

interface HotelDetailsFormProps {
  initialData: {
    name: string;
    address: string;
    phone: string;
    gstin: string;
  };
}

export function HotelDetailsForm({
  initialData,
}: HotelDetailsFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: initialData.name,
      address: initialData.address,
      phone: initialData.phone,
      gstin: initialData.gstin,
    },
    validators: {
      onChange: hotelDetailsSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);

      const res = await updateHotelDetailsAction(value);

      if (!res.ok) {
        setServerError(
          res.message || "Failed to update hotel details."
        );
        return;
      }

      toast.success("Hotel details saved successfully.");
    },
  });

  return (
    <Card className="w-full min-w-0 overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="space-y-1 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
        <CardTitle className="text-base font-semibold tracking-tight">
          Hotel Information
        </CardTitle>

        <CardDescription className="text-sm leading-relaxed">
          Property identity printed on official guest folios and tax invoices.
        </CardDescription>
      </CardHeader>

      <form
        className="min-w-0"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <CardContent className="space-y-4 px-4 pb-5 sm:px-5">
          {serverError && (
            <Alert
              variant="destructive"
              className="items-start gap-2"
            >
              <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <AlertDescription className="min-w-0 break-words text-sm">
                {serverError}
              </AlertDescription>
            </Alert>
          )}

          {/* Hotel Name */}
          <form.Field name="name">
            {(field) => {
              const error = field.state.meta.errors[0]?.message;

              return (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={field.name} className="text-sm font-medium">
                    Hotel Name <span className="text-destructive">*</span>
                  </Label>

                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. Hotel Paul"
                    aria-invalid={Boolean(error)}
                    className="h-10 min-w-0"
                  />

                  {error && (
                    <p className="text-xs font-medium text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              );
            }}
          </form.Field>

          {/* Full Postal Address */}
          <form.Field name="address">
            {(field) => {
              const error = field.state.meta.errors[0]?.message;

              return (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor={field.name} className="text-sm font-medium">
                    Full Postal Address{" "}
                    <span className="text-destructive">*</span>
                  </Label>

                  <Textarea
                    id={field.name}
                    rows={2}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="123 Station Road, Bolpur, West Bengal 731204"
                    aria-invalid={Boolean(error)}
                    className="min-h-18 resize-y"
                  />

                  {error && (
                    <p className="text-xs font-medium text-destructive">
                      {error}
                    </p>
                  )}
                </div>
              );
            }}
          </form.Field>

          {/* Phone & GSTIN */}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
            {/* Front Desk Phone */}
            <form.Field name="phone">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;

                return (
                  <div className="min-w-0 space-y-2">
                    <Label
                      htmlFor={field.name}
                      className="text-sm font-medium"
                    >
                      Front Desk Phone{" "}
                      <span className="text-destructive">*</span>
                    </Label>

                    <Input
                      id={field.name}
                      type="tel"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="+91 98765 43210"
                      aria-invalid={Boolean(error)}
                      className="h-10 min-w-0"
                    />

                    {error && (
                      <p className="text-xs font-medium text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              }}
            </form.Field>

            {/* GSTIN */}
            <form.Field name="gstin">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;

                return (
                  <div className="min-w-0 space-y-2">
                    <Label
                      htmlFor={field.name}
                      className="text-sm font-medium"
                    >
                      GSTIN{" "}
                      <span className="text-muted-foreground font-normal">
                        (15 characters)
                      </span>
                    </Label>

                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value.toUpperCase())
                      }
                      placeholder="19AAAAA0000A1Z5"
                      aria-invalid={Boolean(error)}
                      className="h-10 min-w-0 uppercase"
                    />

                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Leave blank if GST is not applicable. Invoices will show
                      GSTIN if provided.
                    </p>

                    {error && (
                      <p className="text-xs font-medium text-destructive">
                        {error}
                      </p>
                    )}
                  </div>
                );
              }}
            </form.Field>
          </div>
        </CardContent>

        {/* Save Action */}
        <CardFooter className="flex flex-col-reverse gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
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
                Save Hotel Details
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  );
}
