import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Wifi } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/data-table"
import { fetchConnections, type ConnectionEntry } from "@/lib/api"

const columns: ColumnDef<ConnectionEntry>[] = [
  {
    accessorKey: "id",
    header: "Connection ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.id.slice(0, 8)}...
      </span>
    ),
  },
  {
    accessorKey: "authedPubkeys",
    header: "Authenticated Pubkeys",
    cell: ({ row }) => {
      const pubkeys = row.original.authedPubkeys
      if (pubkeys.length === 0) {
        return (
          <span className="text-sm text-muted-foreground">
            Not authenticated
          </span>
        )
      }
      return (
        <div className="flex flex-wrap gap-1">
          {pubkeys.map((pk) => (
            <Badge key={pk} variant="secondary" className="font-mono text-xs">
              {pk.slice(0, 12)}...
            </Badge>
          ))}
        </div>
      )
    },
  },
]

export function ConnectionsPage() {
  const { data } = useQuery({
    queryKey: ["connections"],
    queryFn: fetchConnections,
    refetchInterval: 3000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="text-sm text-muted-foreground">
          <Wifi className="mr-1 inline h-4 w-4" />
          Live WebSocket connections to the relay
          {data && (
            <span className="ml-1">
              ({data.connections.length})
            </span>
          )}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.connections ?? []}
        emptyMessage="No active connections."
      />
    </div>
  )
}
