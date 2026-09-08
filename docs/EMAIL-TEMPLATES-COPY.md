# Email templates — copy review

Source of truth in code: `backend/app/services/email.py` (`TEMPLATE_META` + `DEFAULT_TEMPLATES`).

This document is **copy only** for review. Placeholders use `{variable}` syntax and are substituted at send time. Admins can override subject/body in the dashboard without changing this file.

HTML wrapping (logo header, social footer) is shared across all templates and is not listed here.

## Voice & style

Apply to every template:

- Sound like a person, not a system. Contractions are fine ("you're," "we've," "don't"). Short sentences. No corporate throat-clearing.
- Warm, not cutesy. Skip exclamation points, emojis, and forced enthusiasm.
- Say the useful thing first. Lead with what happened or what's needed, not a greeting-then-preamble.
- Consumer emails (auth, claim intros, leads) can be the warmest — plain, human, a little reassuring.
- Provider/billing emails stay warm but more direct.
- Internal admin alerts stay functional — scannable, no personality overhead, but not robotic.
- Every functional detail (links, codes, expiry windows, amounts, dates) is preserved exactly.

---

## Auth

### `account_created` — Account created

Welcome a new client account and point them to next steps.

**Subject**

```
You're in — let's get {name} set up
```

**Body**

```
Hi {name},

Your account ({email}) is ready to go{claim_for}.

Sign in here: {login_url}

If you started a listing claim, pick up right where you left off from your claim status page.

Glad you're here.
— Struggling With Addiction
```

**Placeholders:** `{name}`, `{email}`, `{claim_for}`, `{login_url}`

---

### `email_confirmation` — Email confirmation

Confirm a new or changed account email address.

**Subject**

```
Quick thing — confirm your email
```

**Body**

```
Hi {name},

One quick step to lock in your account. Confirm your email here:
{confirmation_url}

Heads up: this link is only good for one hour.
```

**Placeholders:** `{name}`, `{confirmation_url}`

---

### `password_reset` — Password reset

Secure link to set a new account password.

**Subject**

```
Let's get you a new password
```

**Body**

```
Hi {name},

Here's your secure link to set a new password:
{reset_url}

Didn't request this? No action needed — just ignore this email.
```

**Placeholders:** `{name}`, `{reset_url}`

---

### `password_changed` — Password changed

Security notice after a successful password change.

**Subject**

```
Your password was just changed
```

**Body**

```
Hi {name},

Just confirming — your Struggling With Addiction password was updated a moment ago.

If that was you, you're all set, nothing else to do.

If it wasn't, reset it right away here: {reset_url}
Or reach us directly: {support_email}
```

**Placeholders:** `{name}`, `{reset_url}`, `{support_email}`

---

### `admin_invite` — Superadmin invitation

Invite a new platform administrator to set a password.

**Subject**

```
You've been invited to help run Struggling With Addiction
```

**Body**

```
Hi {name},

{invited_by} just invited you on as a superadmin for Struggling With Addiction.

Set your password here to get started:
{reset_url}

Once that's done, sign in here:
{login_url}

This invite link is active for 24 hours. If this wasn't meant for you, feel free to ignore it.
```

**Placeholders:** `{name}`, `{invited_by}`, `{reset_url}`, `{login_url}`

---

## Claim

### `outreach_invite` — Outreach invite

Invite an unclaimed center to claim their directory listing.

**Subject**

```
Your facility is already listed — come claim it
```

**Body**

```
Hi,

Your facility already has a page on our directory: {listing_url}

Claim it and you'll be able to manage your profile directly and hear from people reaching out to you:
{claim_url}

— {site_name}
{postal_address}

Don't want these emails? Unsubscribe here: {unsubscribe_url}
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
New listing claim just came in.

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
Someone asked to add a facility to the directory.

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
Got it — thanks for adding {center_name}
```

**Body**

```
Hi {name},

Thanks for submitting {center_name}. Our team's going to take a look, and we'll follow up if we need anything more from you.

— {site_name}
```

**Placeholders:** `{name}`, `{center_name}`, `{site_name}`

---

### `center_submission_approved` — Center submission approved

Notify the submitter that their facility was accepted.

**Subject**

```
Good news — {center_name} is officially listed
```

**Body**

```
Hi {name},

We reviewed your submission and {center_name} is officially on the directory.

{admin_notes}

You can log in and start managing the listing here: {login_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{admin_notes}`, `{login_url}`

