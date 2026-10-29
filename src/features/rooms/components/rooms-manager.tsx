"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoomCard } from "./room-card";
import { AddRoomDialog } from "./add-room-dialog";
import { EditRoomDialog } from "./edit-room-dialog";
import {
  SearchIcon,
  AddIcon,
  RoomIcon,
  ProblemIcon,
  MaintenanceIcon,
  CheckIcon,
} from "@/lib/icons";
import type { RoomWithStatus } from "@/server/services/room.service";
import type { Role } from "@/lib/constants";

interface RoomTypeOption {
  id: string;
  name: string;
}

interface RoomsManagerProps {
  initialRooms: RoomWithStatus[];
  roomTypes: RoomTypeOption[];
  userRole?: Role;
}

type StatusFilter = "ALL" | "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "PROBLEMS";

export function RoomsManager({
  initialRooms,
  roomTypes,
  userRole = "RECEPTIONIST",
}: RoomsManagerProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomWithStatus | null>(null);

  const isOwner = userRole === "OWNER";

  // Summary counts across all rooms
  const counts = useMemo(() => {
    let available = 0;
    let occupied = 0;
    let maintenance = 0;
    let problems = 0;

    for (const r of initialRooms) {
      if (r.status === "AVAILABLE") available++;
      if (r.status === "OCCUPIED") occupied++;
      if (r.status === "MAINTENANCE") maintenance++;
      if (r.hasProblem) problems++;
    }

    return {
      total: initialRooms.length,
      available,
      occupied,
      maintenance,
      problems,
    };
  }, [initialRooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return initialRooms.filter((room) => {
      // Search by room number
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        if (!room.number.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Filter by type
      if (typeFilter !== "ALL" && room.typeId !== typeFilter) {
        return false;
      }

      // Filter by status
      if (statusFilter === "AVAILABLE" && room.status !== "AVAILABLE") {
        return false;
      }
      if (statusFilter === "OCCUPIED" && room.status !== "OCCUPIED") {
        return false;
      }
      if (statusFilter === "MAINTENANCE" && room.status !== "MAINTENANCE") {
        return false;
      }
      if (statusFilter === "PROBLEMS" && !room.hasProblem) {
        return false;
      }

      return true;
    });
  }, [initialRooms, search, typeFilter, statusFilter]);

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* KPI / Quick Metric Badges Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={statusFilter === "ALL" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("ALL")}
          className="gap-1.5 rounded-full"
        >
          <RoomIcon className="size-3.5" aria-hidden="true" />
          <span>All Rooms</span>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
            {counts.total}
          </Badge>
        </Button>

        <Button
          variant={statusFilter === "AVAILABLE" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("AVAILABLE")}
          className="gap-1.5 rounded-full text-status-available hover:text-status-available"
        >
          <CheckIcon className="size-3.5" aria-hidden="true" />
          <span>Available</span>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
            {counts.available}
          </Badge>
        </Button>

        <Button
          variant={statusFilter === "OCCUPIED" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("OCCUPIED")}
          className="gap-1.5 rounded-full text-status-occupied hover:text-status-occupied"
        >
          <RoomIcon className="size-3.5" aria-hidden="true" />
          <span>Occupied</span>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
            {counts.occupied}
          </Badge>
        </Button>

        <Button
          variant={statusFilter === "MAINTENANCE" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("MAINTENANCE")}
          className="gap-1.5 rounded-full text-status-maintenance hover:text-status-maintenance"
        >
          <MaintenanceIcon className="size-3.5" aria-hidden="true" />
          <span>Maintenance</span>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
            {counts.maintenance}
          </Badge>
        </Button>

        {counts.problems > 0 && (
          <Button
            variant={statusFilter === "PROBLEMS" ? "destructive" : "outline"}
            size="sm"
            onClick={() => setStatusFilter("PROBLEMS")}
            className="gap-1.5 rounded-full text-status-problem hover:text-status-problem"
          >
            <ProblemIcon className="size-3.5" aria-hidden="true" />
            <span>Open Problems</span>
            <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {counts.problems}
            </Badge>
          </Button>
        )}
      </div>

      {/* Toolbar: Search, Type filter, Add Room */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <SearchIcon className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search room number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="w-44">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Room Types</option>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isOwner && (
          <Button
            onClick={() => setIsAddOpen(true)}
            size="sm"
            className="gap-1.5 shrink-0"
          >
            <AddIcon className="size-4" aria-hidden="true" />
            <span>Add Rooms</span>
          </Button>
        )}
      </div>

      {/* Room Cards Grid */}
      {filteredRooms.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card space-y-3">
          <div className="size-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <RoomIcon className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No Rooms Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {search || typeFilter !== "ALL" || statusFilter !== "ALL"
                ? "No rooms match your filter criteria. Try clearing search or changing filters."
                : "No rooms have been added to the property yet. Add individual rooms or bulk create a range."}
            </p>
          </div>
          {(search || typeFilter !== "ALL" || statusFilter !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setTypeFilter("ALL");
                setStatusFilter("ALL");
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              userRole={userRole}
              onEdit={(r) => setEditingRoom(r)}
            />
          ))}
        </div>
      )}

      {/* Add Room Dialog */}
      <AddRoomDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        roomTypes={roomTypes}
        onSuccess={handleRefresh}
      />

      {/* Edit Room Dialog */}
      <EditRoomDialog
        room={editingRoom}
        open={Boolean(editingRoom)}
        onOpenChange={(open) => !open && setEditingRoom(null)}
        roomTypes={roomTypes}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
