import { FaFacebookF, FaTwitter, FaYoutube } from 'react-icons/fa'

/** Matches official profiles linked from strugglingwithaddiction.com */
const ITEMS = [
  {
    href: 'https://www.facebook.com/strugglingwithaddictionblog/',
    label: 'Struggling With Addiction on Facebook',
    Icon: FaFacebookF,
  },
  {
    href: 'https://twitter.com/addiction_with',
    label: 'Struggling With Addiction on X (Twitter)',
    Icon: FaTwitter,
  },
  {
    href: 'https://www.youtube.com/channel/UCUcy2jFODQvkvketJ5bZJbA',
    label: 'Struggling With Addiction on YouTube',
    Icon: FaYoutube,
  },
]

export default function SocialLinks({ className = '', iconSize = 18 }) {
  return (
    <ul className={className} aria-label="Social media">
      {ITEMS.map(({ href, label, Icon }) => (
        <li key={href}>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
            <Icon size={iconSize} aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  )
}
