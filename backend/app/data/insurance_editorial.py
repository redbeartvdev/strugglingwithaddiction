"""First-pass editorial for priority carrier coverage pages.

Applied only when content_html is empty so admin edits are preserved on reseed.
"""

_DISCLAIMER = (
    "<p><em>Listings self-attest which carriers they accept. "
    "Struggling With Addiction does not verify your specific plan benefits, "
    "network status, or prior authorization. Always confirm coverage with the facility "
    "and your insurer before admission.</em></p>"
)


def _page(name: str, body: str) -> dict:
    return {
        "meta_title": f"Does {name} Cover Rehab?",
        "meta_description": (
            f"Learn how {name} typically covers addiction treatment, what to ask your plan, "
            f"and browse facilities in our directory that attest to accepting {name}."
        ),
        "hero_title": f"Does {name} cover rehab?",
        "summary": (
            f"Many addiction treatment programs work with {name}. Coverage depends on your plan, "
            "medical necessity, and network rules — start with facilities that list this carrier."
        ),
        "content_html": body + _DISCLAIMER,
        "show_on_hub": True,
    }


INSURANCE_EDITORIAL_SEED: dict[str, dict] = {
    "aetna": _page(
        "Aetna",
        """
<p>Aetna (including many employer and Marketplace plans) commonly covers medically necessary substance use treatment — detox, residential, PHP, IOP, and outpatient — when criteria are met. Behavioral health benefits are often administered through Aetna or a partner like Magellan or Optum.</p>
<p>Before you call admissions, gather your member ID, group number, and the level of care you need. Ask whether the facility is in-network for your specific plan (PPO, HMO, EPO) and whether prior authorization is required for detox or residential.</p>
<ul>
<li>Confirm in-network vs out-of-network benefits and deductible status</li>
<li>Ask about concurrent review during a residential stay</li>
<li>Request a single case agreement if the right program is out of network</li>
</ul>
<p>Use the directory module below to find facilities that list Aetna among accepted carriers, then contact them directly to verify your benefits.</p>
""",
    ),
    "cigna": _page(
        "Cigna",
        """
<p>Cigna and Cigna Healthcare plans frequently include substance use disorder benefits for detox, residential, and outpatient levels of care. Many Cigna members access care through Cigna Behavioral Health or Evernorth.</p>
<p>Coverage still hinges on medical necessity, your plan’s network, and authorization rules. Residential and detox almost always need prior authorization; IOP and outpatient may require notification.</p>
<ul>
<li>Call the behavioral health number on your card, not only the medical line</li>
<li>Ask for remaining residential day limits and out-of-pocket estimates</li>
<li>Clarify whether your plan uses a third-party utilization manager</li>
</ul>
<p>Browse facilities below that attest to accepting Cigna, then complete a benefits check with the center’s admissions team.</p>
""",
    ),
    "blue-cross-blue-shield": _page(
        "Blue Cross Blue Shield",
        """
<p>Blue Cross Blue Shield is a federation of independent plans — Anthem, HCSC, CareFirst, and others — so rehab coverage varies by state and employer contract. Most BCBS plans cover medically necessary addiction treatment across the continuum of care.</p>
<p>Always identify your specific BCBS company (look at the card logo and three-letter prefix). Network directories and prior-auth rules differ between Blues plans even when the brand looks the same.</p>
<ul>
<li>Confirm which BCBS plan you have and its service area</li>
<li>Ask if the facility contracts with your local Blue or uses BlueCard</li>
<li>Request written confirmation of authorized days for residential or detox</li>
</ul>
<p>Facilities in our directory that list Blue Cross Blue Shield are a starting point — verify with admissions that they accept <em>your</em> Blue plan.</p>
""",
    ),
    "unitedhealthcare": _page(
        "UnitedHealthcare",
        """
<p>UnitedHealthcare (UHC) and many UnitedHealthcare employer and Marketplace plans cover substance use treatment when medically necessary. Behavioral health is often managed by Optum, so members may need to call Optum for authorizations even when the medical card says UnitedHealthcare.</p>
<p>Detox and residential typically require prior authorization. Ask whether your plan is UHC commercial, UHC Community Plan (Medicaid), or Medicare Advantage — networks differ.</p>
<ul>
<li>Use the Optum / behavioral health number on your card</li>
<li>Ask about in-network facility lists for residential and detox</li>
<li>Document authorization reference numbers before travel</li>
</ul>
<p>Explore directory listings that include UnitedHealthcare, then let the facility run a benefits verification with your member ID.</p>
""",
    ),
    "tricare": _page(
        "Tricare",
        """
<p>TRICARE covers medically necessary substance use disorder treatment for eligible service members, retirees, and families. Available levels of care and referral rules depend on whether you have TRICARE Prime, Select, or another region-specific option.</p>
<p>Active-duty members usually need referrals through military channels. Retirees and family members on Select have more flexibility but still face medical-necessity and authorization requirements for higher levels of care.</p>
<ul>
<li>Confirm your TRICARE region and plan type</li>
<li>Ask whether the facility is a TRICARE-authorized provider</li>
<li>Clarify referral vs authorization requirements before admission</li>
</ul>
<p>Use the module below to find centers that list Tricare, then call admissions to confirm they can bill TRICARE for the level of care you need.</p>
""",
    ),
    "medicaid": _page(
        "Medicaid",
        """
<p>Medicaid coverage for rehab is state-specific. Some states cover residential and detox broadly; others limit days, require managed-care plan approval, or emphasize outpatient and MAT first.</p>
<p>If you have Medicaid managed care (often through a private plan logo on the card), call that plan’s behavioral health line — not only the state Medicaid office. Ask which facilities are contracted for your county and level of care.</p>
<ul>
<li>Identify your state and managed-care organization (MCO)</li>
<li>Ask about residential day limits and transportation benefits</li>
<li>Confirm whether prior authorization is required for detox or residential</li>
</ul>
<p>Directory facilities that list Medicaid may accept Medicaid in one or more states. Always confirm state eligibility and plan network with the center before traveling.</p>
""",
    ),
}
