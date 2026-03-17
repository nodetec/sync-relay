import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchBlobs, deleteBlob } from "@/lib/api"
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Blob Storage</h1>
        <p className="text-sm text-muted-foreground">
          Manage uploaded blobs on Tigris
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Blobs{" "}
            {allBlobs.length > 0 && (
              <span className="font-normal text-muted-foreground">
                ({allBlobs.length}{hasNextPage ? "+" : ""})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!allBlobs.length ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No blobs stored.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SHA-256</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allBlobs.map((blob) => (
                    <TableRow key={blob.sha256}>
                      <TableCell className="font-mono text-xs">
                        {blob.sha256.slice(0, 16)}...
                      </TableCell>
                      <TableCell>
                        {blob.owners.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {blob.owners.map((pk) => (
                              <Badge
                                key={pk}
                                variant="secondary"
                                className="font-mono text-xs"
                              >
                                {pk.slice(0, 12)}...
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {blob.type ? (
                          <Badge variant="outline">{blob.type}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatBytes(blob.size)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(blob.uploaded_at * 1000).toLocaleString()}
                      </TableCell>
                      <TableCell>
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
                                This will permanently delete the blob from S3 and
                                the database. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  deleteMutation.mutate(blob.sha256)
                                }
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hasNextPage && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
