export default function Badge({ tone = 'neutral', dot, children }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" aria-hidden />}
      {children}
    </span>
  )
}
