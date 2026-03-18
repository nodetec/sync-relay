import { useState, useEffect, useRef, useCallback } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { FileText, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useNostr } from "@/hooks/use-nostr"
import { decryptBlob } from "@/lib/blob-crypto"
import type { BlobRef, Note } from "@/lib/rumor"

// ── Blob image cache & component ────────────────────────────────────────

const blobUrlCache = new Map<string, string>()

function BlobImage({
  blobRef,
  alt,
  className,
}: {
  blobRef: BlobRef
  alt?: string
  className?: string
}) {
  const [url, setUrl] = useState<string | null>(
    () => blobUrlCache.get(blobRef.ciphertextHash) ?? null
  )
  const [error, setError] = useState(false)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (url || fetchedRef.current) return
    fetchedRef.current = true

    async function load() {
      try {
        const cached = blobUrlCache.get(blobRef.ciphertextHash)
        if (cached) {
          setUrl(cached)
          return
        }

        const response = await fetch(`/${blobRef.ciphertextHash}`)
        if (!response.ok) throw new Error("fetch failed")
        const data = new Uint8Array(await response.arrayBuffer())
        const decrypted = decryptBlob(data, blobRef.encryptionKey)
        const blob = new Blob([decrypted as BlobPart])
        const objectUrl = URL.createObjectURL(blob)
        blobUrlCache.set(blobRef.ciphertextHash, objectUrl)
        setUrl(objectUrl)
      } catch {
        setError(true)
      }
    }

    void load()
  }, [blobRef, url])

  if (error) {
    return (
      <div className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
        Failed to load image
      </div>
    )
  }

  if (!url) {
    return <Skeleton className="h-48 w-full rounded-md" />
  }

  return (
    <img
      src={url}
      alt={alt ?? ""}
      className={cn("max-w-full rounded-md", className)}
    />
  )
}

// ── Markdown renderer with attachment support ───────────────────────────

function NoteMarkdown({ note }: { note: Note }) {
  const blobMap = useRef<Map<string, BlobRef>>(new Map())

  // Build lookup by plaintext hash
  useEffect(() => {
    blobMap.current.clear()
    for (const blob of note.blobs) {
      blobMap.current.set(blob.plaintextHash, blob)
    }
  }, [note.blobs])

  const imgComponent = useCallback(
    (props: React.ComponentProps<"img">) => {
      const src = props.src ?? ""

      // Handle attachment:// protocol (e.g., "attachment://abc123.png")
      if (src.startsWith("attachment://")) {
        const plaintextHash = src.replace("attachment://", "").replace(/\.\w+$/, "")
        const blobRef = blobMap.current.get(plaintextHash)
        if (blobRef) {
          return <BlobImage blobRef={blobRef} alt={props.alt ?? undefined} />
        }
        return (
          <span className="text-xs text-muted-foreground">
            [missing attachment]
          </span>
        )
      }

      // Regular image
      return (
        <img
          src={src}
          alt={props.alt ?? ""}
          className="max-w-full rounded-md"
        />
      )
    },
    []
  )

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: imgComponent,
        }}
      >
        {note.markdown}
      </ReactMarkdown>
    </div>
  )
}

// ── Note list item ──────────────────────────────────────────────────────

function formatRelativeDate(millis: number): string {
  const now = Date.now()
  const diff = now - millis
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 30) {
    return new Date(millis).toLocaleDateString()
  }
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

function getSnippet(markdown: string, maxLen = 120): string {
  // Strip the title line and get first bit of content
  const lines = markdown.split("\n")
  const contentLines = lines.filter((l) => !l.startsWith("# ") && l.trim())
  const text = contentLines.join(" ").slice(0, maxLen)
  return text.length >= maxLen ? text + "..." : text
}

function NoteListItem({
  note,
  isSelected,
  onSelect,
}: {
  note: Note
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-border transition-colors",
        "hover:bg-accent/50",
        isSelected && "bg-accent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-tight truncate">
          {note.title || "Untitled"}
        </h3>
        <span className="text-xs text-muted-foreground shrink-0">
          {formatRelativeDate(note.modifiedAt)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
        {getSnippet(note.markdown)}
      </p>
      {note.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────────

function NoteListSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────

export function NotesPage() {
  const { notes, isLoading, isAuthenticated } = useNostr()
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null

  // Auto-select first note when notes load
  useEffect(() => {
    if (notes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(notes[0].id)
    }
  }, [notes, selectedNoteId])

  // If the selected note was removed (e.g., deleted), clear selection
  useEffect(() => {
    if (selectedNoteId && !notes.find((n) => n.id === selectedNoteId)) {
      setSelectedNoteId(notes.length > 0 ? notes[0].id : null)
    }
  }, [notes, selectedNoteId])

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-sm">Connecting to relay...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full -m-4 md:-m-6">
      {/* Left pane: note list */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">
            Notes
            {!isLoading && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({notes.length})
              </span>
            )}
          </h2>
        </div>
        <ScrollArea className="flex-1">
          {isLoading && notes.length === 0 ? (
            <NoteListSkeleton />
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">No notes yet</p>
            </div>
          ) : (
            notes.map((note) => (
              <NoteListItem
                key={note.id}
                note={note}
                isSelected={note.id === selectedNoteId}
                onSelect={() => setSelectedNoteId(note.id)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      <Separator orientation="vertical" />

      {/* Right pane: note detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedNote ? (
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto px-6 py-6">
              <NoteMarkdown note={selectedNote} />
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Select a note to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
