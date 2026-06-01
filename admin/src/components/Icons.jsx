const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' }

function Icon({ children, size = 18, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className={className} aria-hidden>
      {children}
    </svg>
  )
}

export function IconHome(props) {
  return <Icon {...props}><path {...stroke} d="M3 10.5L10 3.5l7 7M5 9v7h10V9" /></Icon>
}
export function IconUsers(props) {
  return <Icon {...props}><path {...stroke} d="M13 17v-1.5a3 3 0 00-6 0V17M10 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM4 17v-1a3 3 0 013-3h.5M16 17v-1a3 3 0 00-3-3h-.5" /></Icon>
}
export function IconFile(props) {
  return <Icon {...props}><path {...stroke} d="M6 3h5l4 4v10H6V3zM11 3v4h4" /></Icon>
}
export function IconBuilding(props) {
  return <Icon {...props}><path {...stroke} d="M4 17V7l6-3 6 3v10M8 17v-4h4v4" /></Icon>
}
export function IconInbox(props) {
  return <Icon {...props}><path {...stroke} d="M3 6h14v8H3V6zm0 0l3 3h8l3-3" /></Icon>
}
export function IconCard(props) {
  return <Icon {...props}><path {...stroke} d="M3 7h14v10H3V7zm0 3h14" /></Icon>
}
export function IconScrape(props) {
  return <Icon {...props}><path {...stroke} d="M4 4h12v12H4V4zm3 3h6M7 10h6M7 13h4" /></Icon>
}
export function IconSettings(props) {
  return <Icon {...props}><circle {...stroke} cx="10" cy="10" r="2.5" /><path {...stroke} d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" /></Icon>
}
export function IconSearch(props) {
  return <Icon {...props}><circle {...stroke} cx="9" cy="9" r="4.5" /><path {...stroke} d="M13 13l3.5 3.5" /></Icon>
}
export function IconChevron(props) {
  return <Icon {...props}><path {...stroke} d="M8 5l4 5-4 5" /></Icon>
}
export function IconPlus(props) {
  return <Icon {...props}><path {...stroke} d="M10 5v10M5 10h10" /></Icon>
}
export function IconExternalLink(props) {
  return (
    <Icon {...props}>
      <path {...stroke} d="M11 3h6v6M9 11l8-8M17 11v6H5V5h6" />
    </Icon>
  )
}
