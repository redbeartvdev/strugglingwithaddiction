export default function Card({ children, dark, pad, className = '', onClick }) {
  const padClass = pad === 0 ? 'card-pad-0' : pad === 'sm' ? 'card-pad-sm' : ''
  return (
    <div className={`card ${dark ? 'card-dark' : ''} ${padClass} ${className}`.trim()} onClick={onClick} role={onClick ? 'button' : undefined}>
      {children}
    </div>
  )
}
