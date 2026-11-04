"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  AnalyticsData,
  AnalyticsDailyCheckIn,
  AnalyticsOccupancyDay,
  AnalyticsWeekdayCheckIn,
  CheckInTimeSlot,
  PaymentCollectionItem,
} from "@/features/register/schemas";
import {
  RoomIcon,
  SpinnerIcon,
  ClockIcon,
  CalendarIcon,
  RupeeIcon,
} from "@/lib/icons";

interface AnalyticsTabProps {
  initialData: AnalyticsData;
}

type RangeOption = "7d" | "14d" | "30d" | "month";

function formatRupee(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getBarConfig(itemCount: number) {
  if (itemCount <= 7) {
    return {
      maxBarSize: 44,
      barCategoryGap: "20%",
      tickInterval: 0,
    };
  }
  if (itemCount <= 14) {
    return {
      maxBarSize: 24,
      barCategoryGap: "16%",
      tickInterval: 1,
    };
  }
  return {
    maxBarSize: 12,
    barCategoryGap: "10%",
    tickInterval: 3,
  };
}

const PRIMARY_BLUE = "#0078D4";

const checkInChartConfig = {
  checkIns: {
    label: "Check-ins",
    color: PRIMARY_BLUE,
  },
} satisfies ChartConfig;

const occupancyChartConfig = {
  occupancyPercent: {
    label: "Occupancy %",
    color: PRIMARY_BLUE,
  },
} satisfies ChartConfig;

const paymentChartConfig = {
  netCollections: {
    label: "Net Collections",
    color: PRIMARY_BLUE,
  },
} satisfies ChartConfig;

const weekdayChartConfig = {
  count: {
    label: "Check-ins",
    color: PRIMARY_BLUE,
  },
} satisfies ChartConfig;

const timeDistributionChartConfig = {
  count: {
    label: "Check-ins",
    color: PRIMARY_BLUE,
  },
} satisfies ChartConfig;

export function AnalyticsTab({ initialData }: AnalyticsTabProps) {
  const [data, setData] = useState<AnalyticsData>(initialData);
  const [range, setRange] = useState<RangeOption>(initialData.range);
  const [isPending, startTransition] = useTransition();

  const handleRangeChange = (newRange: RangeOption) => {
    setRange(newRange);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/analytics?range=${newRange}`);
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        if (json.ok && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Error loading analytics:", err);
      }
    });
  };

  const { summary, paymentCollections, checkInTimeDistribution } = data;
  const paymentDailyData = paymentCollections.daily;

  // Weekday data aggregation (Monday to Sunday)
  const weekdayData = useMemo<AnalyticsWeekdayCheckIn[]>(() => {
    if (data.weekdayCheckIns && data.weekdayCheckIns.length === 7) {
      return data.weekdayCheckIns;
    }
    const map: Record<string, { day: string; shortDay: string; count: number }> = {
      Mon: { day: "Monday", shortDay: "Mon", count: 0 },
      Tue: { day: "Tuesday", shortDay: "Tue", count: 0 },
      Wed: { day: "Wednesday", shortDay: "Wed", count: 0 },
      Thu: { day: "Thursday", shortDay: "Thu", count: 0 },
      Fri: { day: "Friday", shortDay: "Fri", count: 0 },
      Sat: { day: "Saturday", shortDay: "Sat", count: 0 },
      Sun: { day: "Sunday", shortDay: "Sun", count: 0 },
    };
    for (const d of data.dailyCheckIns) {
      if (map[d.dayOfWeek]) {
        map[d.dayOfWeek].count += d.checkIns;
      }
    }
    return [
      map["Mon"],
      map["Tue"],
      map["Wed"],
      map["Thu"],
      map["Fri"],
      map["Sat"],
      map["Sun"],
    ];
  }, [data.weekdayCheckIns, data.dailyCheckIns]);

  // Dynamic bar sizing for time series charts
  const checkInBarConfig = getBarConfig(data.dailyCheckIns.length);
  const occupancyBarConfig = getBarConfig(data.occupancyTrend.length);

  const avgStayDuration = summary.avgStayDuration ?? 1;

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 w-full lg:h-[calc(100vh-7rem)] lg:min-h-[580px]">
      {/* ── A. Header: Title, Subtitle, Date Range & Period Controls ── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Analytics
            </h1>
            <span className="text-xs text-muted-foreground border-l border-border pl-2.5">
              Period: <span className="font-medium text-foreground">{data.startDate}</span> –{" "}
              <span className="font-medium text-foreground">{data.endDate}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            Key operational metrics on guest check-in volume, property occupancy, and revenue trends.
          </p>
        </div>

        {/* Date-range filters */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center rounded-lg border bg-card p-0.5 shadow-2xs">
            {(["7d", "14d", "30d", "month"] as const).map((r) => {
              const labels: Record<RangeOption, string> = {
                "7d": "Last 7 Days",
                "14d": "Last 14 Days",
                "30d": "Last 30 Days",
                month: "This Month",
              };
              return (
                <Button
                  key={r}
                  variant={range === r ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleRangeChange(r)}
                  className="h-7 px-2.5 text-xs font-medium"
                >
                  {labels[r]}
                </Button>
              );
            })}
          </div>

          {isPending && (
            <div className="flex items-center text-xs text-muted-foreground">
              <SpinnerIcon className="size-3.5 animate-spin text-primary" />
            </div>
          )}
        </div>
      </header>

      {/* ── B. KPI Section: Horizontal Row with 4 Summary Cards ── */}
      <section
        aria-label="Key Performance Indicators"
        className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 shrink-0"
      >
        {/* KPI 1: Total Check-ins */}
        <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Total Check-ins</span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground mt-0.5">
              {summary.totalCheckIns}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium truncate">
              {summary.totalGuests} {summary.totalGuests === 1 ? "guest" : "guests"}
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <ClockIcon className="size-4" />
          </div>
        </div>

        {/* KPI 2: Daily Average Stay */}
        <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Daily Average Stay</span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground mt-0.5">
              {avgStayDuration} <span className="text-xs sm:text-sm font-normal text-muted-foreground font-sans">{avgStayDuration === 1 ? "night" : "nights"}</span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Average stay duration
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <CalendarIcon className="size-4" />
          </div>
        </div>

        {/* KPI 3: Average Occupancy */}
        <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Average Occupancy</span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground mt-0.5">
              {summary.occupancyRate}%
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Average room occupancy
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <RoomIcon className="size-4" />
          </div>
        </div>

        {/* KPI 4: Revenue */}
        <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Revenue</span>
            <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground mt-0.5 truncate">
              {formatRupee(summary.totalRevenue ?? paymentCollections.totalNetCollections)}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Net collections in period
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
            <RupeeIcon className="size-4" />
          </div>
        </div>
      </section>

      {/* ── C. Analytics Charts: Compact 2-Row Layout ── */}
      <section
        aria-label="Analytics Charts"
        className="flex-1 min-h-0 flex flex-col gap-2.5 sm:gap-3 w-full"
      >
        {/* Row 1: Daily Check-in Volume (Left) & Room Occupancy Rate (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3 flex-1 min-h-[220px] lg:min-h-0">
          {/* Chart 1: Daily Check-in Volume */}
          <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
            <div className="flex items-center justify-between pb-1 shrink-0">
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Daily Check-in Volume
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Number of arrival check-in bookings per day
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 w-full pt-1">
              <ChartContainer config={checkInChartConfig} className="h-full w-full aspect-auto">
                <BarChart
                  data={data.dailyCheckIns}
                  margin={{ top: 6, right: 8, left: -22, bottom: 0 }}
                  barCategoryGap={checkInBarConfig.barCategoryGap}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={10}
                    interval={checkInBarConfig.tickInterval}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={10}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as AnalyticsDailyCheckIn;
                      return (
                        <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
                          <div className="font-semibold text-foreground">
                            {item.label} ({item.dayOfWeek})
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                            <span>Check-ins:</span>
                            <span className="font-bold text-foreground">
                              {item.checkIns} {item.checkIns === 1 ? "arrival" : "arrivals"}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="checkIns"
                    fill={PRIMARY_BLUE}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={checkInBarConfig.maxBarSize}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </div>

          {/* Chart 2: Room Occupancy Rate (%) - Vertical Bar Chart */}
          <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
            <div className="flex items-center justify-between pb-1 shrink-0">
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Room Occupancy Rate (%)
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Daily occupied rooms relative to total capacity
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 w-full pt-1">
              <ChartContainer config={occupancyChartConfig} className="h-full w-full aspect-auto">
                <BarChart
                  data={data.occupancyTrend}
                  margin={{ top: 6, right: 8, left: -20, bottom: 0 }}
                  barCategoryGap={occupancyBarConfig.barCategoryGap}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={10}
                    interval={occupancyBarConfig.tickInterval}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={10}
                    unit="%"
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as AnalyticsOccupancyDay;
                      return (
                        <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
                          <div className="font-semibold text-foreground">
                            {item.label}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                            <span>Occupancy Rate:</span>
                            <span className="font-bold text-foreground">
                              {item.occupancyPercent}%
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {item.occupiedRooms} of {item.totalRooms} rooms occupied
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="occupancyPercent"
                    fill={PRIMARY_BLUE}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={occupancyBarConfig.maxBarSize}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </div>

        {/* Row 2: Payment Collections (Left), Check-ins by Weekday (Center), Time Distribution (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 flex-1 min-h-[220px] lg:min-h-0">
          {/* Chart 3: Payment Collection Trends - Horizontal Bar Chart */}
          <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
            <div className="flex items-center justify-between pb-1 shrink-0">
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Payment Collection Trends
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Actual completed payments minus refunds
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground hidden sm:inline">Total:</span>
                <span className="font-semibold text-primary">
                  {formatRupee(paymentCollections.totalNetCollections)}
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-0 w-full pt-1">
              <ChartContainer config={paymentChartConfig} className="h-full w-full aspect-auto">
                <BarChart
                  layout="vertical"
                  data={paymentDailyData}
                  margin={{ top: 6, right: 16, left: 4, bottom: 0 }}
                  barCategoryGap={paymentDailyData.length > 14 ? "8%" : "16%"}
                >
                  <CartesianGrid horizontal={false} vertical strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={9}
                    tickFormatter={(val) =>
                      `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={9}
                    width={50}
                    interval={
                      paymentDailyData.length > 20
                        ? 3
                        : paymentDailyData.length > 10
                        ? 1
                        : 0
                    }
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as PaymentCollectionItem;
                      return (
                        <div className="rounded-lg border bg-popover p-2 text-xs shadow-md space-y-1 min-w-[170px]">
                          <div className="font-semibold text-foreground border-b border-border pb-1">
                            {item.label}
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                            <span>Gross:</span>
                            <span className="font-medium text-foreground">
                              {formatRupee(item.grossPayments)}
                            </span>
                          </div>
                          {item.refunds > 0 && (
                            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-[11px]">
                              <span>Refunds:</span>
                              <span className="font-medium">
                                -{formatRupee(item.refunds)}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between font-bold text-primary pt-0.5 border-t border-border text-[11px]">
                            <span>Net Collections:</span>
                            <span>{formatRupee(item.netCollections)}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="netCollections"
                    fill={PRIMARY_BLUE}
                    radius={[0, 3, 3, 0]}
                    maxBarSize={paymentDailyData.length > 14 ? 8 : 16}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          </div>

          {/* Chart 4: Check-ins by Weekday - Horizontal Bar Chart (Mon–Sun) */}
          <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
            <div className="flex items-center justify-between pb-1 shrink-0">
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Check-ins by Weekday
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Arrival volume by day of week (Monday–Sunday)
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 w-full pt-1">
              <ChartContainer config={weekdayChartConfig} className="h-full w-full aspect-auto">
                <BarChart
                  layout="vertical"
                  data={weekdayData}
                  margin={{ top: 6, right: 28, left: 8, bottom: 0 }}
                  barCategoryGap="16%"
                >
                  <CartesianGrid horizontal={false} vertical strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={9}
                    domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.15))]}
                  />
                  <YAxis
                    type="category"
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    fontSize={10}
                    width={80}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as AnalyticsWeekdayCheckIn;
                      return (
                        <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
                          <div className="font-semibold text-foreground">
                            {item.day}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                            <span>Check-ins:</span>
                            <span className="font-bold text-foreground">
                              {item.count} {item.count === 1 ? "arrival" : "arrivals"}
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill={PRIMARY_BLUE}
                    radius={[0, 3, 3, 0]}
                    maxBarSize={16}
                  >
                    <LabelList
                      dataKey="count"
                      position="right"
                      offset={6}
                      fontSize={10}
                      className="fill-muted-foreground font-mono font-medium"
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>

          {/* Chart 5: Check-in Time Distribution - Horizontal Bar Chart */}
          <div className="rounded-xl border bg-card p-2.5 sm:p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
            <div className="flex items-center justify-between pb-1 shrink-0">
              <div>
                <h2 className="text-xs font-semibold text-foreground">
                  Check-in Time Distribution
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Arrival patterns by time of day
                </p>
              </div>
            </div>
            <div className="flex-1 min-h-0 w-full pt-1">
              {summary.totalCheckIns === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No check-ins recorded for this period
                </div>
              ) : (
                <ChartContainer config={timeDistributionChartConfig} className="h-full w-full aspect-auto">
                  <BarChart
                    layout="vertical"
                    data={checkInTimeDistribution}
                    margin={{ top: 6, right: 28, left: 6, bottom: 0 }}
                    barCategoryGap="18%"
                  >
                    <CartesianGrid horizontal={false} vertical strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      fontSize={9}
                      domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.15))]}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      fontSize={10}
                      width={68}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload as CheckInTimeSlot;
                        return (
                          <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
                            <div className="font-semibold text-foreground">
                              {item.label} ({item.timeRange})
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                              <span>Arrivals:</span>
                              <span className="font-bold text-foreground">
                                {item.count} ({item.percentage}%)
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill={PRIMARY_BLUE}
                      radius={[0, 3, 3, 0]}
                      maxBarSize={18}
                    >
                      <LabelList
                        dataKey="count"
                        position="right"
                        offset={6}
                        fontSize={10}
                        className="fill-muted-foreground font-mono font-medium"
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
