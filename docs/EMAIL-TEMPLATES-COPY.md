# Email templates — copy review

Source of truth in code: `backend/app/services/email.py` (`TEMPLATE_META` + `DEFAULT_TEMPLATES`).

This document is **copy only** for review. Placeholders use `{variable}` syntax and are substituted at send time. Admins can override subject/body in the dashboard without changing this file.

HTML wrapping (logo header, social footer) is shared across all templates and is not listed here.

---

## Auth

### `account_created` — Account created

Welcome a new client account and point them to next steps.

**Subject**

```
Your Struggling With Addiction account is ready
```

**Body**

```
Hi {name},

Your account ({email}) is set up{claim_for}.

Sign in here: {login_url}

If you started a listing claim, continue verification from your claim status page.
```

**Placeholders:** `{name}`, `{email}`, `{claim_for}`, `{login_url}`

---

### `email_confirmation` — Email confirmation

Confirm a new or changed account email address.

**Subject**

```
Confirm your email address
```

**Body**

```
Hi {name},

Confirm your email address to secure your account:
{confirmation_url}

This link expires in one hour.
```

**Placeholders:** `{name}`, `{confirmation_url}`

---

### `password_reset` — Password reset

Secure link to set a new account password.

**Subject**

```
Reset your password
```

**Body**

```
Hi {name},

Use this secure link to set a new password:
{reset_url}

If you did not request this, ignore this email.
```

**Placeholders:** `{name}`, `{reset_url}`

---

### `password_changed` — Password changed

Security notice after a successful password change.

**Subject**

```
Your password was changed
```

**Body**

```
Hi {name},

Your Struggling With Addiction password was just updated.

If this was you, no further action is needed.
If you did not change your password, reset it immediately: {reset_url}
Support: {support_email}
```

**Placeholders:** `{name}`, `{reset_url}`, `{support_email}`

---

### `admin_invite` — Superadmin invitation

Invite a new platform administrator to set a password.

**Subject**

```
You have been invited as a Struggling With Addiction superadmin
```

**Body**

```
Hi {name},

{invited_by} invited you to administer the Struggling With Addiction platform.

Set your password using this secure link:
{reset_url}

After setting your password, sign in here:
{login_url}

This invitation link expires in 24 hours. If you were not expecting this invitation, ignore this email.
```

**Placeholders:** `{name}`, `{invited_by}`, `{reset_url}`, `{login_url}`

---

## Claim

### `outreach_invite` — Outreach invite

Invite an unclaimed center to claim their directory listing.

**Subject**

```
Your center is listed on Struggling With Addiction — claim it today
```

**Body**

```
Hi,

Your facility appears in our directory at {listing_url}.

Claim your listing to manage your profile and receive visitor inquiries:
{claim_url}

— {site_name}
{postal_address}
Unsubscribe: {unsubscribe_url}
```

**Placeholders:** `{listing_url}`, `{claim_url}`, `{site_name}`, `{postal_address}`, `{unsubscribe_url}`

---

### `admin_new_claim` — Admin — new claim started

Internal alert when someone starts a listing claim.

**Subject**

```
New claim started — {center_name}
```

**Body**

```
A new listing claim was started.

Center: {center_name}
Ticket: {ticket}
Claimant: {name}
Email: {email}
Phone: {lead_phone}

Review claims: {admin_claims_url}
Claim status: {claim_url}
```

**Placeholders:** `{center_name}`, `{ticket}`, `{name}`, `{email}`, `{lead_phone}`, `{admin_claims_url}`, `{claim_url}`

---

### `admin_new_center_submission` — Admin — new center submission

Internal alert when someone submits a missing facility.

**Subject**

```
New center submission — {center_name}
```

**Body**

```
A facility asked to be added to the directory.

Submission #{submission_id}
Center: {center_name}
Contact: {name}
Email: {email}
Phone: {lead_phone}
Address: {location}
Services: {services}
Insurance: {insurances}

Description:
{description}

Open Submission Center: {admin_submissions_url}
```

**Placeholders:** `{center_name}`, `{submission_id}`, `{name}`, `{email}`, `{lead_phone}`, `{location}`, `{services}`, `{insurances}`, `{description}`, `{admin_submissions_url}`

