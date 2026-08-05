import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useParams, Navigate } from 'react-router-dom'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
import Header from './components/Header'
import Footer from './components/Footer'
import PageViewTracker from './components/PageViewTracker'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import './App.css'

const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))
const RehabCenters = lazy(() => import('./pages/RehabCenters'))
const RehabCenterDetail = lazy(() => import('./pages/RehabCenterDetail'))
const RehabLocationIndex = lazy(() => import('./pages/RehabLocationIndex'))
const Portal = lazy(() => import('./pages/Portal'))
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'))
const Accessibility = lazy(() => import('./pages/Accessibility'))
const About = lazy(() => import('./pages/About'))
const AuthorPage = lazy(() => import('./pages/AuthorPage'))
const ClaimStatus = lazy(() => import('./pages/ClaimStatus'))
const SubmitCenterContinue = lazy(() => import('./pages/SubmitCenterContinue'))
const PartnerPage = lazy(() => import('./pages/PartnerPage'))
const ProviderLoginRedirect = lazy(() => import('./pages/ProviderLoginRedirect'))
const SuperadminLoginRedirect = lazy(() => import('./pages/SuperadminLoginRedirect'))
const InsuranceCoverageHub = lazy(() => import('./pages/InsuranceCoverageHub'))
const InsuranceCarrierPage = lazy(() => import('./pages/InsuranceCarrierPage'))
const InsuranceGuidePage = lazy(() => import('./pages/InsuranceGuidePage'))

function PageLoader() {
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Open Sans, Helvetica, Arial, sans-serif', color: '#5FBDF6', fontSize: '1.1rem' }}>Loading…</div>
}

function LegacyInsuranceCarrierRedirect() {
  const { slug } = useParams()
  return <Navigate to={`/insurance/${slug}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <PageViewTracker />
      <Header />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/rehab-centers" element={<RehabCenters />} />
          <Route path="/rehab-centers/state/:state/city/:city" element={<RehabLocationIndex />} />
          <Route path="/rehab-centers/state/:state" element={<RehabLocationIndex />} />
          <Route path="/rehabs/united-states/:state/:city/:facility" element={<RehabCenterDetail />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/claim-status/:ticket" element={<ClaimStatus />} />
          <Route path="/submit-center/:token" element={<SubmitCenterContinue />} />
          <Route path="/provider" element={<ProviderLoginRedirect />} />
          <Route path="/provider/login" element={<ProviderLoginRedirect />} />
          <Route path="/swa-login" element={<SuperadminLoginRedirect />} />
          <Route path="/swa-login/" element={<SuperadminLoginRedirect />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/partners/:slug" element={<PartnerPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/about" element={<About />} />
          <Route path="/insurance-coverage" element={<InsuranceCoverageHub />} />
          <Route path="/insurance-coverage/guides/:slug" element={<InsuranceGuidePage />} />
          <Route path="/insurance/:slug" element={<InsuranceCarrierPage />} />
          <Route path="/insurance-coverage/:slug" element={<LegacyInsuranceCarrierRedirect />} />
          <Route path="/our-team" element={<Navigate to="/about" replace />} />
          <Route path="/author/:slug" element={<AuthorPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Footer />
    </BrowserRouter>
  )
}
