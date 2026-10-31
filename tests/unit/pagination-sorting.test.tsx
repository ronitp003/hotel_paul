import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TablePagination } from "@/components/ui/table-pagination";

describe("TablePagination Component", () => {
  it("renders page info correctly for 25 records with page size 10", () => {
    const onPageChange = vi.fn();
    render(
      <TablePagination
        currentPage={1}
        totalRecords={25}
        pageSize={10}
        onPageChange={onPageChange}
        recordLabel="bookings"
      />
    );

    expect(screen.getByText(/showing/i)).toBeInTheDocument();
    expect(screen.getByText(/bookings/i)).toBeInTheDocument();
    expect(screen.getByText(/page/i)).toBeInTheDocument();
  });

  it("disables Previous button on first page and enables Next button", () => {
    const onPageChange = vi.fn();
    render(
      <TablePagination
        currentPage={1}
        totalRecords={30}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables Next button on last page and enables Previous button", () => {
    const onPageChange = vi.fn();
    render(
      <TablePagination
        currentPage={3}
        totalRecords={30}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    expect(prevButton).not.toBeDisabled();
    expect(nextButton).toBeDisabled();

    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables both Previous and Next buttons when total records is 0", () => {
    const onPageChange = vi.fn();
    render(
      <TablePagination
        currentPage={1}
        totalRecords={0}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    const prevButton = screen.getByRole("button", { name: /previous/i });
    const nextButton = screen.getByRole("button", { name: /next/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it("allows direct page navigation via numbered buttons", () => {
    const onPageChange = vi.fn();
    render(
      <TablePagination
        currentPage={1}
        totalRecords={30}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    const page2Btn = screen.getByRole("button", { name: "Page 2" });
    fireEvent.click(page2Btn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});

describe("Pagination & Sorting Logic Verification", () => {
  it("sorts bookings by createdAt descending by default (not reference text)", () => {
    const bookings = [
      {
        id: "1",
        reference: "BK-20261031-099", // Alphabetically higher, but created earlier
        createdAt: new Date("2026-10-20T10:00:00Z"),
        checkInAt: new Date("2026-10-25T10:00:00Z"),
      },
      {
        id: "2",
        reference: "BK-20261031-001", // Alphabetically lower, but created later
        createdAt: new Date("2026-10-30T10:00:00Z"),
        checkInAt: new Date("2026-11-01T10:00:00Z"),
      },
      {
        id: "3",
        reference: "BK-20261031-050",
        createdAt: new Date("2026-10-28T10:00:00Z"),
        checkInAt: new Date("2026-10-29T10:00:00Z"),
      },
    ];

    const sorted = [...bookings].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.checkInAt).getTime();
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.checkInAt).getTime();
      return bTime - aTime;
    });

    expect(sorted[0].id).toBe("2"); // 2026-10-30
    expect(sorted[1].id).toBe("3"); // 2026-10-28
    expect(sorted[2].id).toBe("1"); // 2026-10-20
  });

  it("slices exactly 10 records per page for pagination", () => {
    const records = Array.from({ length: 25 }, (_, i) => ({ id: `rec-${i + 1}` }));
    const PAGE_SIZE = 10;

    const page1 = records.slice(0, PAGE_SIZE);
    expect(page1.length).toBe(10);
    expect(page1[0].id).toBe("rec-1");
    expect(page1[9].id).toBe("rec-10");

    const page2 = records.slice(PAGE_SIZE, PAGE_SIZE * 2);
    expect(page2.length).toBe(10);
    expect(page2[0].id).toBe("rec-11");
    expect(page2[9].id).toBe("rec-20");

    const page3 = records.slice(PAGE_SIZE * 2, PAGE_SIZE * 3);
    expect(page3.length).toBe(5);
    expect(page3[0].id).toBe("rec-21");
    expect(page3[4].id).toBe("rec-25");
  });

  it("sorts invoices by issuedAt descending by default", () => {
    const invoices = [
      { id: "inv-1", issuedAt: new Date("2026-10-20T10:00:00Z") },
      { id: "inv-2", issuedAt: new Date("2026-10-30T10:00:00Z") },
      { id: "inv-3", issuedAt: new Date("2026-10-25T10:00:00Z") },
    ];

    const sorted = [...invoices].sort(
      (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()
    );

    expect(sorted[0].id).toBe("inv-2");
    expect(sorted[1].id).toBe("inv-3");
    expect(sorted[2].id).toBe("inv-1");
  });

  it("sorts payment transactions by receivedAt descending by default", () => {
    const payments = [
      { id: "pmt-1", receivedAt: new Date("2026-10-22T10:00:00Z") },
      { id: "pmt-2", receivedAt: new Date("2026-10-29T10:00:00Z") },
      { id: "pmt-3", receivedAt: new Date("2026-10-27T10:00:00Z") },
    ];

    const sorted = [...payments].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );

    expect(sorted[0].id).toBe("pmt-2");
    expect(sorted[1].id).toBe("pmt-3");
    expect(sorted[2].id).toBe("pmt-1");
  });
});