---

### `center_submission_received` — Center submission received

Confirm to the submitter that we received their facility.

**Subject**

```
We received your facility submission
```

**Body**

```
Hi {name},

Thanks for submitting {center_name}. Our team will review the details and follow up if we need anything else.

— {site_name}
```

**Placeholders:** `{name}`, `{center_name}`, `{site_name}`

---

### `center_submission_approved` — Center submission approved

Notify the submitter that their facility was accepted.

**Subject**

```
Your facility submission was accepted — {center_name}
```

**Body**

```
Hi {name},

Good news — we accepted your submission for {center_name}.

{admin_notes}

Provider login: {login_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{admin_notes}`, `{login_url}`

---

### `center_submission_rejected` — Center submission rejected

Notify the submitter that their facility was not accepted.

**Subject**

```
Update on your facility submission — {center_name}
```

**Body**

```
Hi {name},

We were unable to accept the submission for {center_name} at this time.

{admin_notes}

Questions? Contact {support_email}
```

**Placeholders:** `{name}`, `{center_name}`, `{admin_notes}`, `{support_email}`

---

### `verification` — Claim verification

Ask a claimant to upload rehab certification.

**Subject**

```
Subscribe, then upload certification for {center_name}
```

**Body**

```
Hi {name},

We received your claim for {center_name} (ticket {ticket}).

1. Choose a monthly or yearly plan at: {claim_url}
2. After payment, upload your state license or accreditation certificate.

Your listing unlocks after admin verification.
```

**Placeholders:** `{name}`, `{center_name}`, `{ticket}`, `{claim_url}`

---

### `claim_submitted` — Claim submitted

Confirm to the claimant that their claim and certification were received.

**Subject**

```
Your claim for {center_name} is pending admin verification
```

**Body**

```
Hi {name},

We received your proof for {center_name} (ticket {ticket}).

Your claim is already submitted and is waiting for an admin to verify your certification. Please wait — you cannot finish claiming the listing until verification is complete.

Track your claim status here:
{claim_url}

We will email you again once an admin verifies (or rejects) your claim.
```

**Placeholders:** `{name}`, `{center_name}`, `{ticket}`, `{claim_url}`

---

### `claim_under_review_admin` — Admin — certification under review

Internal alert when certification is uploaded for review.

**Subject**

```
Certification uploaded — review claim {ticket}
```

**Body**

```
Certification was uploaded for review.

Center: {center_name}
Ticket: {ticket}
Claimant: {name} ({email})

Open claims queue: {admin_claims_url}
```

**Placeholders:** `{center_name}`, `{ticket}`, `{name}`, `{email}`, `{admin_claims_url}`

---

### `claim_certified` — Claim certified

Tell the claimant they are verified and can subscribe.

**Subject**

```
You're verified — subscribe to claim {center_name}
```

**Body**

```
Hi {name},

Your certification for {center_name} is verified (ticket {ticket}).

Choose a plan to finish claiming your listing:
{billing_url}

Claim status: {claim_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{ticket}`, `{billing_url}`, `{claim_url}`

---

### `claim_rejected` — Claim rejected

Notify the claimant that their claim was not approved.

**Subject**

```
Update on your claim for {center_name}
```

**Body**

```
Hi {name},

Your claim for {center_name} (ticket {ticket}) was not approved.

{admin_notes}

Questions? Contact support: {support_email}
```

**Placeholders:** `{name}`, `{center_name}`, `{ticket}`, `{admin_notes}`, `{support_email}`

---

### `claim_abandon_reminder` — Claim abandon reminder

Day 1 or day 2 nudge with a link to continue an unfinished claim.

**Subject**

```
Finish claiming {center_name}
```

**Body**

```
Hi {name},

You started a claim for {center_name} but did not finish (reminder day {day} of 2).

Return and continue here:
{continue_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{day}`, `{continue_url}`

---

### `submit_abandon_reminder` — Submit-center abandon reminder

Day 1 or day 2 nudge with a link to continue an unfinished center submission.

**Subject**

```
Finish adding {center_name}
```

**Body**

```
Hi {name},

You started adding {center_name} to our directory but did not finish (reminder day {day} of 2).

Return and continue here:
{continue_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{day}`, `{continue_url}`

