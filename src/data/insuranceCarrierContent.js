export const INSURANCE_CONTENT_UPDATED = 'August 6, 2026'

export const INSURANCE_CONTENT_AUTHOR = {
  name: 'Drew Lewis',
  slug: 'drew-lewis',
}

const carrier = ({
  name,
  slug,
  summary,
  planNote,
  networkNote,
  authorizationNote,
  sourceUrl,
  sourceLabel,
  faqs = [],
  directoryName = name,
  catalogSlug = slug,
}) => ({
  name,
  slug,
  catalogSlug,
  directoryName,
  logoUrl: `/images/insurance/${catalogSlug}.png`,
  title: `Does ${name} Cover Drug and Alcohol Rehab?`,
  metaDescription: `${name} may cover drug and alcohol rehab. Learn what treatment may be covered, what you may pay, and how to ask about your specific plan.`,
  summary,
  planNote,
  networkNote,
  authorizationNote,
  sourceUrl,
  sourceLabel,
  faqs,
})

const BASE_CARRIERS = [
  carrier({
    name: 'Aetna',
    slug: 'aetna',
    summary: 'Yes. Many Aetna plans cover drug and alcohol treatment when it is medically necessary. This may include detox, residential care, and outpatient treatment. The exact services and costs depend on your plan, location, treatment needs, and whether the center is in your plan’s network. Approval may be required before treatment begins. Call the number on your card and ask about substance use disorder treatment before choosing a center. The treatment center can also speak with Aetna about the care its clinical team believes you need.',
    planNote: 'Aetna sells employer, individual, Medicare, and Medicaid plans. Those plans can use different provider networks and rules. The name printed on your card and the state where the plan was issued both matter.',
    networkNote: 'A center that works with one Aetna network may not participate in every Aetna network. Ask about the exact network shown on your card.',
    authorizationNote: 'Aetna may ask the center for clinical information before approving detox, residential care, PHP, or IOP. The rule can differ by plan.',
    sourceUrl: 'https://www.aetna.com/health-guide/mental-health.html',
    sourceLabel: 'Aetna mental health resources',
    faqs: [
      ['Does Aetna cover inpatient rehab?', 'Many Aetna plans cover inpatient or residential treatment when it is medically necessary and approved under the plan. Your network and plan rules still apply.'],
      ['Does Aetna cover detox?', 'Many plans cover medically supervised detox when the symptoms and risks support that level of care. Approval is often required.'],
    ],
  }),
  carrier({
    name: 'Blue Cross Blue Shield',
    slug: 'blue-cross-blue-shield',
    summary: 'Yes. Many Blue Cross Blue Shield plans cover drug and alcohol treatment when it is medically necessary. Coverage may include detox, residential care, and outpatient services. Blue Cross Blue Shield is made up of independent companies, so rules differ by state, employer, and plan. Your costs also depend on the center’s network status and your deductible. Call the number on your card to identify your local Blue company and ask about substance use disorder treatment. The center can then ask that company to approve the level of care you need.',
    planNote: 'Blue Cross Blue Shield is a group of independent local companies, not one national insurance company. The company name, three-letter prefix, and network on your card help identify the rules that apply.',
    networkNote: 'A center may participate with one local Blue company but not another. If you plan to travel, ask whether BlueCard or another away-from-home program applies.',
    authorizationNote: 'Your local Blue company may require approval for detox, residential treatment, PHP, or IOP. The treatment center usually contacts that company for you.',
    sourceUrl: 'https://www.bcbs.com/member-services',
    sourceLabel: 'Blue Cross Blue Shield member services',
    faqs: [
      ['Does BCBS cover residential rehab?', 'Many local Blue plans cover residential treatment when it is medically necessary. Approval, network rules, and your share of the cost depend on your plan.'],
      ['Can I use BCBS for treatment in another state?', 'Some plans include away-from-home access, while others use a limited local network. Ask the company listed on your card before traveling.'],
    ],
  }),
  carrier({
    name: 'Cigna',
    slug: 'cigna',
    summary: 'Yes. Many Cigna plans cover drug and alcohol treatment when it is medically necessary. Covered care may include detox, residential treatment, and several types of outpatient treatment. Your exact coverage depends on your plan, the center’s network status, and whether Cigna approves the requested care. Cigna may provide behavioral health services through Evernorth. Call the number on your card and ask about substance use disorder treatment. The treatment center can also contact Cigna or Evernorth about the level of care its clinical team recommends.',
    planNote: 'Some Cigna behavioral health services use the Evernorth name. Follow the behavioral health instructions on your card even if another company name appears in plan materials.',
    networkNote: 'Cigna plans can be PPO, HMO, EPO, or another design. A PPO may include limited out-of-network help, while an HMO or EPO may provide little or none except in an emergency.',
    authorizationNote: 'Cigna or Evernorth may review clinical information before higher levels of care begin. Continued residential treatment may be reviewed again during the stay.',
    sourceUrl: 'https://www.cigna.com/individuals-families/health-wellness/topic-mental-health',
    sourceLabel: 'Cigna mental health information',
    faqs: [
      ['Does Cigna cover inpatient rehab?', 'Many Cigna plans cover inpatient or residential care when the plan finds it medically necessary. Approval and network requirements may apply.'],
      ['Is Evernorth the same as Cigna?', 'Evernorth is part of The Cigna Group and may manage behavioral health services for some Cigna plans. Use the contact information on your card.'],
    ],
  }),
  carrier({
    name: 'UnitedHealthcare',
    slug: 'unitedhealthcare',
    summary: 'Yes. Many UnitedHealthcare plans cover drug and alcohol treatment when it is medically necessary. This may include detox, residential care, PHP, IOP, and outpatient visits. Behavioral health services are often managed through Optum. Your plan type, network, and approval rules determine what is covered and what you pay. Call the behavioral health number on your card and ask about substance use disorder treatment. A treatment center can also contact UnitedHealthcare or Optum to discuss the care its clinical team believes is appropriate.',
    planNote: 'UnitedHealthcare offers employer, individual, Medicare Advantage, and Community Plan products. Each product can have a different network. Optum may manage behavioral health care for the plan.',
    networkNote: 'Ask whether the center participates in the exact UnitedHealthcare or Optum network named on your card. Community Plan and Medicare networks may differ from employer-plan networks.',
    authorizationNote: 'UnitedHealthcare or Optum often reviews detox and residential requests before admission. It may also review continued treatment after an initial period.',
    sourceUrl: 'https://www.uhc.com/health-and-wellness/mental-health',
    sourceLabel: 'UnitedHealthcare mental health resources',
    faqs: [
      ['Does UnitedHealthcare cover residential rehab?', 'Many plans cover residential care when it is medically necessary and approved. Your plan’s network and cost-sharing rules apply.'],
      ['Why does my card mention Optum?', 'Optum manages behavioral health services for many UnitedHealthcare plans. The number on your card should direct you to the right team.'],
    ],
  }),
  carrier({
    name: 'Humana',
    slug: 'humana',
    summary: 'Yes. Many Humana plans cover drug and alcohol treatment when it is medically necessary. Coverage may include detox, inpatient care, and outpatient treatment. Humana offers several kinds of plans, including Medicare Advantage and employer plans, and each can have different networks and rules. Your costs depend on the plan and the center you choose. Call the number on your card and ask about substance use disorder treatment. The treatment center can contact Humana to ask whether the proposed level of care meets the plan’s requirements.',
    planNote: 'Humana is widely known for Medicare Advantage plans, but it also administers other plan types. Medicare rules and the plan’s own provider network may both affect your options.',
    networkNote: 'A center may accept Humana commercial coverage but not a Humana Medicare Advantage network, or the reverse. State the full plan name when you call.',
    authorizationNote: 'Humana may require advance approval for inpatient, residential, or structured outpatient care. The center generally submits the clinical request.',
    sourceUrl: 'https://www.humana.com/mental-health',
    sourceLabel: 'Humana mental health information',
    faqs: [
      ['Does Humana Medicare cover rehab?', 'Humana Medicare Advantage plans may cover addiction treatment that Medicare covers, subject to the plan’s network, approval rules, and cost sharing.'],
      ['Does Humana cover detox?', 'Coverage may be available when medically supervised detox is necessary. The setting and approval requirements depend on your plan.'],
    ],
  }),
  carrier({
    name: 'Kaiser Permanente',
    slug: 'kaiser-permanente',
    summary: 'Yes. Kaiser Permanente plans generally cover drug and alcohol treatment when it is medically necessary. Care may include withdrawal management, residential treatment, and outpatient programs. Kaiser usually coordinates care through its own doctors, clinics, and contracted centers. You may need an assessment or referral before entering a program. Coverage and costs depend on your regional plan. Call the number on your card and ask for addiction medicine or substance use disorder services. Kaiser can explain where your plan allows you to receive care.',
    planNote: 'Kaiser Permanente is organized by region and often combines insurance with its own health system. The normal first step may be an assessment within Kaiser rather than calling an outside center first.',
    networkNote: 'Kaiser plans often provide coverage through Kaiser facilities and specifically contracted centers. Out-of-network care may be covered only in limited situations or emergencies.',
    authorizationNote: 'Kaiser may require an internal assessment, referral, and approval before residential or other intensive treatment. Regional procedures differ.',
    sourceUrl: 'https://healthy.kaiserpermanente.org/health-wellness/addiction-and-recovery',
    sourceLabel: 'Kaiser Permanente addiction and recovery resources',
    faqs: [
      ['Does Kaiser cover residential rehab?', 'Kaiser may cover residential treatment when its clinical team finds that level necessary and the program is authorized under the regional plan.'],
      ['Can I choose any treatment center with Kaiser?', 'Usually no. Kaiser commonly uses its own services and contracted centers. Ask your regional plan which locations are available to you.'],
    ],
  }),
  carrier({
    name: 'TRICARE',
    slug: 'tricare',
    summary: 'Yes. TRICARE covers many forms of drug and alcohol treatment when the care is medically necessary and program rules are met. This can include detox, inpatient treatment, residential treatment, and outpatient programs. Your choices depend on your TRICARE plan, region, military status, referrals, and authorization. Active-duty service members can have different steps from family members and retirees. Call your regional contractor using the number on your card. Ask about substance use disorder treatment and whether you need a referral before contacting a center.',
    planNote: 'TRICARE Prime, Select, and other programs use different referral and cost rules. Active-duty service members should follow military health system requirements and speak with their command or care team when required.',
    networkNote: 'A center generally must be TRICARE-authorized. A network center usually costs less than an authorized non-network center. Not every center that treats military families can bill TRICARE.',
    authorizationNote: 'TRICARE may require a referral or authorization for higher levels of care. The regional contractor and the treatment center can explain which request is needed.',
    sourceUrl: 'https://www.tricare.mil/CoveredServices/IsItCovered/SubstanceUseDisorderTreatment',
    sourceLabel: 'TRICARE substance use disorder treatment',
    faqs: [
      ['Does TRICARE cover residential treatment?', 'TRICARE may cover a qualified residential treatment program when the care is medically necessary and authorization requirements are met.'],
      ['Do active-duty members need a referral?', 'Referral and authorization rules depend on the plan and setting. Active-duty members should contact their military care team or regional contractor first.'],
    ],
  }),
  carrier({
    name: 'Medicare',
    slug: 'medicare',
    summary: 'Yes. Medicare covers certain drug and alcohol treatment services when they are medically necessary and provided by an eligible program or professional. Coverage can include hospital care, outpatient counseling, and medications used to treat opioid use disorder. Original Medicare and Medicare Advantage plans do not work exactly the same way. Your costs depend on the service, setting, and plan. Call 1-800-MEDICARE or the number on your Medicare Advantage card. Ask which substance use disorder services and treatment locations are covered for you.',
    planNote: 'Original Medicare uses Part A for many inpatient hospital services, Part B for many outpatient services, and Part D for covered prescriptions. Medicare Advantage plans must cover Medicare benefits but can use their own networks and approval rules.',
    networkNote: 'Original Medicare generally requires a participating, Medicare-enrolled provider. Medicare Advantage plans may use a defined network and may charge more or provide no coverage outside it.',
    authorizationNote: 'Original Medicare and Medicare Advantage can apply different review rules. Ask the program and your plan whether approval is needed before admission or a structured outpatient program.',
    sourceUrl: 'https://www.medicare.gov/coverage/mental-health-substance-use-disorder-services',
    sourceLabel: 'Medicare mental health and substance use coverage',
    faqs: [
      ['Does Medicare cover inpatient rehab for addiction?', 'Medicare may cover medically necessary inpatient hospital treatment. Coverage for freestanding residential programs depends on the program and covered services.'],
      ['Does Medicare cover Suboxone or methadone?', 'Medicare covers opioid use disorder treatment through eligible opioid treatment programs and may cover prescribed medications under Part B or Part D rules.'],
    ],
  }),
  carrier({
    name: 'Medicaid',
    slug: 'medicaid',
    summary: 'Yes. Medicaid covers drug and alcohol treatment, but the exact services and treatment centers differ by state. Coverage may include detox, residential care, outpatient programs, and medication for addiction. Many people receive Medicaid through a managed care plan with a private company name on the card. That plan may have its own network and approval rules. Call the number on your card and ask about substance use disorder treatment. If you do not have a managed care card, contact your state Medicaid office for the right phone number.',
    planNote: 'Each state runs its own Medicaid program within federal rules. Eligibility, covered residential services, transportation help, and visit limits can differ. A managed care organization may administer your benefits.',
    networkNote: 'Medicaid networks are usually state-specific and can also differ by county or managed care plan. A center that accepts Medicaid in one state may not accept another state’s program.',
    authorizationNote: 'The state program or managed care plan may require approval for detox, residential treatment, PHP, or IOP. The treatment center usually submits the clinical information.',
    sourceUrl: 'https://www.medicaid.gov/medicaid/benefits/behavioral-health-services/index.html',
    sourceLabel: 'Medicaid behavioral health services',
    faqs: [
      ['Does Medicaid cover residential rehab?', 'Many state Medicaid programs cover some residential treatment, but eligibility, approved settings, and length-of-stay rules differ by state and plan.'],
      ['Can I use Medicaid for treatment in another state?', 'Usually Medicaid coverage is tied to your home state. Out-of-state care is limited and often requires special approval.'],
    ],
  }),
  carrier({
    name: 'Ambetter',
    slug: 'ambetter',
    summary: 'Yes. Many Ambetter plans cover drug and alcohol treatment when it is medically necessary. Ambetter plans are sold through the Health Insurance Marketplace and are offered by local companies in many states. Covered care may include detox, residential treatment, and outpatient services. Networks and approval rules differ by state and plan. Call the number on your card and ask about substance use disorder treatment. A treatment center can also contact your local Ambetter plan to ask about the proposed level of care and its network status.',
    planNote: 'Ambetter is a Marketplace brand offered by local health plans. The company name and state shown on your card identify the network and customer service team that apply to you.',
    networkNote: 'Many Ambetter products use a focused local network. Out-of-network treatment may have little or no coverage except for emergencies, so ask before choosing a center.',
    authorizationNote: 'Your local Ambetter plan may require advance approval for detox, residential treatment, PHP, or IOP. The center usually handles the clinical request.',
    sourceUrl: 'https://www.ambetterhealth.com/health-plans/our-benefits.html',
    sourceLabel: 'Ambetter plan benefits',
    faqs: [
      ['Does Ambetter cover inpatient rehab?', 'Many Ambetter plans cover inpatient or residential treatment when it is medically necessary, approved, and provided under plan rules.'],
      ['Does Ambetter cover out-of-state treatment?', 'Coverage outside your local network may be limited. Ask the Ambetter company named on your card before making travel plans.'],
    ],
  }),
]

