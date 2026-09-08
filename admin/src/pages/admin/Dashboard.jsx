import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import Eyebrow from '../../components/ui/Eyebrow'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import { IconChevron, IconPlus } from '../../components/Icons'
import './Dashboard.css'

const SOURCE_LABELS = {
  registration: 'Registration',
  claim: 'Claim',
  new_center: 'New center',
  abandonment_claim: 'Abandon claim',
  abandonment_submit: 'Abandon submit',
  manual: 'Manual',
}

const QUICK_LINKS = [
  { to: '/admin/analytics', label: 'Analytics', detail: 'Visits and abandonment' },
  { to: '/admin/leads', label: 'Abandonment leads', detail: 'Claim and submit journeys' },
  { to: '/admin/email-list', label: 'Email list', detail: 'Contacts and CSV export' },
  { to: '/admin/emails', label: 'Emails', detail: 'Templates and delivery log' },
  { to: '/admin/settings?tab=mailchimp', label: 'Mailchimp', detail: 'Audience sync' },
  { to: '/admin/billing', label: 'Finance', detail: 'MRR and subscribers' },
  { to: '/admin/lifecycle', label: 'Lifecycle', detail: 'Reminders and routing' },
  { to: '/admin/settings?tab=site', label: 'Inquiry forms', detail: 'Site-wide listing forms' },
]

function greetingWord() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDay(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString()
}

function StatCard({ label, value, sub, to }) {
  const inner = (
    <>
      <Eyebrow>{label}</Eyebrow>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </>
  )
  if (!to) {
    return <Card pad="sm">{inner}</Card>
  }
  return (
    <Link to={to} className="ov-stat-link">
      <Card pad="sm">{inner}</Card>
    </Link>
  )
}

