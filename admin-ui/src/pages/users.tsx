import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { fetchUsers, type UserEntry } from "@/lib/api"
import { formatBytes, usagePercent, usageColor } from "@/lib/utils"

export function UsersPage() {
  const { data } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    refetchInterval: 10000,
  })

  const defaultLimit = data?.default_storage_limit_bytes ?? 1024 * 1024 * 1024

  const columns = useMemo<ColumnDef<UserEntry>[]>(
    () => [
      {
        accessorKey: "pubkey",
        header: "Pubkey",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.pubkey.slice(0, 16)}...
          </span>
        ),
      },
      {
        accessorKey: "storage_used_bytes",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Storage <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const user = row.original
          const limit = user.storage_limit_bytes ?? defaultLimit
          const pct = usagePercent(user.storage_used_bytes, limit)
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs">
                <span>
                  {formatBytes(user.storage_used_bytes)} / {formatBytes(limit)}
                </span>
                {user.storage_limit_bytes !== null && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0"
                  >
                    custom
                  </Badge>
                )}
              </div>
              <div className="h-1.5 w-full max-w-[200px] rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${usageColor(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "blob_count",
        header: "Blobs",
        cell: ({ row }) => (
          <span className="text-right tabular-nums block">
            {row.original.blob_count.toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "event_count",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Events <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-right tabular-nums block">
            {row.original.event_count.toLocaleString()}
          </span>
        ),
      },
    ],
    [defaultLimit]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          <Users className="mr-1 inline h-4 w-4" />
          Per-user storage and event usage
          {data && (
            <span className="ml-1">
              ({data.users.length})
            </span>
          )}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={data?.users ?? []}
        emptyMessage="No users found."
      />
    </div>
  )
}
