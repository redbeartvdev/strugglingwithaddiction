import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import './App.css'

const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))
const RehabCenters = lazy(() => import('./pages/RehabCenters'))
const Portal = lazy(() => import('./pages/Portal'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'))
const Accessibility = lazy(() => import('./pages/Accessibility'))
const AuthorPage = lazy(() => import('./pages/AuthorPage'))
const ClaimStatus = lazy(() => import('./pages/ClaimStatus'))
const PartnerPage = lazy(() => import('./pages/PartnerPage'))

function PageLoader() {
  return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'PT Serif, serif', color: '#98b8c4', fontSize: '1.1rem' }}>Loading…</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/rehab-centers" element={<RehabCenters />} />
          <Route path="/portal" element={<Portal />} />
          <Route path="/claim-status/:ticket" element={<ClaimStatus />} />
          <Route path="/partners/:slug" element={<PartnerPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/accessibility" element={<Accessibility />} />
          <Route path="/author/:slug" element={<AuthorPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Footer />
    </BrowserRouter>
  )
}
