import { useState } from "react"
import { useNavigate } from "react-router"
import { Orbit, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useNostr } from "@/hooks/use-nostr"

export function LoginPage() {
  const navigate = useNavigate()
  const { pubkey, signIn } = useNostr()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // If already signed in, redirect
  if (pubkey) {
    navigate("/", { replace: true })
    return null
  }

  async function handleSignIn() {
    setError("")
    setLoading(true)
    try {
      await signIn()
      navigate("/")
    } catch {
      if (!window.nostr) {
        setError("Install a Nostr extension (Alby, nos2x) to sign in")
      } else {
        setError("Failed to sign in. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Orbit className="h-5 w-5 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Sign in to Comet</CardTitle>
          <CardDescription>
            Use your Nostr identity to access your notes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            className="w-full"
            onClick={handleSignIn}
            disabled={loading}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {loading ? "Signing in..." : "Sign in with Extension"}
          </Button>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          {!window.nostr && !error && (
            <p className="text-sm text-muted-foreground text-center">
              Requires a Nostr browser extension (Alby, nos2x, etc.)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
