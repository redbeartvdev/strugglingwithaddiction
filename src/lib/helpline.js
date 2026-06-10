const raw = (import.meta.env.VITE_HELPLINE_NUMBER || '18005551234').replace(/\D/g, '')

export const HELPLINE_TEL = raw ? `tel:${raw}` : 'tel:18005551234'

export function formatHelplineDisplay(number = raw) {
  const digits = String(number).replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits || '1-800-555-1234'
}

export const HELPLINE_DISPLAY = formatHelplineDisplay()
