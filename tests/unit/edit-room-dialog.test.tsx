import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { EditRoomDialog } from "@/features/rooms/components/edit-room-dialog";
import { updateRoomAction, deleteRoomAction } from "@/server/actions/room.actions";
import type { RoomWithStatus } from "@/server/services/room.service";

vi.mock("@/server/actions/room.actions", () => ({
  updateRoomAction: vi.fn(),
  deleteRoomAction: vi.fn(),
}));

const mockRoomTypes = [
  { id: "type-standard", name: "Standard Room" },
  { id: "type-deluxe", name: "Deluxe Suite" },
];

const room101: RoomWithStatus = {
  id: "room-101",
  number: "101",
  typeId: "type-standard",
  typeName: "Standard Room",
  pricePerNight: 2000,
  isActive: true,
  status: "AVAILABLE",
  hasProblem: false,
  openProblemsCount: 0,
  maintenanceReason: null,
  currentBooking: null,
  nextBooking: null,
  upcomingMaintenance: [],
};

const room106: RoomWithStatus = {
  id: "room-106",
  number: "106",
  typeId: "type-deluxe",
  typeName: "Deluxe Suite",
  pricePerNight: 4500,
  isActive: true,
  status: "AVAILABLE",
  hasProblem: false,
  openProblemsCount: 0,
  maintenanceReason: null,
  currentBooking: null,
  nextBooking: null,
  upcomingMaintenance: [],
};

function TestWrapper({ onSuccess }: { onSuccess?: () => void }) {
  const [editingRoom, setEditingRoom] = useState<RoomWithStatus | null>(null);

  return (
    <div>
      <button onClick={() => setEditingRoom(room101)}>Edit Room 101</button>
      <button onClick={() => setEditingRoom(room106)}>Edit Room 106</button>
      <EditRoomDialog
        room={editingRoom}
        open={Boolean(editingRoom)}
        onOpenChange={(open) => !open && setEditingRoom(null)}
        roomTypes={mockRoomTypes}
        onSuccess={onSuccess}
      />
    </div>
  );
}

describe("EditRoomDialog state synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates form fields when switching between different rooms (focus/blur case)", async () => {
    render(<TestWrapper />);

    // 1. Click Edit on Room 101
    fireEvent.click(screen.getByText("Edit Room 101"));
    expect(screen.getByLabelText(/Room Number/i)).toHaveValue("101");
    expect(screen.getByLabelText(/Base Price/i)).toHaveValue(2000);

    // Auto-focus on modal open, then blur
    fireEvent.focus(screen.getByLabelText(/Room Number/i));
    fireEvent.blur(screen.getByLabelText(/Room Number/i));

    // 2. Close the dialog without saving
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // 3. Click Edit on Room 106
    fireEvent.click(screen.getByText("Edit Room 106"));

    // 4. Expect Room 106's data, NOT 101's stale data
    expect(screen.getByLabelText(/Room Number/i)).toHaveValue("106");
    expect(screen.getByLabelText(/Base Price/i)).toHaveValue(4500);
  });

  it("clears modified unsaved inputs and loads new room data on room change", async () => {
    render(<TestWrapper />);

    // 1. Click Edit on Room 101
    fireEvent.click(screen.getByText("Edit Room 101"));
    expect(screen.getByLabelText(/Room Number/i)).toHaveValue("101");

    // Dirty the form
    fireEvent.change(screen.getByLabelText(/Room Number/i), {
      target: { value: "999-dirty" },
    });
    expect(screen.getByLabelText(/Room Number/i)).toHaveValue("999-dirty");

    // 2. Close the dialog without saving
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // 3. Click Edit on Room 106
    fireEvent.click(screen.getByText("Edit Room 106"));

    // 4. Expect Room 106 data, NOT 999-dirty
    expect(screen.getByLabelText(/Room Number/i)).toHaveValue("106");
    expect(screen.getByLabelText(/Base Price/i)).toHaveValue(4500);

    // 5. Close Room 106 and re-open Room 101: it should have original 101 data, NOT 999-dirty
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByText("Edit Room 101"));
    expect(screen.getByLabelText(/Room Number/i)).toHaveValue("101");
    expect(screen.getByLabelText(/Base Price/i)).toHaveValue(2000);
  });

  it("resets action error message when dialog closes and opens for another room", async () => {
    vi.mocked(updateRoomAction).mockResolvedValueOnce({
      ok: false,
      message: "Room number already exists in inventory",
    });

    render(<TestWrapper />);

    // Open Room 101 and trigger an action error on submit
    fireEvent.click(screen.getByText("Edit Room 101"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(
        screen.getByText("Room number already exists in inventory")
      ).toBeInTheDocument();
    });

    // Close dialog
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Open Room 106: stale action error should NOT be visible
    fireEvent.click(screen.getByText("Edit Room 106"));
    expect(
      screen.queryByText("Room number already exists in inventory")
    ).not.toBeInTheDocument();
  });

  it("successfully submits updated room data and triggers onSuccess", async () => {
    vi.mocked(updateRoomAction).mockResolvedValueOnce({
      ok: true,
      data: {
        id: "room-106",
        number: "106-A",
        typeId: "type-deluxe",
        pricePerNight: 5000,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const onSuccessMock = vi.fn();
    render(<TestWrapper onSuccess={onSuccessMock} />);

    fireEvent.click(screen.getByText("Edit Room 106"));
    fireEvent.change(screen.getByLabelText(/Room Number/i), {
      target: { value: "106-A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateRoomAction).toHaveBeenCalledWith(
        "room-106",
        expect.objectContaining({
          number: "106-A",
          typeId: "type-deluxe",
          pricePerNight: 4500,
          isActive: true,
        })
      );
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });
  });

  it("handles delete room confirmation and triggers onSuccess", async () => {
    vi.mocked(deleteRoomAction).mockResolvedValueOnce({
      ok: true,
      data: {
        id: "room-106",
        number: "106",
      },
    });

    const onSuccessMock = vi.fn();
    render(<TestWrapper onSuccess={onSuccessMock} />);

    fireEvent.click(screen.getByText("Edit Room 106"));
    fireEvent.click(screen.getByRole("button", { name: /Delete Room/i }));

    // Click confirm delete in alert dialog
    fireEvent.click(screen.getByRole("button", { name: /Confirm Delete/i }));

    await waitFor(() => {
      expect(deleteRoomAction).toHaveBeenCalledWith("room-106");
      expect(onSuccessMock).toHaveBeenCalledTimes(1);
    });
  });
});
