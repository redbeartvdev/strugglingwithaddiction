import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import ProtectedRoute from './components/ProtectedRoute'
import { AdminLayout, ClientLayout, EditorLayout } from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import ProfilePage from './pages/Profile'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminPosts from './pages/admin/Posts'
import PostEditor from './pages/admin/posts/PostEditor'
import AdminRehab from './pages/admin/Rehab'
import RehabEditor from './pages/admin/rehab/RehabEditor'
import AdminClaims from './pages/admin/Claims'
import AdminBilling from './pages/admin/Billing'
import AdminScrape from './pages/admin/Scrape'
import EditorDashboard from './pages/editor/Dashboard'
import EditorPosts from './pages/editor/Posts'
import ClientDashboard from './pages/client/Dashboard'
import ClientBilling from './pages/client/Billing'
import ClientLanding from './pages/client/Landing'
import ClientPosts from './pages/client/Posts'
import ClientMyCenter from './pages/client/MyCenter'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="auth-page">Loading…</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'editor') return <Navigate to="/editor" replace />
  return <Navigate to="/client" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminUsers /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/posts" element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminPosts /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/posts/new" element={<ProtectedRoute roles={['admin']}><AdminLayout><PostEditor /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/posts/:id/edit" element={<ProtectedRoute roles={['admin']}><AdminLayout><PostEditor /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/rehab" element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminRehab /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/rehab/new" element={<ProtectedRoute roles={['admin']}><AdminLayout><RehabEditor /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/rehab/:id/edit" element={<ProtectedRoute roles={['admin']}><AdminLayout><RehabEditor /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/claims" element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminClaims /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/billing" element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminBilling /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/scrape" element={<ProtectedRoute roles={['admin']}><AdminLayout><AdminScrape /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/profile" element={<ProtectedRoute roles={['admin']}><AdminLayout><ProfilePage /></AdminLayout></ProtectedRoute>} />

      <Route path="/editor" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><EditorDashboard /></EditorLayout></ProtectedRoute>} />
      <Route path="/editor/posts" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><EditorPosts /></EditorLayout></ProtectedRoute>} />
      <Route path="/editor/posts/new" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><PostEditor /></EditorLayout></ProtectedRoute>} />
      <Route path="/editor/posts/:id/edit" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><PostEditor /></EditorLayout></ProtectedRoute>} />
      <Route path="/editor/profile" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><ProfilePage /></EditorLayout></ProtectedRoute>} />

      <Route path="/client" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientDashboard /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/billing" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientBilling /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/landing" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientLanding /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/posts" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientPosts /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/center" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientMyCenter /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/profile" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ProfilePage /></ClientLayout></ProtectedRoute>} />
    </Routes>
  )
}
