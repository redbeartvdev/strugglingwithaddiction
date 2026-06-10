import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FaMapMarkerAlt } from 'react-icons/fa'
import { fetchApi, apiEnabled } from '../lib/api'
import { slugToStateName } from '../lib/stateSlugs'
import { useDirectorySeo } from '../hooks/useDirectorySeo'
import JsonLd from '../components/JsonLd'
import RehabSearch from '../components/RehabSearch'
import { centerMatchesService, extractStateFromLocation, normalizeText, specialtyMatchesAnyService } from '../lib/rehabServices'
import './RehabCenters.css'

function filterCenters(centers, { query, state, service }) {
  const q = normalizeText(query)
  return centers.filter(center => {
    if (state) {
      const centerState = center.state || extractStateFromLocation(center.location)
      if (!centerState || normalizeText(centerState) !== normalizeText(state)) return false
    }
    if (service && !centerMatchesService(center.specialties, service)) return false
    if (q) {
      const blob = normalizeText([center.name, center.location, center.description, ...(center.specialties || [])].join(' '))
      if (!blob.includes(q)) return false
    }
    return true
  })
}

export default function DirectoryLocationPage() {
  const { state: stateSlug, city: citySlug } = useParams()
  const stateName = slugToStateName(stateSlug)
  const [page, setPage] = useState(null)
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')

  const apiPath = citySlug
    ? `/api/directory/states/${stateSlug}/cities/${citySlug}`
    : `/api/directory/states/${stateSlug}`

  const canonicalPath = citySlug
    ? `/rehab-centers/location/${stateSlug}/${citySlug}`
    : `/rehab-centers/location/${stateSlug}`

  const fallbackTitle = citySlug
    ? `Rehab Centers in ${citySlug.replace(/-/g, ' ')}, ${stateName}`
    : `Drug Rehab Centers in ${stateName}`

  useDirectorySeo({
    title: page?.meta_title || page?.title || fallbackTitle,
    description:
      page?.meta_description
      || `Find accredited addiction treatment centers in ${citySlug ? `${citySlug.replace(/-/g, ' ')}, ` : ''}${stateName}.`,
    canonicalPath,
  })

  useEffect(() => {
    if (!apiEnabled()) {
      setLoading(false)
      return
    }
    const centersPath = new URLSearchParams({ state: stateName })
    if (page?.filter_city) centersPath.set('city', page.filter_city)
    else if (citySlug) centersPath.set('city', citySlug.replace(/-/g, ' '))

    Promise.all([
      fetchApi(apiPath).catch(() => null),
      fetchApi(`/api/rehab-centers?${centersPath}`),
    ])
      .then(([pageData, centerData]) => {
        if (pageData) setPage(pageData)
        if (centerData?.length) setCenters(centerData)
      })
      .finally(() => setLoading(false))
  }, [apiPath, stateName, citySlug, page?.filter_city])

  const filteredCenters = useMemo(
    () => filterCenters(centers, { query, state: stateName, service: serviceFilter }),
    [centers, query, stateName, serviceFilter],
  )

  const faqJsonLd = page?.faq?.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: page.faq.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      }
    : null

  const bodyHtml = page?.body_html || `<p>Browse verified treatment centers in ${stateName}${citySlug ? ` near ${citySlug.replace(/-/g, ' ')}` : ''}.</p>`

  return (
    <main className="rehab-page">
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <section className="rehab-hero">
        <div className="rehab-hero-overlay" />
        <div className="container rehab-hero-content">
          <span className="section-label" style={{ color: '#98b8c4' }}>Treatment Directory</span>
          <h1>{page?.title || fallbackTitle}</h1>
        </div>
      </section>

      <div className="container" style={{ padding: '2rem 0 0' }}>
        <div
          className="directory-page-body"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>

      <div className="container">
        <RehabSearch
          query={query}
          onQueryChange={setQuery}
          state={stateName}
          onStateChange={() => {}}
          service={serviceFilter}
          onServiceChange={setServiceFilter}
          resultCount={filteredCenters.length}
          totalCount={centers.length}
          onClear={() => { setQuery(''); setServiceFilter('') }}
          hasActiveFilters={Boolean(query || serviceFilter)}
        />
      </div>

      <section className="rehab-list-section">
        <div className="container rehab-list">
          {loading && <p style={{ textAlign: 'center' }}>Loading centers…</p>}
          {!loading && filteredCenters.map(center => (
            <article className="rehab-card" key={center.id}>
              <div className="rehab-card-body" style={{ gridColumn: '1 / -1' }}>
                <div className="rehab-card-top">
                  <div>
                    <div className="rehab-name-row">
                      <h2>
                        <Link to={`/rehab-centers/${center.slug}`}>{center.name}</Link>
                      </h2>
                      {center.is_sponsored && <span className="rehab-sponsored-badge">Sponsored</span>}
                    </div>
                    <span className="rehab-location"><FaMapMarkerAlt aria-hidden="true" /> {center.location}</span>
                  </div>
                  <Link to={`/rehab-centers/${center.slug}`} className="btn">View profile</Link>
                </div>
                <p className="rehab-description">{center.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {page?.faq?.length > 0 && (
        <section className="directory-faq-section">
          <div className="container">
            <h2>Frequently asked questions</h2>
            {page.faq.map(item => (
              <details key={item.question} className="directory-faq-item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <div className="container" style={{ paddingBottom: '3rem' }}>
        <Link to="/rehab-centers">← Back to full directory</Link>
      </div>
    </main>
  )
}
