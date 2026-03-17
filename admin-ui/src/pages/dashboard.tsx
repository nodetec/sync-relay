import { useQuery } from "@tanstack/react-query"
import { Wifi, FileText, HardDrive, Database } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchStats } from "@/lib/api"
import { formatBytes } from "@/lib/utils"

const statCards = [
  { key: "connections" as const, label: "Active Connections", icon: Wifi },
  { key: "events" as const, label: "Stored Events", icon: FileText },
  { key: "blobs" as const, label: "Blobs", icon: HardDrive },
  { key: "blobStorage" as const, label: "Blob Storage", icon: Database },
]

export function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 5000,
  })

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
                  ? formatBytes(data?.blobStorage ?? 0)
                  : (data?.[stat.key] ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
