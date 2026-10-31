"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { AddItemDialog } from "./add-item-dialog";
import { EditItemDialog } from "./edit-item-dialog";
import { UpdateStockDialog } from "./update-stock-dialog";
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
  CheckIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";

interface InventoryManagerProps {
  initialItems: FormattedInventoryItem[];
  summary: InventorySummary;
}

type FilterTab = "ALL" | "LOW_STOCK" | "DAMAGED" | "DISCONTINUED";

export function InventoryManager({
  initialItems,
  summary: serverSummary,
}: InventoryManagerProps) {
  const [items, setItems] = useState<FormattedInventoryItem[]>(initialItems);
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");

  // Keep items synced if server revalidation passes new initialItems
  if (initialItems !== prevInitialItems) {
    setPrevInitialItems(initialItems);
    setItems(initialItems);
  }

  // Dialog & Sheet States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [updatePreselectedItemId, setUpdatePreselectedItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<FormattedInventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<FormattedInventoryItem | null>(null);

  // Dynamic summary derived directly from active items state for instant UI responsiveness
  const summary = useMemo(() => {
    let lowStockCount = 0;
    let availableStock = 0;
    let activeItems = 0;

    for (const item of items) {
      if (item.isActive) {
        activeItems++;
        if (item.isLowStock) {
          lowStockCount++;
        }
      }
      availableStock += item.available;
    }

    return {
      totalItems: items.length,
      activeItems,
      availableStock,
      lowStockCount,
      totalStoreUnits: availableStock,
      totalRoomsUnits: serverSummary.totalRoomsUnits,
      totalLaundryUnits: serverSummary.totalLaundryUnits,
      totalDamagedUnits: serverSummary.totalDamagedUnits,
      totalDiscontinuedUnits: serverSummary.totalDiscontinuedUnits,
    };
  }, [items, serverSummary]);

  const handleItemCreated = (newItem: FormattedInventoryItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === newItem.id);
      if (exists) {
        return prev.map((i) => (i.id === newItem.id ? newItem : i));
      }
      return [newItem, ...prev].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleItemUpdated = (updatedItem: FormattedInventoryItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
    );
    if (editingItem?.id === updatedItem.id) {
      setEditingItem(updatedItem);
    }
    if (historyItem?.id === updatedItem.id) {
      setHistoryItem(updatedItem);
    }
  };

  // Counts for simple filter tabs
  const filterCounts = useMemo(() => {
    return {
      all: items.length,
      lowStock: items.filter((i) => i.isLowStock).length,
      damaged: items.filter((i) => i.damaged > 0).length,
      discontinued: items.filter((i) => i.discontinued > 0).length,
    };
  }, [items]);

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
      if (filterTab === "DAMAGED") {
        return item.damaged > 0;
      }
      if (filterTab === "DISCONTINUED") {
        return item.discontinued > 0;
      }

      return true;
    });
  }, [items, search, filterTab]);

  const handleOpenUpdateForItem = (itemId: string) => {
    setUpdatePreselectedItemId(itemId);
    setIsUpdateOpen(true);
  };

  const handleOpenHistory = (item: FormattedInventoryItem) => {
    setHistoryItem(item);
  };

  const handleOpenEdit = (item: FormattedInventoryItem) => {
    setEditingItem(item);
  };

  return (
    <div className="space-y-6">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. Total Items */}
        <StatCard
          title="Total Items"
          value={summary.totalItems}
          icon={<InventoryIcon className="size-5 text-primary" />}
          hint={`${summary.activeItems} active for operations`}
        />

        {/* 2. Available Stock */}
        <StatCard
          title="Available Stock"
          value={summary.availableStock}
          icon={<CheckIcon className="size-5 text-emerald-600 dark:text-emerald-400" />}
          hint="Units available for guest rooms & service"
          badge={
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
            >
              Ready to Use
            </Badge>
          }
        />

        {/* 3. Low Stock Items */}
        <StatCard
          title="Low Stock Items"
          value={summary.lowStockCount}
          icon={<ProblemIcon className="size-5 text-amber-500" />}
          hint={
            summary.lowStockCount > 0
              ? "Items at or below alert threshold"
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
                Healthy
              </Badge>
            )
          }
        />
      </div>

      {/* Controls & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search & Simple Filters */}
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

          {/* Simple Filters: All, Low Stock, Damaged, Discontinued */}
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
              All ({filterCounts.all})
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
              {filterCounts.lowStock > 0 && (
                <span className="inline-flex items-center justify-center size-4 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                  {filterCounts.lowStock}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("DAMAGED")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all shrink-0",
                filterTab === "DAMAGED"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Damaged ({filterCounts.damaged})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("DISCONTINUED")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-all shrink-0",
                filterTab === "DISCONTINUED"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Discontinued ({filterCounts.discontinued})
            </button>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUpdatePreselectedItemId(null);
              setIsUpdateOpen(true);
            }}
            className="gap-1.5 h-9 font-medium"
          >
            <TransferIcon className="size-4" />
            Update Stock
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            className="gap-1.5 h-9 font-medium"
          >
            <AddIcon className="size-4" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Desktop / Tablet Simplified Table View */}
      <div className="hidden md:block rounded-xl border border-border/70 overflow-hidden bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">Item Name</th>
                <th className="py-3.5 px-4 text-center font-semibold">Available</th>
                <th className="py-3.5 px-4 text-center font-semibold">In Use</th>
                <th className="py-3.5 px-4 text-center font-semibold">Damaged</th>
                <th className="py-3.5 px-4 text-center font-semibold">Discontinued</th>
                <th className="py-3.5 px-4 text-center font-semibold">Status</th>
                <th className="py-3.5 px-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <InventoryIcon className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No inventory items found.</p>
                    <p className="text-xs mt-1">
                      {search || filterTab !== "ALL"
                        ? "Try adjusting your search query or selected filter."
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
                    {/* Item Name */}
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm">
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground font-normal">
                          ({item.unit})
                        </span>
                        {!item.isActive && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Available Stock */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span
                        className={cn(
                          "font-bold px-2 py-0.5 rounded-md inline-block",
                          item.isLowStock
                            ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-extrabold"
                            : "text-foreground"
                        )}
                      >
                        {item.available}
                      </span>
                    </td>

                    {/* In Use Stock */}
                    <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                      {item.inUse}
                    </td>

                    {/* Damaged Stock */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span
                        className={cn(
                          item.damaged > 0
                            ? "text-rose-600 dark:text-rose-400 font-semibold"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.damaged > 0 ? item.damaged : "-"}
                      </span>
                    </td>

                    {/* Discontinued Stock */}
                    <td className="py-3.5 px-4 text-center font-mono text-muted-foreground">
                      {item.discontinued > 0 ? item.discontinued : "-"}
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
                          In Stock
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs gap-1 font-medium text-foreground hover:text-primary"
                          onClick={() => handleOpenUpdateForItem(item.id)}
                          title="Update Stock"
                        >
                          <TransferIcon className="size-3.5" />
                          <span className="hidden lg:inline">Update</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenHistory(item)}
                          title="View History"
                        >
                          <HistoryIcon className="size-3.5" />
                          <span className="hidden lg:inline">History</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
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
                    Alert Threshold: {item.reorderLevel > 0 ? `${item.reorderLevel} ${item.unit}` : "None"}
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
                      In Stock
                    </Badge>
                  )}
                </div>
              </div>

              {/* 4 Stock Categories Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                  <div className="text-[9px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">
                    Available
                  </div>
                  <div
                    className={cn(
                      "font-mono font-bold text-sm mt-0.5",
                      item.isLowStock && "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {item.available}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                  <div className="text-[9px] text-blue-600 dark:text-blue-400 uppercase font-bold">
                    In Use
                  </div>
                  <div className="font-mono font-bold text-sm mt-0.5">{item.inUse}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                  <div className="text-[9px] text-rose-600 dark:text-rose-400 uppercase font-bold">
                    Damaged
                  </div>
                  <div className="font-mono font-bold text-sm mt-0.5 text-rose-600 dark:text-rose-400">
                    {item.damaged}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                  <div className="text-[9px] text-zinc-500 uppercase font-bold">
                    Discont.
                  </div>
                  <div className="font-mono font-bold text-sm mt-0.5 text-zinc-500">
                    {item.discontinued}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs gap-1 font-medium"
                  onClick={() => handleOpenUpdateForItem(item.id)}
                >
                  <TransferIcon className="size-3" />
                  Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs gap-1 font-medium"
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

      {/* Simplified Add Item Dialog */}
      <AddItemDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={handleItemCreated}
      />

      {/* Edit Item Dialog */}
      <EditItemDialog
        item={editingItem}
        open={Boolean(editingItem)}
        onOpenChange={(open) => !open && setEditingItem(null)}
        onSuccess={handleItemUpdated}
      />

      {/* Simplified Update Stock Dialog */}
      <UpdateStockDialog
        items={items.filter((i) => i.isActive)}
        preselectedItemId={updatePreselectedItemId}
        open={isUpdateOpen}
        onOpenChange={setIsUpdateOpen}
        onSuccess={handleItemUpdated}
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
