import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import ProtectedRoute from './components/ProtectedRoute'
import { AdminLayout, ClientLayout, EditorLayout } from './components/Layout'
import Login from './pages/Login'
import SwaLogin from './pages/SwaLogin'
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
import AdminImport from './pages/admin/Import'
import AdminLifecycle from './pages/admin/Lifecycle'
import AdminLeads from './pages/admin/Leads'
import AdminUpsells from './pages/admin/Upsells'
import AdminEmails from './pages/admin/Emails'
import AdminInsurances from './pages/admin/Insurances'
import AdminSettings from './pages/admin/Settings'
import AdminAnalytics from './pages/admin/Analytics'
import AdminSubmissions from './pages/admin/Submissions'
import EditorDashboard from './pages/editor/Dashboard'
import EditorPosts from './pages/editor/Posts'
import ClientDashboard from './pages/client/Dashboard'
import ClientBilling from './pages/client/Billing'
import ClientMyCenter from './pages/client/MyCenter'
import ClientLeads from './pages/client/Leads'
import ClientUpsells from './pages/client/Upsells'
import PasswordRecovery from './pages/PasswordRecovery'
import ConfirmEmail from './pages/ConfirmEmail'
import { getPublicSiteUrl } from './lib/publicSite'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <div className="auth-page">Loading…</div>
  if (!user) {
    window.location.replace(`${getPublicSiteUrl()}/portal`)
    return null
  }
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'editor') return <Navigate to="/editor" replace />
  return <Navigate to="/client" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/swa-login" element={<Navigate to="/swa-login/" replace />} />
      <Route path="/swa-login/" element={<SwaLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/reset-password" element={<PasswordRecovery />} />
      <Route path="/confirm-email" element={<ConfirmEmail />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/admin" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminAnalytics /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminUsers /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/posts" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminPosts /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/posts/new" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><PostEditor /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/posts/:id/edit" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><PostEditor /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/rehab" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminRehab /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/rehab/new" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><RehabEditor /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/rehab/:id/edit" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><RehabEditor /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/claims" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminClaims /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/submissions" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminSubmissions /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/billing" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminBilling /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/import" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminImport /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/lifecycle" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminLifecycle /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/leads" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminLeads /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/upsells" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminUpsells /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/emails" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminEmails /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/insurances" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminInsurances /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><AdminLayout><AdminSettings /></AdminLayout></ProtectedRoute>} />
      <Route path="/admin/profile" element={<ProtectedRoute roles={['admin']} loginPath="/swa-login"><Navigate to="/admin/settings?tab=account" replace /></ProtectedRoute>} />

      <Route path="/editor" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><EditorDashboard /></EditorLayout></ProtectedRoute>} />
      <Route path="/editor/posts" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><EditorPosts /></EditorLayout></ProtectedRoute>} />
      <Route path="/editor/posts/new" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><PostEditor /></EditorLayout></ProtectedRoute>} />
      <Route path="/editor/posts/:id/edit" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><PostEditor /></EditorLayout></ProtectedRoute>} />
      <Route path="/editor/profile" element={<ProtectedRoute roles={['editor', 'admin']}><EditorLayout><ProfilePage /></EditorLayout></ProtectedRoute>} />

      <Route path="/client" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientDashboard /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/billing" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientBilling /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/landing" element={<Navigate to="/client/profile" replace />} />
      <Route path="/client/posts" element={<Navigate to="/client" replace />} />
      <Route path="/client/center" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientMyCenter /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/profile" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientMyCenter /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/leads" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientLeads /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/upsells" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ClientUpsells /></ClientLayout></ProtectedRoute>} />
      <Route path="/client/account" element={<ProtectedRoute roles={['client', 'admin']}><ClientLayout><ProfilePage /></ClientLayout></ProtectedRoute>} />
    </Routes>
  )
}
