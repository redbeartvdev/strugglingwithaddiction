import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchApi, apiEnabled } from '../lib/api'

export default function PartnerPage() {
  const { slug } = useParams()
  const [landing, setLanding] = useState(null)
  const [posts, setPosts] = useState([])

  useEffect(() => {
    if (!apiEnabled()) return
    fetchApi(`/api/partners/${slug}`).then(setLanding)
    fetchApi(`/api/partners/${slug}/posts`).then(setPosts).catch(() => setPosts([]))
  }, [slug])

  if (!apiEnabled() || !landing) {
    return (
      <main style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <p>Partner page not available.</p>
        <Link to="/">Home</Link>
      </main>
    )
  }

  return (
    <main style={{ padding: '3rem 1rem', maxWidth: 800, margin: '0 auto' }}>
      <h1>{landing.headline || landing.display_name}</h1>
      <div dangerouslySetInnerHTML={{ __html: landing.about_html }} />
      <section style={{ marginTop: '2rem' }}>
        <h2>Posts</h2>
        {posts.length === 0 && <p>No posts yet.</p>}
        {posts.map(p => (
          <article key={p.slug} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #eee' }}>
            <h3>{p.title}</h3>
            <p>{p.excerpt}</p>
            <div dangerouslySetInnerHTML={{ __html: p.content }} />
          </article>
        ))}
      </section>
    </main>
  )
}
