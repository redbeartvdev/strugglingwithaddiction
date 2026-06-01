export default function Eyebrow({ children, className = '' }) {
  return <div className={`eyebrow ${className}`.trim()}>{children}</div>
}
