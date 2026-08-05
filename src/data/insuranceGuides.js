/** Static insurance / benefits explainers for the coverage hub. */

export const INSURANCE_GUIDES = [
  {
    slug: 'aca-parity',
    title: 'ACA & mental health parity for rehab',
    metaTitle: 'ACA & Mental Health Parity: What It Means for Rehab Coverage',
    metaDescription:
      'How the Affordable Care Act and mental health parity rules affect addiction treatment coverage — and what to ask your plan.',
    summary:
      'Federal parity and ACA rules require many plans to cover substance use treatment similarly to medical care. Here is what that means in practice.',
    sections: [
      {
        heading: 'What parity requires',
        body: `Mental health parity laws require most group health plans and many individual plans to apply financial requirements and treatment limits to substance use benefits that are no more restrictive than those for medical/surgical benefits. Copays, visit limits, and prior-auth processes should not be stricter in practice for behavioral health.`,
      },
      {
        heading: 'What the ACA changed',
        body: `Marketplace and many employer plans must cover essential health benefits, including behavioral health and substance use disorder services. That does not mean every facility is in-network or that residential care is automatically approved — medical necessity and network rules still apply.`,
      },
      {
        heading: 'What to ask your plan',
        body: `Ask for the substance use benefit summary, residential day limits, prior-authorization criteria for detox and residential, and how parity complaints are handled. If a denial feels uneven compared with medical benefits, request a written explanation citing parity.`,
      },
    ],
  },
  {
    slug: 'reading-an-eob',
    title: 'How to read an Explanation of Benefits (EOB)',
    metaTitle: 'How to Read an EOB for Rehab & Detox Claims',
    metaDescription:
      'A plain-language guide to Explanation of Benefits statements after detox, residential, or outpatient addiction treatment.',
    summary:
      'An EOB is not a bill. It shows what the facility billed, what the plan allowed, what you owe, and why a claim was adjusted or denied.',
    sections: [
      {
        heading: 'Key fields',
        body: `Look for the provider name, dates of service, billed amount, allowed amount, plan payment, patient responsibility, and claim status codes. Match dates and levels of care to the stay you actually received.`,
      },
      {
        heading: 'Common surprises',
        body: `Out-of-network balances, unmet deductibles, concurrent-review denials mid-stay, and coding mismatches (wrong level of care) are frequent. Contact the facility’s billing team and your insurer with the claim number before paying large balances.`,
      },
      {
        heading: 'Appeals',
        body: `If a day or level of care was denied, ask for the medical-necessity criteria used and file an appeal with clinical notes from the provider. Keep copies of authorizations and EOBs together.`,
      },
    ],
  },
  {
    slug: 'prior-authorization',
    title: 'Prior authorization for detox & residential',
    metaTitle: 'Prior Authorization for Detox and Residential Rehab',
    metaDescription:
      'What prior authorization means for medical detox and residential treatment, and how to prepare before you call admissions.',
    summary:
      'Most commercial plans require prior authorization before detox or residential admission. Without it, you may face a denial even if the stay was clinically appropriate.',
    sections: [
      {
        heading: 'Who requests authorization',
        body: `Usually the facility’s utilization review team submits clinical information to the insurer or a behavioral health vendor (Optum, Magellan, etc.). You still need your member ID ready and should confirm the authorization number before travel.`,
      },
      {
        heading: 'What plans review',
        body: `Plans evaluate withdrawal risk, failed outpatient attempts, co-occurring conditions, and whether a lower level of care is safe. Authorization is often granted for a short initial period and then concurrent-reviewed.`,
      },
      {
        heading: 'If authorization is delayed',
        body: `Ask whether emergency admission criteria apply, request peer-to-peer review, and document every call. Do not assume verbal approval — get a reference number in writing when possible.`,
      },
    ],
  },
  {
    slug: 'single-case-agreements',
    title: 'Single case agreements (SCAs)',
    metaTitle: 'Single Case Agreements for Out-of-Network Rehab',
    metaDescription:
      'When and how single case agreements can help you access an out-of-network rehab program at in-network rates.',
    summary:
      'A single case agreement is a one-time contract between your insurer and an out-of-network facility when no adequate in-network option exists.',
    sections: [
      {
        heading: 'When SCAs are used',
        body: `Plans may approve an SCA if the needed specialty (dual diagnosis, specific populations, language, geography) is unavailable in-network within a reasonable distance or wait time.`,
      },
      {
        heading: 'How to request one',
        body: `Have the facility’s contracting or admissions team initiate the request with clinical justification. You can also call your plan’s behavioral health line and ask for the SCA / gap exception process.`,
      },
      {
        heading: 'What to confirm in writing',
        body: `Authorized level of care, dates or day limits, reimbursement rate, patient responsibility, and whether concurrent review still applies. Without written terms, you may still receive balance bills.`,
      },
    ],
  },
  {
    slug: 'calling-your-payer',
    title: 'Script for calling your insurance',
    metaTitle: 'Script for Calling Your Insurance About Rehab Coverage',
    metaDescription:
      'A practical call script and checklist for verifying detox and residential benefits with your health plan.',
    summary:
      'Use this script when you call the behavioral health number on your insurance card. Take notes and ask for a reference number.',
    sections: [
      {
        heading: 'Before you call',
        body: `Have your member ID, date of birth, the level of care you need (detox, residential, PHP, IOP), preferred facility name if any, and your location. Call the behavioral health / mental health number — not only the medical customer service line.`,
      },
      {
        heading: 'What to say',
        body: `"I'm calling to verify substance use disorder benefits for [level of care]. Can you confirm whether this service is covered, my deductible and out-of-pocket remaining, in-network requirements, and whether prior authorization is required? Please give me a reference number for this call."`,
      },
      {
        heading: 'Follow-up questions',
        body: `Ask about day or visit limits, concurrent review, out-of-network benefits, single case agreements, and whether a third-party vendor manages authorizations. Write down names, times, and reference numbers.`,
      },
    ],
  },
]

export function getInsuranceGuide(slug) {
  return INSURANCE_GUIDES.find(g => g.slug === slug) || null
}
