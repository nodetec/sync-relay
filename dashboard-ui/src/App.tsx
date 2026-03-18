import { Routes, Route } from "react-router"
import { AppLayout } from "@/components/app-layout"
import { LoginPage } from "@/pages/login"
import { NotesPage } from "@/pages/notes"

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<NotesPage />} />
      </Route>
    </Routes>
  )
}
