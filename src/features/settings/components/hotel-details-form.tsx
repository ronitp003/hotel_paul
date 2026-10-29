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

export function HotelDetailsForm({ initialData }: HotelDetailsFormProps) {
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
        setServerError(res.message || "Failed to update hotel details.");
        return;
      }
      toast.success("Hotel details saved successfully.");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hotel Information</CardTitle>
        <CardDescription>
          Property identity printed on official guest folios and tax invoices.
        </CardDescription>
      </CardHeader>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <CardContent className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <CircleAlertIcon className="h-4 w-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <form.Field name="name">
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              return (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>
                    Hotel Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="e.g. Hotel Paul"
                    aria-invalid={Boolean(error)}
                  />
                  {error && (
                    <p className="text-sm font-medium text-destructive">{error}</p>
                  )}
                </div>
              );
            }}
          </form.Field>

          <form.Field name="address">
            {(field) => {
              const error = field.state.meta.errors[0]?.message;
              return (
                <div className="space-y-1.5">
                  <Label htmlFor={field.name}>
                    Full Postal Address <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id={field.name}
                    rows={3}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="123 Station Road, Bolpur, West Bengal 731204"
                    aria-invalid={Boolean(error)}
                  />
                  {error && (
                    <p className="text-sm font-medium text-destructive">{error}</p>
                  )}
                </div>
              );
            }}
          </form.Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="phone">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor={field.name}>
                      Front Desk Phone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={field.name}
                      type="tel"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="+91 98765 43210"
                      aria-invalid={Boolean(error)}
                    />
                    {error && (
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    )}
                  </div>
                );
              }}
            </form.Field>

            <form.Field name="gstin">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor={field.name}>GSTIN (15 characters)</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value.toUpperCase())
                      }
                      placeholder="19AAAAA0000A1Z5"
                      aria-invalid={Boolean(error)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave blank if GST is not applicable. Invoices will show GSTIN if provided.
                    </p>
                    {error && (
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    )}
                  </div>
                );
              }}
            </form.Field>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end border-t pt-4">
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting && <LoaderIcon className="h-4 w-4 animate-spin mr-2" />}
                Save Hotel Details
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </form>
    </Card>
  );
}