function emptyOverview() {
  return {
    users: { total: 0, client: 0 },
    centers: { total: 0, claimed: 0, unclaimed: 0, missing_inquiry_email: 0, inquiry_form_disabled: 0, missing_inquiry_centers: [] },
    queue: { pending_submissions: 0, pending_claims: 0 },
    leads: { abandonment_total: 0, unread: 0, today: 0 },
    traffic: { site_visits: 0, unique_sessions: 0, profile_visits: 0 },
    email_list: { total: 0, subscribed: 0, mailchimp_synced: 0, mailchimp_unsynced: 0, by_source: {}, emails_sent_today: 0 },
    mailchimp: { enabled: false, configured: false, abandonment_emails_enabled: true, abandonment_uses_mailchimp: false },
    inquiries: { forms_globally_enabled: true },
    finance: { mrr_label: 'USD 0.00', active_subscribers: 0, monthly_subscribers: 0, yearly_subscribers: 0, past_due_count: 0, unpaid_count: 0, stripe_configured: false, upsells_awaiting_fulfillment: 0 },
    attention: [],
    recent_centers: [],
    recent_activity: [],
  }
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    api('/api/admin/overview')
      .then(setData)
      .catch(e => setErr(e.message || 'Could not load overview'))
  }, [])

  const name = user?.display_name?.split(' ')[0] || 'there'
  const loading = !data && !err
  const overview = data || emptyOverview()
  const {
    users, centers, queue, leads, traffic, email_list: emailList,
    mailchimp, inquiries, finance, attention, recent_centers: centersPreview,
    recent_activity: activity,
  } = overview

  const heroBits = []
  if (centers.total) heroBits.push(`${centers.total} rehab center${centers.total === 1 ? '' : 's'} listed`)
  if (queue.pending_submissions) {
    heroBits.push(`${queue.pending_submissions} submission${queue.pending_submissions === 1 ? '' : 's'} awaiting review`)
  } else if (queue.pending_claims) {
    heroBits.push(`${queue.pending_claims} claim${queue.pending_claims === 1 ? '' : 's'} awaiting review`)
  }
  if (centers.missing_inquiry_email) {
    heroBits.push(`${centers.missing_inquiry_email} claimed listing${centers.missing_inquiry_email === 1 ? '' : 's'} still need an inquiry inbox`)
  }
  if (leads.unread) {
    heroBits.push(`${leads.unread} unread abandonment lead${leads.unread === 1 ? '' : 's'}`)
  }
  const heroLead = heroBits.length
    ? `${heroBits[0]}.${heroBits.slice(1).length ? ` ${heroBits.slice(1).join('. ')}.` : ''}`
    : 'No pending submissions, claims, or setup items.'

  const sourceRows = Object.entries(SOURCE_LABELS).map(([key, label]) => ({
    key,
    label,
    count: emailList.by_source?.[key] || 0,
  }))

  return (
    <div className="page-stack ov-page">
      <section className="page-header-block">
        <Eyebrow>Welcome back</Eyebrow>
        <h1 className="hero-title">{greetingWord()}, {name}.</h1>
        <p className="hero-lead">{loading ? 'Loading platform snapshot…' : heroLead}</p>
        <div className="hero-actions">
          <Button variant="primary" size="lg" as={Link} to="/admin/submissions">Submission Center</Button>
          <Button variant="ghost" size="lg" as={Link} to="/admin/claims">Review claims</Button>
          {centers.missing_inquiry_email > 0 && (
            <Button variant="ghost" size="lg" as={Link} to="/admin/rehab">Inquiry setup</Button>
          )}
        </div>
      </section>

      {err && <p className="error">{err}</p>}

      {data && (
        <>
      {attention.length > 0 && (
        <Card pad={0}>
          <div className="panel-head">
            <h3 className="section-title">Needs attention</h3>
          </div>
          {attention.map(item => (
            <Link key={item.key} to={item.to} className="ov-attention-row">
              <span>{item.label}</span>
              <span className="ov-attention-meta">
                <Badge tone="warn" dot>{item.count}</Badge>
                <IconChevron size={16} />
              </span>
            </Link>
          ))}
        </Card>
      )}

      <section>
        <p className="ov-section-label">Directory</p>
        <div className="stat-row">
          <StatCard label="Users" value={String(users.total)} sub={`${users.client || 0} providers`} to="/admin/users" />
          <StatCard label="Centers" value={String(centers.total)} sub={`${centers.claimed} claimed · ${centers.unclaimed} open`} to="/admin/rehab" />
          <StatCard label="Submissions" value={String(queue.pending_submissions)} sub="pending" to="/admin/submissions" />
          <StatCard label="Claims" value={String(queue.pending_claims)} sub="pending" to="/admin/claims" />
        </div>
      </section>

      <section>
        <p className="ov-section-label">Today</p>
        <div className="stat-row">
          <StatCard label="Site visits" value={String(traffic.site_visits)} sub={`${traffic.unique_sessions} unique sessions`} to="/admin/analytics" />
          <StatCard label="Profile visits" value={String(traffic.profile_visits)} sub="listing pages" to="/admin/analytics" />
          <StatCard
            label="Abandonment"
            value={String(leads.unread)}
            sub={`${leads.today} today · ${leads.abandonment_total} total`}
            to="/admin/leads"
          />
          <StatCard
            label="Email list"
            value={String(emailList.total)}
            sub={`${emailList.subscribed} subscribed`}
            to="/admin/email-list"
          />
        </div>
      </section>

      <section>
        <p className="ov-section-label">Membership & inquiries</p>
        <div className="stat-row">
          <StatCard
            label="MRR"
            value={finance.mrr_label.replace('USD ', '$')}
            sub={`${finance.active_subscribers} active subs`}
            to="/admin/billing"
          />
          <StatCard
            label="Past due"
            value={String(finance.past_due_count)}
            sub={`${finance.unpaid_count} unpaid / inactive`}
            to="/admin/billing"
          />
          <StatCard
            label="Inquiry inbox"
            value={String(centers.missing_inquiry_email)}
            sub="claimed listings still missing an email"
            to="/admin/rehab"
          />
          <StatCard
            label="Inquiry forms"
            value={inquiries.forms_globally_enabled ? 'On' : 'Off'}
            sub={
              inquiries.forms_globally_enabled
                ? `${centers.inquiry_form_disabled} listing${centers.inquiry_form_disabled === 1 ? '' : 's'} hidden`
                : 'hidden on every listing'
            }
            to="/admin/settings?tab=site"
          />
        </div>
      </section>

      <section className="panel-grid ov-panel-grid">
        <Card pad={0}>
          <div className="panel-head">
            <h3 className="section-title">Email list by source</h3>
            <Button variant="link" size="sm" as={Link} to="/admin/email-list">Open list</Button>
          </div>
          {emailList.total === 0 ? (
            <p className="muted" style={{ padding: 20 }}>No contacts yet. Import existing records from Email list.</p>
          ) : (
            sourceRows.map(row => (
              <Link key={row.key} to={`/admin/email-list`} className="ov-rank-row">
                <span>{row.label}</span>
                <strong>{row.count}</strong>
              </Link>
            ))
          )}
          <div className="ov-panel-foot">
            {emailList.emails_sent_today} platform email{emailList.emails_sent_today === 1 ? '' : 's'} sent today
            {mailchimp.configured
              ? ` · ${emailList.mailchimp_synced} synced to Mailchimp`
              : ' · Mailchimp not connected'}
          </div>
        </Card>

        <Card pad={0}>
          <div className="panel-head">
            <h3 className="section-title">Mailchimp & routing</h3>
            <Button variant="link" size="sm" as={Link} to="/admin/settings?tab=mailchimp">Settings</Button>
          </div>
          <div className="ov-status-body">
            <div className="ov-status-line">
              <span>Audience sync</span>
              <Badge tone={mailchimp.configured ? 'ok' : mailchimp.enabled ? 'warn' : 'neutral'} dot>
                {mailchimp.configured ? 'Ready' : mailchimp.enabled ? 'Incomplete' : 'Off'}
              </Badge>
            </div>
            <div className="ov-status-line">
              <span>Abandonment reminders</span>
              <Badge tone={mailchimp.abandonment_uses_mailchimp ? 'info' : 'ok'} dot>
                {mailchimp.abandonment_uses_mailchimp ? 'Mailchimp' : 'Built-in email'}
              </Badge>
            </div>
            <div className="ov-status-line">
              <span>Listing inquiries</span>
              <Badge tone={inquiries.forms_globally_enabled ? 'ok' : 'warn'} dot>
                {inquiries.forms_globally_enabled ? 'Emailed to center' : 'Forms off'}
              </Badge>
            </div>
            <p className="muted ov-status-note">
              Visitor inquiries are emailed to each center's inquiry inbox and are not stored.
              Abandoned claim and submit journeys stay in Leads.
            </p>
          </div>
        </Card>
      </section>

      <section className="panel-grid">
        <Card pad={0}>
          <div className="panel-head">
            <h3 className="section-title">Rehab centers</h3>
            <Button variant="link" size="sm" as={Link} to="/admin/rehab">
              <IconPlus size={14} /> Add
            </Button>
          </div>
          {centersPreview.length === 0 ? (
            <p className="muted" style={{ padding: 20 }}>No centers yet.</p>
          ) : (
            centersPreview.map(center => (
              <Link key={center.id} to="/admin/rehab" className="list-row">
                <div className="list-thumb" />
                <div>
                  <div className="list-name">{center.name}</div>
                  <div className="list-sub">{center.location_display}</div>
                </div>
                <Badge
                  tone={center.needs_inquiry_setup ? 'warn' : center.claimed ? 'ok' : 'neutral'}
                  dot
                >
                  {center.needs_inquiry_setup ? 'Needs inbox' : center.claimed ? 'Claimed' : 'Open'}
                </Badge>
                <IconChevron size={16} />
              </Link>
            ))
          )}
          {centers.missing_inquiry_centers?.length > 0 && (
            <div className="ov-panel-foot">
              Setup still needed: {centers.missing_inquiry_centers.map(c => c.name).join(', ')}
            </div>
          )}
        </Card>

        <Card pad={0}>
          <div className="panel-head">
            <h3 className="section-title">Recent activity</h3>
          </div>
          <div style={{ padding: '4px 20px 16px' }}>
            {activity.length === 0 ? (
              <p className="muted">No recent submissions, claims, or abandonment leads.</p>
            ) : (
              activity.map((item, i) => (
                <Link key={`${item.kind}-${item.time}-${i}`} to={item.href || '/admin'} className="activity-item ov-activity-link">
                  <span className={`activity-dot ${item.tone}`} />
                  <div>
                    <div className="activity-msg">{item.msg}</div>
                    <div className="activity-time">{formatDay(item.time)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="ov-quick-grid">
        {QUICK_LINKS.map(link => (
          <Link key={link.to} to={link.to} className="ov-quick-link">
            <strong>{link.label}</strong>
            <span>{link.detail}</span>
          </Link>
        ))}
      </section>

      <Card className="feature-banner" pad={0}>
        <div className="feature-banner-inner">
          <div>
            <Eyebrow>Finance</Eyebrow>
            <h2 className="feature-banner-title">
              {finance.stripe_configured ? `${finance.active_subscribers} active memberships` : 'Connect Stripe to take payments'}
            </h2>
            <p className="feature-banner-lead">
              {finance.mrr_label.replace('USD ', '$')} MRR
              {' · '}
              {finance.monthly_subscribers} monthly / {finance.yearly_subscribers} yearly
              {finance.upsells_awaiting_fulfillment
                ? ` · ${finance.upsells_awaiting_fulfillment} paid upgrades waiting`
                : ''}
              . Listing inquiries go to each center; abandonment journeys stay in Leads and the email list.
            </p>
          </div>
          <Button variant="primary" as={Link} to="/admin/billing">Billing</Button>
        </div>
      </Card>
        </>
      )}
    </div>
  )
}
