import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

/** Email continue-link target → opens the submit form with saved draft. */
export default function SubmitCenterContinue() {
  const { token } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      navigate('/rehab-centers', { replace: true })
      return
    }
    navigate(`/rehab-centers?submit_resume=${encodeURIComponent(token)}`, { replace: true })
  }, [token, navigate])

  return (
    <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Loading your saved submission…
    </div>
  )
}