---

### `center_submission_rejected` — Center submission rejected

Notify the submitter that their facility was not accepted.

**Subject**

```
Update on your submission for {center_name}
```

**Body**

```
Hi {name},

We weren't able to accept {center_name} to the directory at this time.

{admin_notes}

Questions about this? Reach us at {support_email} — happy to walk through it.
```

**Placeholders:** `{name}`, `{center_name}`, `{admin_notes}`, `{support_email}`

---

### `verification` — Claim verification

Ask a claimant to upload rehab certification.

**Subject**

```
One more step to verify {center_name}
```

**Body**

```
Hi {name},

We've got your claim for {center_name} (ticket {ticket}) — here's what's left:

1. Choose a monthly or yearly plan: {claim_url}
2. After payment, upload your state license or accreditation certificate.

Once an admin reviews it, your listing unlocks.
```

**Placeholders:** `{name}`, `{center_name}`, `{ticket}`, `{claim_url}`

---

### `claim_submitted` — Claim submitted

Confirm to the claimant that their claim and certification were received.

**Subject**

```
We've got your paperwork for {center_name}
```

**Body**

```
Hi {name},

Your certification for {center_name} (ticket {ticket}) is in and waiting on an admin to verify it. Your claim is already submitted — there's nothing more to do on your end right now.

Track where things stand here:
{claim_url}

We'll email you as soon as it's reviewed.
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
A certification just came in for review.

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
You're verified — let's finish claiming {center_name}
```

**Body**

```
Hi {name},

Good news — your certification for {center_name} checked out (ticket {ticket}).

Pick a plan to finish claiming your listing:
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

Your claim for {center_name} (ticket {ticket}) wasn't approved.

{admin_notes}

If you have questions, our team's here: {support_email}
```

**Placeholders:** `{name}`, `{center_name}`, `{ticket}`, `{admin_notes}`, `{support_email}`

---

### `claim_abandon_reminder` — Claim abandon reminder

Day 1 or day 2 nudge with a link to continue an unfinished claim.

**Subject**

```
You're almost done claiming {center_name}
```

**Body**

```
Hi {name},

You started claiming {center_name} but didn't quite finish (reminder {day} of 2).

Pick it back up here:
{continue_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{day}`, `{continue_url}`

---

### `submit_abandon_reminder` — Submit-center abandon reminder

Day 1 or day 2 nudge with a link to continue an unfinished center submission.

**Subject**

```
Still want to add {center_name}?
```

**Body**

```
Hi {name},

You started adding {center_name} to our directory but didn't get to finish (reminder {day} of 2).

Jump back in here:
{continue_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{day}`, `{continue_url}`

---

### `phone_callback_code` — Phone callback code (email backup)

Email backup of the facility phone ownership code.

**Subject**

```
Your verification code for {center_name}
```

**Body**

```
Hi {name},

Here's your verification code for claiming {center_name}:

{otp_code}

It's good for 15 minutes. Enter it on your claim status page:
{claim_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{otp_code}`, `{claim_url}`

---

## Billing

### `welcome` — Welcome / listing claimed

Sent after a listing is claimed and payment succeeds.

**Subject**

```
Welcome aboard — {center_name} is officially yours
```

**Body**

```
Hi {name},

Payment's through and {center_name} is now officially claimed. Welcome to Struggling With Addiction.

One-click login: {login_url}

A few things worth doing first: fill out your profile, add photos, and list your services, insurances, and levels of care. It's the fastest way to show up well to people searching.

Billing portal: {billing_url}
Receipt: {receipt_url}
Need anything? {support_email}
```

**Placeholders:** `{name}`, `{center_name}`, `{login_url}`, `{billing_url}`, `{receipt_url}`, `{support_email}`

---

### `payment_receipt` — Payment receipt

Receipt after a successful Stripe subscription payment.

**Subject**

```
Your receipt from Struggling With Addiction
```

**Body**

```
Hi {name},

Thanks — we received your payment of {amount} for {center_name}.

View receipt: {receipt_url}
Manage billing: {billing_url}
```

**Placeholders:** `{name}`, `{amount}`, `{center_name}`, `{receipt_url}`, `{billing_url}`

---

### `subscription_renewed` — Subscription renewed

Confirm a successful recurring renewal charge.

**Subject**

```
You're all set — {center_name} renewed
```

