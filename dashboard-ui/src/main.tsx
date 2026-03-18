import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/hooks/use-theme"
import { NostrProvider } from "@/hooks/use-nostr"
import { AppLayout } from "@/components/app-layout"
import { LoginPage } from "@/pages/login"
import { NotesPage } from "@/pages/notes"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <NostrProvider>
          <BrowserRouter basename="/dashboard">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<AppLayout />}>
                <Route path="/" element={<NotesPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </NostrProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
)
