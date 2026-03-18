import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Wifi, FileText, HardDrive, Database } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import {
  fetchStats,
  fetchEventsByKind,
  fetchEventsOverTime,
  fetchStorageByUser,
} from "@/lib/api"
import { formatBytes, kindLabel, shortPubkey } from "@/lib/utils"

const statCards = [
  { key: "connections" as const, label: "Active Connections", icon: Wifi },
  { key: "events" as const, label: "Stored Events", icon: FileText },
  { key: "blobs" as const, label: "Blobs", icon: HardDrive },
  { key: "blobStorage" as const, label: "Blob Storage", icon: Database },
]

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "hsl(200 70% 50%)",
  "hsl(280 65% 60%)",
  "hsl(340 75% 55%)",
  "hsl(160 60% 45%)",
  "hsl(30 80% 55%)",
]

export function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 5000,
  })

  const { data: eventsByKind } = useQuery({
    queryKey: ["stats", "events-by-kind"],
    queryFn: fetchEventsByKind,
  })

  const { data: eventsOverTime } = useQuery({
    queryKey: ["stats", "events-over-time"],
    queryFn: fetchEventsOverTime,
  })

  const { data: storageByUser } = useQuery({
    queryKey: ["stats", "storage-by-user"],
    queryFn: fetchStorageByUser,
  })

  const pieConfig = useMemo<ChartConfig>(() => {
    if (!eventsByKind?.data) return {}
    const config: ChartConfig = {}
    for (const item of eventsByKind.data) {
      config[`kind-${item.kind}`] = {
        label: kindLabel(item.kind),
        color: PIE_COLORS[eventsByKind.data.indexOf(item) % PIE_COLORS.length],
      }
    }
    return config
  }, [eventsByKind])

  const areaConfig: ChartConfig = {
    events: { label: "Events", color: "var(--chart-1)" },
  }

  const barConfig = useMemo<ChartConfig>(() => {
    if (!storageByUser?.data) return {}
    const config: ChartConfig = {}
    for (let i = 0; i < storageByUser.data.length; i++) {
      config[`user-${i}`] = {
        label: shortPubkey(storageByUser.data[i].pubkey),
        color: PIE_COLORS[i % PIE_COLORS.length],
      }
    }
    return config
  }, [storageByUser])

  const pieData = useMemo(() => {
    return (eventsByKind?.data ?? []).map((item) => ({
      name: kindLabel(item.kind),
      value: item.count,
      fill: pieConfig[`kind-${item.kind}`]?.color ?? "var(--chart-1)",
    }))
  }, [eventsByKind, pieConfig])

  const barData = useMemo(() => {
    return (storageByUser?.data ?? []).map((item, i) => ({
      pubkey: shortPubkey(item.pubkey),
      storage: item.storage,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }))
  }, [storageByUser])

  const totalEvents = useMemo(() => {
    return (eventsByKind?.data ?? []).reduce((sum, item) => sum + item.count, 0)
  }, [eventsByKind])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Relay and storage overview
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stat.key === "blobStorage"
                  ? formatBytes(stats?.blobStorage ?? 0)
                  : (stats?.[stat.key] ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        {/* Events over time - area chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Events Over Time</CardTitle>
            <CardDescription>New events per day (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={areaConfig} className="h-[300px] w-full">
              <AreaChart data={eventsOverTime?.data ?? []} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T00:00:00")
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v: string) => {
                        const d = new Date(v + "T00:00:00")
                        return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      }}
                    />
                  }
                />
                <defs>
                  <linearGradient id="fillEvents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="events"
                  type="monotone"
                  fill="url(#fillEvents)"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Events by kind - pie chart */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Events by Kind</CardTitle>
            <CardDescription>Distribution of stored event types</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieConfig} className="mx-auto h-[300px] w-full">
              <PieChart accessibilityLayer>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, _name, item) => (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: item.payload.fill }}
                          />
                          <span className="text-muted-foreground">{item.payload.name}</span>
                          <span className="ml-auto font-mono font-medium tabular-nums">
                            {(value as number).toLocaleString()}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={5}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                              {totalEvents.toLocaleString()}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 24} className="fill-muted-foreground text-sm">
                              Events
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
                <ChartLegend
                  content={<ChartLegendContent nameKey="name" />}
                  className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Storage by user - bar chart */}
      {barData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Storage by User</CardTitle>
            <CardDescription>Top users by blob storage usage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="h-[300px] w-full">
              <BarChart data={barData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="pubkey" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(v: number) => formatBytes(v)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value) => (
                        <span className="font-mono font-medium">{formatBytes(value as number)}</span>
                      )}
                    />
                  }
                />
                <Bar dataKey="storage" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
