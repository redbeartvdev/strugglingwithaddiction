/** Video series imported from the legacy /videos/ page. */
export const VIDEOS_CHANNEL_URL = 'https://www.youtube.com/channel/UCUcy2jFODQvkvketJ5bZJbA'

export const VIDEOS = [
  {
    id: 'N2cmhfMYm4k',
    title: 'Why People Deny Being Addicted to Weed?',
    description: 'A new investigative series featuring Skylar Haarsma.',
  },
  {
    id: 'Ge_EUTSbHeo',
    title: "What's a Typical Day Like in Rehab?",
    description:
      "Get an insider's view into the day-to-day life when you enter a drug and alcohol rehabilitation treatment facility.",
  },
  {
    id: 'x4oxX4AQKyE',
    title: 'How Do You Convince an Addict To Get Help?',
    description:
      'You may have a loved one that you know needs help with their addiction. This video will give you tips to help them get treatment for their disease.',
  },
  {
    id: 'VKm0D_AgvdA',
    title: 'Cognitive Behavioral Therapy',
    description:
      'What is cognitive behavioral therapy and how can it help someone suffering from drug addiction?',
  },
  {
    id: 'K4hYqtYH718',
    title: 'Warning Signs of Substance Abuse',
    description:
      "The allure of drugs can be difficult to resist. Watch this video to see how drugs may be affecting your life in ways you don't realize.",
  },
  {
    id: 'ZEoC7ACHMBI',
    title: 'How Drugs Affect Your Quality of Life',
    description:
      "The allure of drugs can be difficult to resist. Watch this video to see how drugs may be affecting your life in ways you don't realize.",
  },
  {
    id: 'jmp1N__EYlk',
    title: 'Knowing the Risk Factors of Drug Addiction',
    description:
      "The allure of drugs can be difficult to resist. Watch this video to see how drugs may be affecting your life in ways you don't realize.",
  },
  {
    id: '78svBVmCiv8',
    title: 'How Does Suboxone Help Addiction Recovery?',
    description:
      'Everyone is talking about medication-assisted treatment. Learn how this can help you break your addiction.',
  },
]

export function youtubeEmbedUrl(id, { autoplay = false } = {}) {
  const params = new URLSearchParams({ rel: '0' })
  if (autoplay) params.set('autoplay', '1')
  return `https://www.youtube.com/embed/${id}?${params.toString()}`
}

export function youtubeWatchUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`
}

export function youtubeThumbnailUrl(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}
