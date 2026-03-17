import { useMemo } from "react"
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { DataTable } from "@/components/data-table"
import { fetchBlobs, deleteBlob, type BlobEntry } from "@/lib/api"
import { formatBytes } from "@/lib/utils"

export function BlobsPage() {
  const queryClient = useQueryClient()
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["blobs"],
      queryFn: ({ pageParam }) => fetchBlobs(pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    })

  const allBlobs = data?.pages.flatMap((p) => p.blobs) ?? []

  const deleteMutation = useMutation({
    mutationFn: deleteBlob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blobs"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })

  const columns = useMemo<ColumnDef<BlobEntry>[]>(
    () => [
      {
        accessorKey: "sha256",
        header: "SHA-256",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.sha256.slice(0, 16)}...
          </span>
        ),
      },
      {
        accessorKey: "owners",
        header: "Owner",
        cell: ({ row }) => {
          const owners = row.original.owners
          if (owners.length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>
          }
          return (
            <div className="flex flex-wrap gap-1">
              {owners.map((pk) => (
                <Badge key={pk} variant="secondary" className="font-mono text-xs">
                  {pk.slice(0, 12)}...
                </Badge>
              ))}
            </div>
          )
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) =>
          row.original.type ? (
            <Badge variant="outline">{row.original.type}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "size",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Size <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm">{formatBytes(row.original.size)}</span>
        ),
      },
      {
        accessorKey: "uploaded_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Uploaded <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.uploaded_at * 1000).toLocaleString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete blob?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the blob from S3 and the
                  database. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(row.original.sha256)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ),
      },
    ],
    [deleteMutation]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Blob Storage</h1>
        <p className="text-sm text-muted-foreground">
          Manage uploaded blobs on Tigris
          {allBlobs.length > 0 && (
            <span className="ml-1">
              ({allBlobs.length}{hasNextPage ? "+" : ""})
            </span>
          )}
        </p>
      </div>

      <DataTable
        columns={columns}
        data={allBlobs}
        emptyMessage="No blobs stored."
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
      />
    </div>
  )
}
