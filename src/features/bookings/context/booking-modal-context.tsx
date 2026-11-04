"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { BookingModal } from "@/features/bookings/components/booking-modal";

export interface OpenBookingModalOptions {
  preselectedRoomId?: string;
  checkIn?: Date;
  checkOut?: Date;
}

export interface BookingModalContextValue {
  isOpen: boolean;
  openBookingModal: (options?: OpenBookingModalOptions) => void;
  closeBookingModal: () => void;
}

const defaultBookingModalContext: BookingModalContextValue = {
  isOpen: false,
  openBookingModal: () => {},
  closeBookingModal: () => {},
};

const BookingModalContext = createContext<BookingModalContextValue>(
  defaultBookingModalContext
);

function UrlBookingModalOpener({
  onOpen,
}: {
  onOpen: (options?: OpenBookingModalOptions) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const isNew =
      searchParams.get("new") === "true" ||
      searchParams.get("newBooking") === "true";
    const roomId = searchParams.get("roomId") || undefined;

    if (isNew) {
      onOpen({ preselectedRoomId: roomId });
      // Clean up URL query parameters without triggering full reload
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("new");
        url.searchParams.delete("newBooking");
        url.searchParams.delete("roomId");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams, onOpen]);

  return null;
}

export function BookingModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [modalOptions, setModalOptions] = useState<
    OpenBookingModalOptions | undefined
  >();

  const openBookingModal = useCallback((options?: OpenBookingModalOptions) => {
    setModalOptions(options);
    setModalKey((prev) => prev + 1);
    setIsOpen(true);
  }, []);

  const closeBookingModal = useCallback(() => {
    setIsOpen(false);
    setModalOptions(undefined);
  }, []);

  return (
    <BookingModalContext.Provider
      value={{ isOpen, openBookingModal, closeBookingModal }}
    >
      <React.Suspense fallback={null}>
        <UrlBookingModalOpener onOpen={openBookingModal} />
      </React.Suspense>
      {children}
      {isOpen && (
        <BookingModal
          key={modalKey}
          open={isOpen}
          onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) setModalOptions(undefined);
          }}
          preselectedRoomId={modalOptions?.preselectedRoomId}
          initialCheckIn={modalOptions?.checkIn}
          initialCheckOut={modalOptions?.checkOut}
        />
      )}
    </BookingModalContext.Provider>
  );
}

export function useBookingModal(): BookingModalContextValue {
  return useContext(BookingModalContext);
}

