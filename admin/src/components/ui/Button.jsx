export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  type = 'button',
  onClick,
  disabled,
  className = '',
  as: Tag = 'button',
  to,
  ...rest
}) {
  const sizeClass = size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : ''
  const cls = `btn btn-${variant} ${sizeClass} ${className}`.trim()
  if (Tag === 'button') {
    return (
      <button type={type} className={cls} onClick={onClick} disabled={disabled} {...rest}>
        {children}
      </button>
    )
  }
  return (
    <Tag className={cls} to={to} onClick={onClick} {...rest}>
      {children}
    </Tag>
  )
}
