import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { fetchApi, apiEnabled } from '../lib/api'
import { usePageSeo } from '../hooks/usePageSeo'
import { buildRehabDirectoryUrl } from '../lib/rehabServices'
import { detectVisitorLocation } from '../lib/geo'
import { INSURANCE_GUIDES } from '../data/insuranceGuides'
import {
  getInsuranceCarrierContent,
  INSURANCE_CONTENT_AUTHOR,
  INSURANCE_CONTENT_UPDATED,
} from '../data/insuranceCarrierContent'
import CarrierFacilitiesModule from '../components/CarrierFacilitiesModule'
import './InsuranceCoverage.css'

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  const innerRef = useRef(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    const sync = () => setHeight(el.scrollHeight)
    sync()

    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [answer])

  return (
    <div className={`icov-faq-item${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="icov-faq-trigger"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="icov-faq-marker" aria-hidden="true" />
        {question}
      </button>
      <div
        className="icov-faq-panel"
        style={{ height: open ? height : 0 }}
        aria-hidden={!open}
      >
        <div ref={innerRef} className="icov-faq-panel-inner">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  )
}

export default function InsuranceCarrierPage() {
  const { slug } = useParams()
  const content = getInsuranceCarrierContent(slug)
  const catalogSlug = content?.catalogSlug || slug
  const hasApi = apiEnabled()
  const [catalogResult, setCatalogResult] = useState({ slug: '', row: null })
  const [geo, setGeo] = useState({ state: '' })
  const catalog = catalogResult.slug === catalogSlug ? catalogResult.row : null
  const catalogReady = !hasApi || catalogResult.slug === catalogSlug

  useEffect(() => {
    detectVisitorLocation()
      .then((loc) => setGeo({ state: loc?.state || '' }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasApi) return
    let cancelled = false
    fetchApi(`/api/insurances/${encodeURIComponent(catalogSlug)}`)
      .then((row) => {
        if (!cancelled) setCatalogResult({ slug: catalogSlug, row })
      })
      .catch(() => {
        if (!cancelled) setCatalogResult({ slug: catalogSlug, row: null })
      })
    return () => { cancelled = true }
  }, [catalogSlug, hasApi])

  usePageSeo(
    content || catalog
      ? {
          title: content?.title || catalog?.meta_title || `Does ${catalog?.name} Cover Drug and Alcohol Rehab?`,
          description: content?.metaDescription || catalog?.meta_description || catalog?.summary || '',
          image: catalog?.logo_url || content?.logoUrl,
        }
      : null,
  )

  if (!content && !catalogReady) {
    return <main className="icov-page"><div className="container icov-empty">Loading…</div></main>
  }

  if (!content && !catalog) return <Navigate to="/insurance-coverage" replace />

  if (!content && catalog) {
    return (
      <main className="icov-page">
        <section className="icov-hero icov-hero--carrier">
          <div className="container icov-hero-inner">
            <p className="icov-breadcrumb">
              <Link to="/insurance-coverage">Insurance coverage</Link>
              <span aria-hidden="true"> / </span>
              <span>{catalog.name}</span>
            </p>
            {catalog.logo_url && (
              <img className="icov-carrier-logo" src={catalog.logo_url} alt="" width={180} height={54} />
            )}
            <h1>{catalog.hero_title || `Does ${catalog.name} cover rehab?`}</h1>
            {catalog.summary && <p>{catalog.summary}</p>}
          </div>
        </section>
        <section className="icov-section">
          <div className="container icov-prose">
            {catalog.content_html
              ? <div dangerouslySetInnerHTML={{ __html: catalog.content_html }} />
              : <p>Coverage depends on your specific plan. Always confirm with your insurance company and the treatment center.</p>}
          </div>
        </section>
        <section className="icov-section icov-section--directory">
          <div className="container">
            <CarrierFacilitiesModule insuranceName={catalog.name} state={geo.state} />
          </div>
        </section>
      </main>
    )
  }

  const directoryUrl = buildRehabDirectoryUrl({
    insurance: content.directoryName,
    state: geo.state || undefined,
  })
  const logoUrl = catalog?.logo_url || content.logoUrl
  const commonFaqs = [
    [
      `How do I know what my ${content.name} plan covers?`,
      `Call the number on your card and ask about substance use disorder treatment. Ask about your deductible, copay, coinsurance, network, and approval rules. Coverage depends on your specific plan.`,
    ],
    [
      `Will ${content.name} pay for out-of-network rehab?`,
      `Some plans include out-of-network coverage and some do not. Even when it is included, your share is usually higher. Ask for an estimate from both the insurance company and the center.`,
    ],
    [
      'Can a treatment center call the insurance company for me?',
      'Yes. Admissions and billing teams often ask about coverage and submit clinical information for approval. You should still confirm the answers with the insurance company and keep your own notes.',
    ],
  ]

  return (
    <main className="icov-page">
      <section className="icov-hero icov-hero--carrier">
        <div className="container icov-hero-inner">
          <p className="icov-breadcrumb">
            <Link to="/insurance-coverage">Insurance coverage</Link>
            <span aria-hidden="true"> / </span>
            <span>{content.name}</span>
          </p>
          {logoUrl && (
            <img className="icov-carrier-logo" src={logoUrl} alt="" width={180} height={54} />
          )}
          <h1>{content.title}</h1>
          <p className="icov-article-meta">
            By <Link to={`/author/${INSURANCE_CONTENT_AUTHOR.slug}`}>{INSURANCE_CONTENT_AUTHOR.name}</Link>
            <span aria-hidden="true"> · </span>
            Last updated {INSURANCE_CONTENT_UPDATED}
          </p>
        </div>
      </section>

      <section className="icov-section">
        <article className="container icov-prose">
          <section className="icov-guide-section" aria-labelledby="short-answer">
            <h2 id="short-answer">Short answer</h2>
            <p className="icov-lead">{content.summary}</p>
          </section>

          <aside className="icov-coverage-disclaimer" aria-label="Coverage disclaimer">
            <strong>Coverage depends on your specific plan.</strong>
            <span>Always confirm with your insurance company and the treatment center.</span>
          </aside>

          <section className="icov-guide-section" aria-labelledby="why-covered">
            <h2 id="why-covered">Why health plans cover addiction treatment</h2>
            <p>
              Two federal laws help protect access to addiction care. The <strong>Affordable Care Act</strong>
              treats substance use disorder services as an essential health benefit for many individual and
              small-group plans. That means those plans must include some form of treatment. It does not mean
              every service, center, or length of stay is automatically covered.
            </p>
            <p>
              The <strong>Mental Health Parity and Addiction Equity Act</strong> says many health plans cannot
              make addiction and mental health coverage more restrictive than medical and surgical coverage.
              For example, a plan generally cannot use much higher copays or much stricter visit limits only
              for addiction care. Some plans are not covered by every part of these laws. Plan networks,
              medical-necessity rules, and approval steps can still apply. {content.planNote}
            </p>
          </section>

          <section className="icov-guide-section" aria-labelledby="treatment-covered">
            <h2 id="treatment-covered">What treatment may be covered</h2>
            <p>
              The right level of care depends on your health, substance use, withdrawal risk, home support,
              and earlier treatment. An assessment helps the clinical team decide what is safe. Your plan
              then decides whether that level meets its coverage rules.
            </p>
            <dl className="icov-definition-list">
              <div>
                <dt>Detox</dt>
                <dd>Medical staff help you stop using safely and manage withdrawal symptoms.</dd>
              </div>
              <div>
                <dt>Inpatient or residential treatment</dt>
                <dd>You live at a treatment center and receive structured care throughout the day.</dd>
              </div>
              <div>
                <dt>Partial hospitalization program (PHP)</dt>
                <dd>You attend treatment for much of the day but usually sleep somewhere else.</dd>
              </div>
              <div>
                <dt>Intensive outpatient program (IOP)</dt>
                <dd>You attend several treatment sessions each week while continuing to live at home.</dd>
              </div>
              <div>
                <dt>Outpatient treatment</dt>
                <dd>You meet with a counselor, doctor, or group on a less intensive schedule.</dd>
              </div>
              <div>
                <dt>Medication for addiction</dt>
                <dd>Medicines such as buprenorphine (Suboxone) or methadone can reduce opioid cravings and withdrawal.</dd>
              </div>
            </dl>
            <p>
              A plan may cover some levels but not others in your area. It may approve a short period first
              and review your progress before approving more care. Medication coverage can also depend on
              the drug list and the professional who prescribes or provides it.
            </p>
          </section>

          <section className="icov-guide-section" aria-labelledby="what-you-pay">
            <h2 id="what-you-pay">What you may pay</h2>
            <p>
              Your share of the cost depends on your plan and where you receive care. Four common insurance
              words can help you understand an estimate:
            </p>
            <ul>
              <li><strong>Deductible:</strong> the amount you pay for covered care before the plan starts sharing many costs.</li>
              <li><strong>Copay:</strong> a fixed amount, such as $40, that you pay for a covered visit or service.</li>
              <li><strong>Coinsurance:</strong> a percentage of the plan’s allowed amount that you pay after the deductible.</li>
              <li><strong>Out-of-pocket maximum:</strong> the most you pay for covered, in-network care during a plan year before the plan pays all covered in-network costs for the rest of that year.</li>
            </ul>
            <div className="icov-example">
              <strong>Example only</strong>
              <p>
                Imagine a plan has a $2,000 deductible and 20% coinsurance. You have already paid $1,500
                toward the deductible. If the plan’s allowed amount for a covered service is $3,000, you
                may first owe the remaining $500 deductible. The remaining allowed amount would be $2,500.
                At 20% coinsurance, your share of that part would be $500. Your total in this simple example
                would be $1,000. Real claims can work differently. This is not a treatment price or a promise
                of what you will pay.
              </p>
            </div>
            <p>
              Ask how much of your deductible and out-of-pocket maximum you have already met. Also ask whether
              separate charges from doctors, laboratories, medications, or transportation follow different rules.
            </p>
          </section>

          <section className="icov-guide-section" aria-labelledby="network">
            <h2 id="network">In-network and out-of-network care</h2>
            <p>
              <strong>In-network</strong> means the center has a contract with your plan for agreed payment
              rates. Your cost is usually lower. <strong>Out-of-network</strong> means there is no contract
              for your plan. You may pay more, and the center may bill you for an amount the plan does not pay.
              Some plans provide no out-of-network coverage except for emergencies.
            </p>
            <p>
              {content.networkNote} If no suitable in-network center is available, ask about a
              <strong> single case agreement</strong>. This is a one-time contract between the insurance
              company and an out-of-network center. It is not guaranteed. Get the terms in writing before care begins.
            </p>
          </section>

          <section className="icov-guide-section" aria-labelledby="authorization">
            <h2 id="authorization">Prior authorization</h2>
            <p>
              <strong>Prior authorization</strong> means the insurance company must approve a service before
              it begins. Approval is not a guarantee that every charge will be paid. The center’s admissions
              or clinical team usually sends information about your symptoms, safety risks, and treatment
              history. You should not have to explain the medical details alone.
            </p>
            <p>
              {content.authorizationNote} Detox requests are often reviewed quickly because withdrawal can
              create immediate medical risks. After treatment begins, the plan may ask for updates before it
              approves more days. Ask for the approval number, approved level of care, approved dates, and the
              process if more time is needed.
            </p>
          </section>

          <section className="icov-guide-section" aria-labelledby="confirm-coverage">
            <h2 id="confirm-coverage">How to confirm your own coverage</h2>
            <ol className="icov-steps">
              <li>Find the customer service or behavioral health phone number on the back of your insurance card.</li>
              <li>Call and say, “I am asking about coverage for substance use disorder treatment.”</li>
              <li>Read the questions below one at a time. Ask the representative to explain any word you do not understand.</li>
              <li>Write down each answer, the representative’s name, the date, and the call reference number.</li>
              <li>Call the treatment center and compare what its admissions team learns with your notes.</li>
            </ol>
            <div className="icov-call-questions">
              <h3>Questions you can read out loud</h3>
              <ul>
                <li>Which levels of substance use disorder treatment does my plan cover?</li>
                <li>What are my deductible, copay, coinsurance, and out-of-pocket amounts?</li>
                <li>Is the treatment center I am considering in my exact plan network?</li>
                <li>Do I need prior authorization, a referral, or an assessment before treatment?</li>
                <li>Are there day, visit, location, or medication limits?</li>
                <li>What happens if no suitable in-network center is available?</li>
              </ul>
            </div>
            <p>
              Do not rely on a general website statement as a final answer. Your plan documents and the
              insurance company’s response control how a claim is handled. Keep copies of written answers,
              approval notices, and bills.
            </p>
          </section>
        </article>
      </section>

      <section className="icov-section icov-section--muted" id="facilities">
        <div className="container icov-prose">
          <h2>Find a facility that lists {content.directoryName}</h2>
          <p>
            The directory below shows treatment centers that state they accept {content.directoryName}.
            A listing does not mean the center participates in your exact network or that your plan will
            pay for care. Use it to make a starting list. Then confirm coverage with the insurance company
            and the treatment center. You can also <Link to={directoryUrl}>open the full filtered directory</Link>.
          </p>
        </div>
      </section>

      <section className="icov-section icov-section--directory">
        <div className="container">
          <CarrierFacilitiesModule insuranceName={content.directoryName} state={geo.state} />
        </div>
      </section>

      <section className="icov-section">
        <div className="container icov-prose">
          <section className="icov-guide-section" aria-labelledby="faq">
            <h2 id="faq">Frequently asked questions</h2>
            <div className="icov-faq-list">
              {[...content.faqs, ...commonFaqs].map(([question, answer]) => (
                <FaqItem key={question} question={question} answer={answer} />
              ))}
            </div>
          </section>

          <aside className="icov-help-box">
            <h2>Free, confidential help</h2>
            <p>
              Call the <strong>SAMHSA National Helpline at 1-800-662-4357</strong>. The service is free,
              confidential, and available 24 hours a day. You can also search the federal directory at{' '}
              <a href="https://findtreatment.gov" target="_blank" rel="noopener noreferrer">FindTreatment.gov</a>.
            </p>
          </aside>

          <section className="icov-guide-section" aria-labelledby="sources">
            <h2 id="sources">Sources</h2>
            <ul>
              <li><a href={content.sourceUrl} target="_blank" rel="noopener noreferrer">{content.sourceLabel}</a></li>
              <li><a href="https://www.healthcare.gov/coverage/mental-health-substance-abuse-coverage/" target="_blank" rel="noopener noreferrer">HealthCare.gov: mental health and substance abuse coverage</a></li>
              <li><a href="https://www.samhsa.gov/find-support/how-to-pay-for-treatment" target="_blank" rel="noopener noreferrer">SAMHSA: how to pay for treatment</a></li>
            </ul>
          </section>
        </div>
      </section>

      <section className="icov-section icov-section--muted">
        <div className="container">
          <div className="icov-section-head">
            <h2>Related articles</h2>
          </div>
          <ul className="icov-guide-grid">
            {INSURANCE_GUIDES.slice(0, 3).map((g) => (
              <li key={g.slug}>
                <Link to={`/insurance-coverage/guides/${g.slug}`} className="icov-guide-card">
                  <strong>{g.title}</strong>
                  <span>{g.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
