import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react"
import { RelayClient } from "@/lib/nostr"
import type { NostrEvent } from "@/lib/nostr"
import { unwrapGiftWrap } from "@/lib/nip59"
import {
  parseNoteRumor,
  parseNotebookRumor,
  getRumorType,
  type Note,
  type Notebook,
} from "@/lib/rumor"

const PUBKEY_STORAGE_KEY = "pubkey"

interface NostrContextValue {
  pubkey: string | null
  isAuthenticated: boolean
  relay: RelayClient | null
  signIn: () => Promise<void>
  signOut: () => void
  notes: Note[]
  notebooks: Notebook[]
  isLoading: boolean
  error: string | null
}

const NostrContext = createContext<NostrContextValue | null>(null)

export function NostrProvider({ children }: { children: ReactNode }) {
  const [pubkey, setPubkey] = useState<string | null>(
    () => localStorage.getItem(PUBKEY_STORAGE_KEY)
  )
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [notebooks, setNotebooks] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const relayRef = useRef<RelayClient | null>(null)
  const notesMapRef = useRef<Map<string, Note>>(new Map())
  const notebooksMapRef = useRef<Map<string, Notebook>>(new Map())

  const updateNotesState = useCallback(() => {
    const allNotes = Array.from(notesMapRef.current.values())
    // Filter out deleted notes and sort by modifiedAt desc
    const filtered = allNotes
      .filter((n) => !n.deletedAt)
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
    setNotes(filtered)
  }, [])

  const updateNotebooksState = useCallback(() => {
    const allNotebooks = Array.from(notebooksMapRef.current.values())
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
    setNotebooks(allNotebooks as unknown as Note[])
  }, [])

  const handleEvent = useCallback(
    async (_subId: string, event: NostrEvent) => {
      if (event.kind !== 1059) return

      try {
        const rumor = await unwrapGiftWrap(event)
        const type = getRumorType(rumor)

        if (type === "note") {
          const note = parseNoteRumor(rumor)
          const existing = notesMapRef.current.get(note.id)
          // LWW: only update if newer
          if (!existing || note.modifiedAt >= existing.modifiedAt) {
            notesMapRef.current.set(note.id, note)
            updateNotesState()
          }
        } else if (type === "notebook") {
          const notebook = parseNotebookRumor(rumor)
          const existing = notebooksMapRef.current.get(notebook.id)
          if (!existing || notebook.modifiedAt >= existing.modifiedAt) {
            notebooksMapRef.current.set(notebook.id, notebook)
            updateNotebooksState()
          }
        }
      } catch (err) {
        console.error("Failed to unwrap gift wrap:", err)
      }
    },
    [updateNotesState, updateNotebooksState]
  )

  const connectRelay = useCallback(
    (pk: string) => {
      const relay = new RelayClient()
      relayRef.current = relay

      setIsLoading(true)
      setError(null)

      relay.onAuth = () => {
        setIsAuthenticated(true)
        // Subscribe to gift wraps addressed to this pubkey
        relay.subscribe("notes", [{ kinds: [1059], "#p": [pk] }])
      }

      relay.onEvent = (subId: string, event: NostrEvent) => {
        void handleEvent(subId, event)
      }

      relay.onEose = () => {
        setIsLoading(false)
      }

      relay.onClose = () => {
        setIsAuthenticated(false)
      }

      relay.connect()
    },
    [handleEvent]
  )

  const signIn = useCallback(async () => {
    if (!window.nostr) {
      setError("Install a Nostr extension (Alby, nos2x) to sign in")
      throw new Error("NIP-07 extension not available")
    }

    setError(null)

    try {
      const pk = await window.nostr.getPublicKey()
      localStorage.setItem(PUBKEY_STORAGE_KEY, pk)
      setPubkey(pk)
      connectRelay(pk)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sign in"
      setError(message)
      throw err
    }
  }, [connectRelay])

  const signOut = useCallback(() => {
    localStorage.removeItem(PUBKEY_STORAGE_KEY)
    setPubkey(null)
    setIsAuthenticated(false)
    setNotes([])
    setNotebooks([])
    notesMapRef.current.clear()
    notebooksMapRef.current.clear()
    if (relayRef.current) {
      relayRef.current.disconnect()
      relayRef.current = null
    }
  }, [])

  // Auto-connect on mount if pubkey exists in localStorage
  useEffect(() => {
    if (pubkey && !relayRef.current) {
      connectRelay(pubkey)
    }
    return () => {
      if (relayRef.current) {
        relayRef.current.disconnect()
        relayRef.current = null
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: NostrContextValue = {
    pubkey,
    isAuthenticated,
    relay: relayRef.current,
    signIn,
    signOut,
    notes,
    notebooks: notebooks as unknown as Notebook[],
    isLoading,
    error,
  }

  return (
    <NostrContext.Provider value={value}>
      {children}
    </NostrContext.Provider>
  )
}

export function useNostr(): NostrContextValue {
  const context = useContext(NostrContext)
  if (!context) {
    throw new Error("useNostr must be used within a NostrProvider")
  }
  return context
}
