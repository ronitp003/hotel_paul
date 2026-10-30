"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatCard } from "@/components/shared/stat-card";
import { AddItemDialog } from "./add-item-dialog";
import { EditItemDialog } from "./edit-item-dialog";
import { MoveStockDialog } from "./move-stock-dialog";
import { ItemHistorySheet } from "./item-history-sheet";
import type {
  FormattedInventoryItem,
  InventorySummary,
} from "@/server/services/inventory.service";
import {
  InventoryIcon,
  ProblemIcon,
  AddIcon,
  TransferIcon,
  HistoryIcon,
  EditIcon,
  SearchIcon,
  CloseIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

interface InventoryManagerProps {
  initialItems: FormattedInventoryItem[];
  summary: InventorySummary;
}

type FilterTab = "ALL" | "LOW_STOCK" | "ACTIVE" | "INACTIVE";

export function InventoryManager({
  initialItems,
  summary,
}: InventoryManagerProps) {
  const [items] = useState<FormattedInventoryItem[]>(initialItems);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");

  // Dialog & Sheet States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [movePreselectedItemId, setMovePreselectedItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FormattedInventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<FormattedInventoryItem | null>(null);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Text search
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        if (!item.name.toLowerCase().includes(query)) {
          return false;
        }
      }

      // 2. Tab filter
      if (filterTab === "LOW_STOCK") {
        return item.isLowStock;
      }
      if (filterTab === "ACTIVE") {
        return item.isActive;
      }
      if (filterTab === "INACTIVE") {
        return !item.isActive;
      }

      return true;
    });
  }, [items, search, filterTab]);

  const handleOpenMoveForItem = (itemId: string) => {
    setMovePreselectedItemId(itemId);
    setIsMoveOpen(true);
  };

  const handleOpenHistory = (item: FormattedInventoryItem) => {
    setHistoryItem(item);
  };

  const handleOpenEdit = (item: FormattedInventoryItem) => {
    setEditingItem(item);
  };

  return (
    <div className="space-y-6">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tracked Items"
          value={summary.totalItems}
          icon={<InventoryIcon className="size-5" />}
          hint={`${summary.activeItems} active for operations`}
        />

        <StatCard
          title="Low Stock Items"
          value={summary.lowStockCount}
          icon={<ProblemIcon className="size-5 text-amber-500" />}
          hint={
            summary.lowStockCount > 0
              ? "Store inventory at or below threshold"
              : "All stock levels healthy"
          }
          badge={
            summary.lowStockCount > 0 ? (
              <Badge
                variant="destructive"
                className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold"
              >
                Needs Restock
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              >
                Adequate
              </Badge>
            )
          }
        />

        <StatCard
          title="Store Stock"
          value={summary.totalStoreUnits}
          icon={<InventoryIcon className="size-5 text-primary" />}
          hint="Units available in main storage"
        />

        <StatCard
          title="In Circulation"
          value={summary.totalRoomsUnits + summary.totalLaundryUnits}
          icon={<TransferIcon className="size-5 text-indigo-500" />}
          hint={`${summary.totalRoomsUnits} in rooms · ${summary.totalLaundryUnits} at laundry`}
        />
      </div>

      {/* Low Stock Warning Banner */}
      {summary.lowStockCount > 0 && filterTab !== "LOW_STOCK" && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ProblemIcon className="size-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <AlertTitle className="font-semibold text-sm">
                Low Stock Alert Triggered
              </AlertTitle>
              <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
                {summary.lowStockCount} item(s) have reached or fallen below their reorder threshold in the store room.
              </AlertDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterTab("LOW_STOCK")}
            className="border-amber-500/40 bg-background text-xs font-medium hover:bg-amber-500/20"
          >
            View Low Stock ({summary.lowStockCount})
          </Button>
        </Alert>
      )}

      {/* Controls & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <div className="relative max-w-sm w-full">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search items by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <CloseIcon className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/50 text-xs self-start sm:self-auto overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setFilterTab("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all shrink-0",
                filterTab === "ALL"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("LOW_STOCK")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all shrink-0 flex items-center gap-1",
                filterTab === "LOW_STOCK"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Low Stock
              {summary.lowStockCount > 0 && (
                <span className="inline-flex items-center justify-center size-4 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                  {summary.lowStockCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("ACTIVE")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all shrink-0",
                filterTab === "ACTIVE"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("INACTIVE")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all shrink-0",
                filterTab === "INACTIVE"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMovePreselectedItemId(null);
              setIsMoveOpen(true);
            }}
            className="gap-1.5 h-9"
          >
            <TransferIcon className="size-4" />
            Move Stock
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5 h-9"
          >
            <AddIcon className="size-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Desktop / Tablet Table View */}
      <div className="hidden md:block rounded-xl border border-border/70 overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4 text-center">Store</th>
                <th className="py-3 px-4 text-center">In Rooms</th>
                <th className="py-3 px-4 text-center">Laundry</th>
                <th className="py-3 px-4 text-center">Damaged</th>
                <th className="py-3 px-4 text-center">Total Usable</th>
                <th className="py-3 px-4 text-center">Reorder Level</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <InventoryIcon className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No inventory items found.</p>
                    <p className="text-xs mt-1">
                      {search || filterTab !== "ALL"
                        ? "Try adjusting your search query or active filter."
                        : "Click 'Add Item' to start tracking hotel linen and amenities."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      "transition-colors hover:bg-muted/30 group",
                      item.isLowStock && "bg-amber-500/5 hover:bg-amber-500/10",
                      !item.isActive && "opacity-60 bg-muted/10"
                    )}
                  >
                    {/* Item Name & Unit */}
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({item.unit})
                        </span>
                        {!item.isActive && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Store Stock */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span
                        className={cn(
                          "font-bold px-2 py-0.5 rounded-md",
                          item.isLowStock
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-extrabold"
                            : "text-foreground"
                        )}
                      >
                        {item.qtyStore}
                      </span>
                    </td>

                    {/* In Rooms */}
                    <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                      {item.qtyRooms}
                    </td>

                    {/* Laundry */}
                    <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                      {item.qtyLaundry}
                    </td>

                    {/* Damaged */}
                    <td className="py-3.5 px-4 text-center font-mono text-rose-600 dark:text-rose-400">
                      {item.qtyDamaged > 0 ? item.qtyDamaged : "-"}
                    </td>

                    {/* Total Usable */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-foreground">
                      {item.totalInCirculation}
                    </td>

                    {/* Reorder Level */}
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-muted-foreground">
                      {item.reorderLevel > 0 ? item.reorderLevel : "None"}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {item.isLowStock ? (
                        <Badge
                          variant="destructive"
                          className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 gap-1 text-[11px] font-semibold"
                        >
                          <ProblemIcon className="size-3" />
                          Low Stock
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px]"
                        >
                          Normal
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs gap-1"
                          onClick={() => handleOpenMoveForItem(item.id)}
                          title="Move Stock"
                        >
                          <TransferIcon className="size-3.5" />
                          <span className="hidden lg:inline">Move</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs gap-1"
                          onClick={() => handleOpenHistory(item)}
                          title="View Movement History"
                        >
                          <HistoryIcon className="size-3.5" />
                          <span className="hidden lg:inline">History</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Item"
                        >
                          <EditIcon className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card Grid View (`md:hidden`) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
        {filteredItems.length === 0 ? (
          <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed rounded-xl">
            <InventoryIcon className="size-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-sm">No inventory items found.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Card
              key={item.id}
              className={cn(
                "p-4 space-y-3",
                item.isLowStock && "border-rose-500/30 bg-rose-500/5",
                !item.isActive && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-foreground text-sm flex items-center gap-1.5">
                    {item.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({item.unit})
                    </span>
                  </h4>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Reorder Threshold: {item.reorderLevel > 0 ? `${item.reorderLevel} ${item.unit}` : "None"}
                  </div>
                </div>

                <div>
                  {item.isLowStock ? (
                    <Badge
                      variant="destructive"
                      className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 gap-1 text-[10px] font-semibold"
                    >
                      <ProblemIcon className="size-2.5" />
                      Low Stock
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
                    >
                      Normal
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quantities Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                  <div className="text-[9px] text-muted-foreground uppercase font-bold">Store</div>
                  <div
                    className={cn(
                      "font-mono font-bold text-sm mt-0.5",
                      item.isLowStock && "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {item.qtyStore}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                  <div className="text-[9px] text-muted-foreground uppercase font-bold">Rooms</div>
                  <div className="font-mono font-bold text-sm mt-0.5">{item.qtyRooms}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                  <div className="text-[9px] text-muted-foreground uppercase font-bold">Laundry</div>
                  <div className="font-mono font-bold text-sm mt-0.5">{item.qtyLaundry}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                  <div className="text-[9px] text-rose-600 dark:text-rose-400 uppercase font-bold">Damaged</div>
                  <div className="font-mono font-bold text-sm mt-0.5 text-rose-600 dark:text-rose-400">
                    {item.qtyDamaged}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs gap-1"
                  onClick={() => handleOpenMoveForItem(item.id)}
                >
                  <TransferIcon className="size-3" />
                  Move
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs gap-1"
                  onClick={() => handleOpenHistory(item)}
                >
                  <HistoryIcon className="size-3" />
                  History
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleOpenEdit(item)}
                >
                  <EditIcon className="size-3.5" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Item Dialog */}
      <AddItemDialog open={isAddOpen} onOpenChange={setIsAddOpen} />

      {/* Edit Item Dialog */}
      <EditItemDialog
        item={editingItem}
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
      />

      {/* Move Stock Dialog */}
      <MoveStockDialog
        items={items.filter((i) => i.isActive)}
        preselectedItemId={movePreselectedItemId}
        open={isMoveOpen}
        onOpenChange={setIsMoveOpen}
      />

      {/* Item History Slide-over Sheet */}
      <ItemHistorySheet
        item={historyItem}
        open={Boolean(historyItem)}
        onOpenChange={(open) => !open && setHistoryItem(null)}
      />
    </div>
  );
}