---

### `phone_callback_code` — Phone callback code (email backup)

Email backup of the facility phone ownership code.

**Subject**

```
Your facility phone verification code
```

**Body**

```
Hi {name},

Your verification code for claiming {center_name} is:

{otp_code}

This code expires in 15 minutes. Enter it on your claim status page:
{claim_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{otp_code}`, `{claim_url}`

---

## Billing

### `welcome` — Welcome / listing claimed

Sent after a listing is claimed and payment succeeds.

**Subject**

```
Welcome — your listing is claimed
```

**Body**

```
Hi {name},

Payment received. Your listing {center_name} is now claimed.

One-click login: {login_url}
Getting started checklist: complete your profile, add media, services, insurances, and levels of care.

Billing portal: {billing_url}
Receipt: {receipt_url}
Support: {support_email}
```

**Placeholders:** `{name}`, `{center_name}`, `{login_url}`, `{billing_url}`, `{receipt_url}`, `{support_email}`

---

### `payment_receipt` — Payment receipt

Receipt after a successful Stripe subscription payment.

**Subject**

```
Receipt for your Struggling With Addiction subscription
```

**Body**

```
Hi {name},

Thanks for your payment of {amount} for {center_name}.

View receipt: {receipt_url}
Manage billing: {billing_url}
```

**Placeholders:** `{name}`, `{amount}`, `{center_name}`, `{receipt_url}`, `{billing_url}`

---

### `subscription_renewed` — Subscription renewed

Confirm a successful recurring renewal charge.

**Subject**

```
Your subscription renewed successfully
```

**Body**

```
Hi {name},

We successfully renewed your subscription for {center_name}.

Amount: {amount}
Next renewal: {renewal_date}

Manage billing: {billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{amount}`, `{renewal_date}`, `{billing_url}`

---

### `renewal_reminder` — Renewal reminder

Remind a subscriber that their card will be charged soon.

**Subject**

```
Your subscription renews in {days_left} day(s)
```

**Body**

```
Hi {name},

Your subscription for {center_name} renews on {renewal_date} (about {days_left} day(s) from now).

Manage billing: {billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{renewal_date}`, `{days_left}`, `{billing_url}`

---

### `dunning` — Payment failed (dunning)

Ask the subscriber to update their card after a failed renewal.

**Subject**

```
Update payment before your listing downgrades
```

**Body**

```
Hi {name},

We could not renew your subscription for {center_name}.

Update your card here before access ends: {billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{billing_url}`

---

### `cancellation` — Cancellation confirmed

Confirm subscription cancellation and access end date.

**Subject**

```
Your subscription cancellation is confirmed
```

**Body**

```
Hi {name},

Your subscription for {center_name} will end on {access_end}.

Until then you keep full access. After that the listing reverts to the basic view.
Resubscribe anytime: {billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{access_end}`, `{billing_url}`

---

### `subscription_expired` — Subscription expired / access ended

Confirm that paid listing access has ended.

**Subject**

```
Your paid listing access has ended
```

**Body**

```
Hi {name},

Paid access for {center_name} has ended and the listing is back on the basic view.

Resubscribe anytime to restore your full profile and dashboard:
{billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{billing_url}`

---

### `win_back` — Win-back

Invite a downgraded center to resubscribe.

**Subject**

```
Resubscribe — everything restores instantly
```

**Body**

```
Hi {name},

Your listing {center_name} is back on the basic view.

Resubscribe to restore your full profile and dashboard: {billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{billing_url}`

---

## Leads

### `new_lead_alert` — New lead alert

Notify a provider when a visitor submits an inquiry.

**Subject**

```
New inquiry for {center_name}
```

**Body**

```
You have a new lead.

Name: {lead_name}
Email: {lead_email}
Phone: {lead_phone}
Message:
{lead_message}

Source: {source_url}
Open inbox: {inbox_url}
```

**Placeholders:** `{center_name}`, `{lead_name}`, `{lead_email}`, `{lead_phone}`, `{lead_message}`, `{source_url}`, `{inbox_url}`

---

### `lead_reply` — Lead reply

Forward a provider reply to the visitor who inquired.

**Subject**

