"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { RoomCard } from "./room-card";
import { AddRoomDialog } from "./add-room-dialog";
import { EditRoomDialog } from "./edit-room-dialog";
import { LogProblemDialog } from "./log-problem-dialog";
import { CreateMaintenanceDialog } from "./create-maintenance-dialog";
import { cn } from "@/lib/utils";
import {
  SearchIcon,
  AddIcon,
  RoomIcon,
  CalendarIcon,
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

type StatusFilter =
  "ALL" | "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" | "PROBLEMS";

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
  const [isProblemOpen, setIsProblemOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const isOwner = userRole === "OWNER";

  // Summary counts across all rooms
  const counts = useMemo(() => {
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    let maintenance = 0;
    let problems = 0;

    for (const r of initialRooms) {
      if (r.status === "AVAILABLE") available++;
      if (r.status === "OCCUPIED") occupied++;
      if (r.status === "RESERVED") reserved++;
      if (
        r.status === "MAINTENANCE" ||
        (r.upcomingMaintenance && r.upcomingMaintenance.length > 0)
      ) {
        maintenance++;
      }
      if (r.hasProblem) problems++;
    }

    return {
      total: initialRooms.length,
      available,
      occupied,
      reserved,
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
      if (statusFilter === "RESERVED" && room.status !== "RESERVED") {
        return false;
      }
      if (statusFilter === "MAINTENANCE") {
        const hasMaintenance =
          room.status === "MAINTENANCE" ||
          Boolean(room.upcomingMaintenance && room.upcomingMaintenance.length > 0);
        if (!hasMaintenance) {
          return false;
        }
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
        {[
          {
            id: "ALL" as const,
            label: "All Rooms",
            icon: RoomIcon,
            count: counts.total,
            inactiveColorClass: "text-foreground",
            inactiveBorder: "border-border hover:border-border",
            inactiveBgHover: "hover:bg-muted/70",
            inactiveBadgeClass: "bg-muted text-muted-foreground border-border",
          },
          {
            id: "AVAILABLE" as const,
            label: "Available",
            icon: CheckIcon,
            count: counts.available,
            inactiveColorClass: "text-status-available",
            inactiveBorder: "border-border hover:border-status-available/40",
            inactiveBgHover: "hover:bg-status-available/10",
            inactiveBadgeClass:
              "bg-status-available/15 text-status-available border-status-available/25",
          },
          {
            id: "OCCUPIED" as const,
            label: "Occupied",
            icon: RoomIcon,
            count: counts.occupied,
            inactiveColorClass: "text-status-occupied",
            inactiveBorder: "border-border hover:border-status-occupied/40",
            inactiveBgHover: "hover:bg-status-occupied/10",
            inactiveBadgeClass:
              "bg-status-occupied/15 text-status-occupied border-status-occupied/25",
          },
          {
            id: "RESERVED" as const,
            label: "Reserved",
            icon: CalendarIcon,
            count: counts.reserved,
            inactiveColorClass: "text-status-reserved",
            inactiveBorder: "border-border hover:border-status-reserved/40",
            inactiveBgHover: "hover:bg-status-reserved/10",
            inactiveBadgeClass:
              "bg-status-reserved/15 text-status-reserved border-status-reserved/25",
          },
          {
            id: "MAINTENANCE" as const,
            label: "Maintenance",
            icon: MaintenanceIcon,
            count: counts.maintenance,
            inactiveColorClass: "text-status-maintenance",
            inactiveBorder: "border-border hover:border-status-maintenance/40",
            inactiveBgHover: "hover:bg-status-maintenance/10",
            inactiveBadgeClass:
              "bg-status-maintenance/15 text-status-maintenance border-status-maintenance/25",
          },
          ...(counts.problems > 0
            ? [
                {
                  id: "PROBLEMS" as const,
                  label: "Open Problems",
                  icon: ProblemIcon,
                  count: counts.problems,
                  inactiveColorClass: "text-status-problem",
                  inactiveBorder:
                    "border-status-problem/30 hover:border-status-problem/50",
                  inactiveBgHover: "hover:bg-status-problem/10",
                  inactiveBadgeClass:
                    "bg-status-problem/15 text-status-problem border-status-problem/25",
                },
              ]
            : []),
        ].map((item) => {
          const isActive = statusFilter === item.id;
          const Icon = item.icon;

          return (
            <Button
              key={item.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(item.id)}
              className={cn(
                "gap-1.5 rounded-full transition-all duration-150 motion-reduce:transition-none shadow-xs font-medium cursor-pointer",
                isActive
                  ? "bg-primary text-white border-primary hover:bg-primary/90 hover:text-white"
                  : cn(
                      "bg-card",
                      item.inactiveColorClass,
                      item.inactiveBorder,
                      item.inactiveBgHover
                    )
              )}
            >
              <Icon
                className={cn(
                  "size-3.5 shrink-0 transition-colors",
                  isActive ? "text-white" : item.inactiveColorClass
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "transition-colors",
                  isActive ? "text-white" : item.inactiveColorClass
                )}
              >
                {item.label}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "ml-1 text-[10px] px-1.5 py-0 h-4 font-bold transition-colors border",
                  isActive
                    ? "bg-white/20 text-white border-white/30"
                    : item.inactiveBadgeClass
                )}
              >
                {item.count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Toolbar: Search, Type filter, Add Room */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon
              className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search room number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9.5 bg-background"
            />
          </div>

          <div className="w-full sm:w-52">
            <SelectDropdown
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                {
                  value: "ALL",
                  label: "All Room Types",
                  badge: (
                    <Badge
                      variant={typeFilter === "ALL" ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0 font-medium"
                    >
                      {initialRooms.length}
                    </Badge>
                  ),
                },
                ...roomTypes.map((t) => ({
                  value: t.id,
                  label: t.name,
                  badge: (
                    <Badge
                      variant={typeFilter === t.id ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0 font-medium"
                    >
                      {initialRooms.filter((r) => r.typeId === t.id).length}
                    </Badge>
                  ),
                })),
              ]}
              placeholder="Filter by Room Type"
              groupLabel="Filter by Room Type"
              className="h-9.5"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsProblemOpen(true)}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <ProblemIcon className="size-3.5" />
            <span>Report Issue</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMaintenanceOpen(true)}
            className="gap-1.5 border-status-maintenance/30 text-status-maintenance hover:bg-status-maintenance/10"
          >
            <MaintenanceIcon className="size-3.5" />
            <span>Schedule Maintenance</span>
          </Button>

          {isOwner && (
            <Button
              onClick={() => setIsAddOpen(true)}
              size="sm"
              className="gap-1.5 shadow-xs"
            >
              <AddIcon className="size-4" aria-hidden="true" />
              <span>Add Rooms</span>
            </Button>
          )}
        </div>
      </div>

      {/* Room Cards Grid */}
      {filteredRooms.length === 0 ? (
        <div className="w-full min-h-[300px] flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-border bg-card space-y-3">
          <div className="size-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <RoomIcon className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              No Rooms Found
            </h3>
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
        <div className="w-full grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4">
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
        key={editingRoom ? editingRoom.id : "closed"}
        room={editingRoom}
        open={Boolean(editingRoom)}
        onOpenChange={(open) => !open && setEditingRoom(null)}
        roomTypes={roomTypes}
        onSuccess={handleRefresh}
      />

      {/* Global Log Problem Dialog */}
      <LogProblemDialog
        open={isProblemOpen}
        onOpenChange={setIsProblemOpen}
        rooms={initialRooms.map((r) => ({ id: r.id, number: r.number }))}
        onSuccess={handleRefresh}
      />

      {/* Global Create Maintenance Dialog */}
      <CreateMaintenanceDialog
        open={isMaintenanceOpen}
        onOpenChange={setIsMaintenanceOpen}
        rooms={initialRooms.map((r) => ({
          id: r.id,
          number: r.number,
          status: r.status,
        }))}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