**Body**

```
Hi {name},

Your subscription for {center_name} renewed without a hitch.

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
Heads up — {center_name} renews in {days_left} day(s)
```

**Body**

```
Hi {name},

Just a heads up: your subscription for {center_name} renews on {renewal_date}, about {days_left} day(s) from now.

Manage billing: {billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{renewal_date}`, `{days_left}`, `{billing_url}`

---

### `dunning` — Payment failed (dunning)

Ask the subscriber to update their card after a failed renewal.

**Subject**

```
We couldn't process your payment for {center_name}
```

**Body**

```
Hi {name},

We ran into a problem renewing your subscription for {center_name} — the charge didn't go through.

Update your card here before your listing loses access to paid features:
{billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{billing_url}`

---

### `cancellation` — Cancellation confirmed

Confirm subscription cancellation and access end date.

**Subject**

```
Your cancellation for {center_name} is confirmed
```

**Body**

```
Hi {name},

Confirming your subscription for {center_name} is set to end on {access_end}.

You'll keep full access until then. After that, the listing goes back to the basic view.

Change your mind? You can resubscribe anytime: {billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{access_end}`, `{billing_url}`

---

### `subscription_expired` — Subscription expired / access ended

Confirm that paid listing access has ended.

**Subject**

```
Paid access for {center_name} has ended
```

**Body**

```
Hi {name},

Your paid access for {center_name} has wrapped up, and the listing is back on the basic view for now.

Whenever you're ready, resubscribing restores your full profile and dashboard: {billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{billing_url}`

---

### `win_back` — Win-back

Invite a downgraded center to resubscribe.

**Subject**

```
{center_name}'s full listing is one click away
```

**Body**

```
Hi {name},

{center_name} is currently on the basic view. Resubscribe and everything comes back instantly — full profile, dashboard, the works.

{billing_url}
```

**Placeholders:** `{name}`, `{center_name}`, `{billing_url}`

---

## Leads

### `new_lead_alert` — New lead alert

Email a listing inquiry to the center’s assigned address. Inquiries are not stored in our database.

**Subject**

```
Someone reached out about {center_name}
```

**Body**

```
You've got a new inquiry. Reply directly to this email to reach the visitor.

Name: {lead_name}
Email: {lead_email}
Phone: {lead_phone}
Message:
{lead_message}

Listing: {source_url}

This inquiry was emailed to you and is not stored in the Struggling With Addiction database.
```

**Placeholders:** `{center_name}`, `{lead_name}`, `{lead_email}`, `{lead_phone}`, `{lead_message}`, `{source_url}`

---

### `lead_reply` — Lead reply

Forward a provider reply to the visitor who inquired.

**Subject**

```
{center_name} just replied to you
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
Your updates for {center_name} are live
```

**Body**

```
Hi {name},

Good news — your changes to {center_name} are published and visible now:
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

Thanks for picking up {product_label} for {center_name}.

Amount: {amount}
Order ID: {order_id}

Manage your listing: {login_url}
Billing: {billing_url}
```

**Placeholders:** `{name}`, `{product_label}`, `{center_name}`, `{amount}`, `{order_id}`, `{login_url}`, `{billing_url}`

---

### `upsell_fulfilled` — Upsell fulfilled

Notify the client that a human-fulfilled upsell is complete.

**Subject**

```
{product_label} is ready for {center_name}
```

**Body**

```
Hi {name},

Good news — {product_label} for {center_name} is done and live.

View your listing: {listing_url}
Dashboard: {login_url}
```

**Placeholders:** `{name}`, `{product_label}`, `{center_name}`, `{listing_url}`, `{login_url}`

---

### `upsell_human_lead` — Upsell human lead (internal)

Internal alert when a human-closed upsell interest is captured.

**Subject**

```
Hot upsell lead — {product_label}
```

**Body**

```
Internal alert: {name} ({email}) purchased interest in {product_label} for {center_name}.
Order ID: {order_id}
Route to senior team / PJ to close.
```

**Placeholders:** `{name}`, `{email}`, `{product_label}`, `{center_name}`, `{order_id}`

---

## Marketing

### `product_updates` — Product updates

Occasional directory product and feature updates.

**Subject**

```
What's new around here
```

**Body**

```
Hi {name},

A quick update from {site_name}.

{product_update_body}

See it in your dashboard: {login_url}
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