```
{center_name} replied to your inquiry
```

**Body**

```
Hi {lead_name},

{reply_message}

— {center_name}
```

**Placeholders:** `{center_name}`, `{lead_name}`, `{reply_message}`

---

### `profile_published` — Profile published

Confirm that listing updates are live on the public site.

**Subject**

```
Your listing changes are live
```

**Body**

```
Hi {name},

Updates to {center_name} are now published:
{listing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{listing_url}`

---

## Upsells

### `upsell_receipt` — Upsell receipt

Confirm purchase of a listing upsell product.

**Subject**

```
Receipt — {product_label}
```

**Body**

```
Hi {name},

Thanks for purchasing {product_label} for {center_name}.

Amount: {amount}
Order id: {order_id}

Manage your listing: {login_url}
Billing: {billing_url}
```

**Placeholders:** `{name}`, `{product_label}`, `{center_name}`, `{amount}`, `{order_id}`, `{login_url}`, `{billing_url}`

---

### `upsell_fulfilled` — Upsell fulfilled

Notify the client that a human-fulfilled upsell is complete.

**Subject**

```
Your {product_label} is ready
```

**Body**

```
Hi {name},

Great news — {product_label} for {center_name} is complete.

View your listing: {listing_url}
Dashboard: {login_url}
```

**Placeholders:** `{name}`, `{product_label}`, `{center_name}`, `{listing_url}`, `{login_url}`

---

### `upsell_human_lead` — Upsell human lead (internal)

Internal alert when a human-closed upsell interest is captured.

**Subject**

```
Hot content upsell lead — {product_label}
```

**Body**

```
Internal alert: {name} ({email}) purchased interest in {product_label} for {center_name}.
Order id: {order_id}
Route to senior / PJ to close.
```

**Placeholders:** `{name}`, `{email}`, `{product_label}`, `{center_name}`, `{order_id}`

---

## Marketing

### `product_updates` — Product updates

Occasional directory product and feature updates.

**Subject**

```
What's new in the directory
```

**Body**

```
Hi {name},

Here's a quick update from {site_name}.

{product_update_body}

Explore your dashboard: {login_url}
```

**Placeholders:** `{name}`, `{site_name}`, `{product_update_body}`, `{login_url}`

---

## Catalog index

| Key | Label | Category |
| --- | --- | --- |
| `account_created` | Account created | auth |
| `email_confirmation` | Email confirmation | auth |
| `password_reset` | Password reset | auth |
| `password_changed` | Password changed | auth |
| `admin_invite` | Superadmin invitation | auth |
| `outreach_invite` | Outreach invite | claim |
| `admin_new_claim` | Admin — new claim started | claim |
| `admin_new_center_submission` | Admin — new center submission | claim |
| `center_submission_received` | Center submission received | claim |
| `center_submission_approved` | Center submission approved | claim |
| `center_submission_rejected` | Center submission rejected | claim |
| `verification` | Claim verification | claim |
| `claim_submitted` | Claim submitted | claim |
| `claim_under_review_admin` | Admin — certification under review | claim |
| `claim_certified` | Claim certified | claim |
| `claim_rejected` | Claim rejected | claim |
| `claim_abandon_reminder` | Claim abandon reminder | claim |
| `submit_abandon_reminder` | Submit-center abandon reminder | claim |
| `phone_callback_code` | Phone callback code (email backup) | claim |
| `welcome` | Welcome / listing claimed | billing |
| `payment_receipt` | Payment receipt | billing |
| `subscription_renewed` | Subscription renewed | billing |
| `renewal_reminder` | Renewal reminder | billing |
| `dunning` | Payment failed (dunning) | billing |
| `cancellation` | Cancellation confirmed | billing |
| `subscription_expired` | Subscription expired / access ended | billing |
| `win_back` | Win-back | billing |
| `new_lead_alert` | New lead alert | leads |
| `lead_reply` | Lead reply | leads |
| `profile_published` | Profile published | leads |
| `upsell_receipt` | Upsell receipt | upsells |
| `upsell_fulfilled` | Upsell fulfilled | upsells |
| `upsell_human_lead` | Upsell human lead (internal) | upsells |
| `product_updates` | Product updates | marketing |

**Total: 34 templates**