const MEDICAID_STATES = [
  ['California', 'Medi-Cal', 'https://www.dhcs.ca.gov/services/MH/Pages/SUD-Drug-Medi-Cal-Organized-Delivery-System.aspx'],
  ['Texas', 'Texas Medicaid', 'https://www.hhs.texas.gov/services/mental-health-substance-use'],
  ['Florida', 'Florida Medicaid', 'https://ahca.myflorida.com/medicaid'],
  ['New York', 'New York Medicaid', 'https://www.health.ny.gov/health_care/medicaid/'],
  ['Pennsylvania', 'Pennsylvania Medical Assistance', 'https://www.pa.gov/agencies/dhs/resources/medicaid'],
  ['Illinois', 'Illinois Medicaid', 'https://hfs.illinois.gov/medicalclients/medicaidguide.html'],
  ['Ohio', 'Ohio Medicaid', 'https://medicaid.ohio.gov/families-and-individuals'],
  ['Georgia', 'Georgia Medicaid', 'https://medicaid.georgia.gov/'],
  ['North Carolina', 'NC Medicaid', 'https://medicaid.ncdhhs.gov/'],
  ['Michigan', 'Michigan Medicaid', 'https://www.michigan.gov/mdhhs/assistance-programs/medicaid'],
]

const medicaidBase = BASE_CARRIERS.find((item) => item.slug === 'medicaid')
const medicaidStatePages = MEDICAID_STATES.map(([state, programName, sourceUrl]) =>
  carrier({
    name: `${state} Medicaid`,
    slug: `medicaid-${state.toLowerCase().replaceAll(' ', '-')}`,
    catalogSlug: 'medicaid',
    directoryName: 'Medicaid',
    summary: `Yes. ${programName} covers drug and alcohol treatment, but coverage depends on your eligibility, managed care plan, treatment needs, and the center you choose. Services may include detox, residential care, outpatient programs, and medication for addiction. Your county or managed care plan may control which centers you can use. Call the number on your card and ask about substance use disorder treatment. If your card does not list a health plan, contact ${programName} for the correct local contact.`,
    planNote: `${programName} follows ${state} rules. Available programs, managed care companies, transportation help, and treatment limits can differ by county and eligibility group.`,
    networkNote: `A center must be able to bill ${programName} or your specific managed care plan. A center that accepts Medicaid elsewhere may not participate in ${state}.`,
    authorizationNote: `${programName} or your managed care plan may require approval for higher levels of care. The center normally submits the clinical request.`,
    sourceUrl,
    sourceLabel: `${programName} official information`,
    faqs: medicaidBase.faqs,
  }),
)

export const INSURANCE_CARRIER_CONTENT = [...BASE_CARRIERS, ...medicaidStatePages]

export const PRIORITY_INSURANCE_CARRIERS = BASE_CARRIERS.map(
  ({ name, slug, summary, logoUrl }) => ({ name, slug, summary, logo_url: logoUrl }),
)

export const MEDICAID_STATE_PAGES = medicaidStatePages

export function getInsuranceCarrierContent(slug) {
  return INSURANCE_CARRIER_CONTENT.find((item) => item.slug === slug) || null
}
