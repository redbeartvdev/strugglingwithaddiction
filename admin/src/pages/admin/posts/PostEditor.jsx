import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { api } from '../../../api'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import EditorJsField from '../../../components/EditorJsField'
import FeaturedImageField from '../../../components/FeaturedImageField'
import { IconExternalLink } from '../../../components/Icons'
import { blocksToHtml } from '../../../lib/editorjsHtml'
import { editorDataFromPost } from '../../../lib/htmlToEditorJs'
import { resolveMediaUrl } from '../../../lib/mediaUrl'
import { postPublicUrl, toDatetimeLocal, fromDatetimeLocal, editorStatus } from '../../../lib/publicSite'

function postsBase(pathname) {
  return pathname.startsWith('/editor') ? '/editor/posts' : '/admin/posts'
}

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function PostEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base = postsBase(pathname)
  const isEdit = Boolean(id)
  const editorApi = useRef(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [editorData, setEditorData] = useState(isEdit ? null : { blocks: [] })
  const [hasPassword, setHasPassword] = useState(false)
  const [form, setForm] = useState({
    slug: '',
    title: '',
    excerpt: '',
    status: 'draft',
    published_at: '',
    visibility_password: '',
    category_ids: [],
    featured_image_key: null,
    featured_image_url: null,
    meta_title: '',
    meta_description: '',
    focus_keyword: '',
    seo_noindex: false,
  })

  useEffect(() => {
    api('/api/categories').then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEdit) return
    setLoading(true)
    api(`/api/editor/posts/${id}`)
      .then(post => {
        setForm({
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          status: editorStatus(post.status),
          published_at: toDatetimeLocal(post.published_at),
          visibility_password: '',
          category_ids: post.category_ids || [],
          featured_image_key: post.featured_image_key,
          featured_image_url: resolveMediaUrl(post.featured_image_url || post.featured_image_key),
          meta_title: post.meta_title || '',
          meta_description: post.meta_description || '',
          focus_keyword: post.focus_keyword || '',
          seo_noindex: Boolean(post.seo_noindex),
        })
        setHasPassword(Boolean(post.has_visibility_password))
        setEditorData(editorDataFromPost(post))
      })
      .finally(() => setLoading(false))
  }, [id, isEdit])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!editorApi.current) return
    setSaving(true)
    try {
      const data = await editorApi.current.save()
      const body = {
        slug: form.slug,
        title: form.title,
        excerpt: form.excerpt,
        status: form.status,
        category_ids: form.category_ids,
        content_html: blocksToHtml(data),
        content_json: JSON.stringify(data),
        featured_image_key: form.featured_image_key,
        published_at: fromDatetimeLocal(form.published_at),
        meta_title: form.meta_title.trim() || null,
        meta_description: form.meta_description.trim() || null,
        focus_keyword: form.focus_keyword.trim() || null,
        seo_noindex: form.seo_noindex,
      }
      if (form.status === 'private' && form.visibility_password) {
        body.visibility_password = form.visibility_password
      }
      if (isEdit) {
        await api(`/api/editor/posts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      } else {
        if (form.status === 'private') body.visibility_password = form.visibility_password
        await api('/api/editor/posts', { method: 'POST', body: JSON.stringify(body) })
      }
      navigate(base)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="muted">Loading post…</p>

  const publicUrl = postPublicUrl(form.slug)
  const canViewPublic = (form.status === 'published' || form.status === 'private') && form.slug
  const seoTitleLen = form.meta_title.length
  const seoDescLen = form.meta_description.length

  return (
    <div className="page-stack post-editor-layout">
      <header className="page-header post-editor-header">
        <div className="post-editor-header-text">
          <p className="eyebrow">{isEdit ? 'Edit post' : 'New post'}</p>
          <h1 className="page-title">{isEdit ? 'Edit post' : 'Create post'}</h1>
        </div>
        <div className="hero-actions">
          <Button variant="ghost" as={Link} to={base}>Cancel</Button>
          <Button variant="primary" type="submit" form="post-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <form id="post-form" onSubmit={handleSubmit} className="post-editor-column">
          <Card className="publish-card">
            <div className="publish-card-head">
              <p className="eyebrow">Publish</p>
              {canViewPublic && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="view-post-btn"
                  title="View on site"
                  aria-label="View on site"
                >
                  <IconExternalLink size={18} />
                </a>
              )}
            </div>
            <div className="form-grid-2">
              <div>
                <label>Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="private">Private (password)</option>
                </select>
              </div>
              <div>
                <label>Publish date</label>
                <input
                  type="datetime-local"
                  value={form.published_at}
                  onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
                />
              </div>
              {form.status === 'private' && (
                <div className="form-span-2">
                  <label>Password</label>
                  <input
                    type="password"
                    value={form.visibility_password}
                    onChange={e => setForm(f => ({ ...f, visibility_password: e.target.value }))}
                    placeholder={hasPassword ? 'Leave blank to keep current' : 'Required'}
                    autoComplete="new-password"
                  />
                </div>
              )}
            </div>
            {form.status === 'draft' && (
              <p className="publish-hint muted">Not visible on the public site.</p>
            )}
            {form.status === 'private' && (
              <p className="publish-hint muted">Password required to view.</p>
            )}
          </Card>

          <Card>
            <label>Title</label>
            <input
              className="input-title"
              value={form.title}
              onChange={e => {
                const title = e.target.value
                setForm(f => ({
                  ...f,
                  title,
                  slug: isEdit ? f.slug : slugify(title),
                }))
              }}
              required
            />
            <label>Slug</label>
            <input
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
              required
              disabled={isEdit}
            />
            <label>Excerpt</label>
            <textarea rows={3} value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} />
          </Card>

          <Card>
            <FeaturedImageField
              imageUrl={form.featured_image_url}
              imageKey={form.featured_image_key}
              onChange={({ key, url }) => setForm(f => ({
                ...f,
                featured_image_key: key,
                featured_image_url: url,
              }))}
            />
          </Card>

          <Card className="seo-card">
            <p className="eyebrow">SEO</p>
            <label>
              SEO title
              <span className={`char-count${seoTitleLen > 60 ? ' char-count-warn' : ''}`}>{seoTitleLen}/60</span>
            </label>
            <input
              value={form.meta_title}
              onChange={e => setForm(f => ({ ...f, meta_title: e.target.value }))}
              placeholder={form.title || 'Defaults to post title'}
              maxLength={255}
            />
            <label>
              Meta description
              <span className={`char-count${seoDescLen > 160 ? ' char-count-warn' : ''}`}>{seoDescLen}/160</span>
            </label>
            <textarea
              rows={3}
              value={form.meta_description}
              onChange={e => setForm(f => ({ ...f, meta_description: e.target.value }))}
              placeholder={form.excerpt || 'Defaults to excerpt'}
              maxLength={512}
            />
            <label>Focus keyword</label>
            <input
              value={form.focus_keyword}
              onChange={e => setForm(f => ({ ...f, focus_keyword: e.target.value }))}
              placeholder="e.g. mindfulness recovery"
              maxLength={100}
            />
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.seo_noindex}
                onChange={e => setForm(f => ({ ...f, seo_noindex: e.target.checked }))}
              />
              Hide from search engines (noindex)
            </label>
            <div className="seo-preview">
              <p className="seo-preview-title">{form.meta_title || form.title || 'Post title'}</p>
              <p className="seo-preview-url">{publicUrl || 'yoursite.com/blog/…'}</p>
              <p className="seo-preview-desc">{form.meta_description || form.excerpt || 'Meta description preview…'}</p>
            </div>
          </Card>

          <Card>
            <label>Categories</label>
            <select
              multiple
              className="categories-select"
              value={form.category_ids.map(String)}
              onChange={e => {
                const ids = Array.from(e.target.selectedOptions).map(o => Number(o.value))
                setForm(f => ({ ...f, category_ids: ids }))
              }}
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="muted">Hold Cmd/Ctrl to select multiple.</p>
          </Card>

          <Card>
            <label>Content</label>
            {editorData && (
              <EditorJsField
                key={isEdit ? `edit-${id}` : 'new'}
                holderId="post-editorjs"
                initialData={editorData}
                onReady={ed => { editorApi.current = ed }}
              />
            )}
          </Card>
      </form>
    </div>
  )
}
