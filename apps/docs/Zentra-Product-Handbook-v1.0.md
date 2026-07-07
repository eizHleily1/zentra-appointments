# Zentra Product Handbook v1.0

**Status:** Frozen — official product source of truth  
**Effective:** Product Architecture phase complete  
**Audience:** Product, design, engineering, support, and future contributors  
**Launch target:** ~20 businesses · ~2,000 active clients · App Store & Google Play  

**Authority:** If implementation conflicts with this handbook, **the handbook wins**.

This is a **product handbook**. It describes how Zentra behaves from a user and business perspective. It is not a technical design document, engineering handbook, or API specification.

---

## Document control

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | Jul 2026 | Consolidates all approved product decisions; editorial pass for permanence |

---

## 1. Product Vision

### Why Zentra exists

Zentra exists to make booking and running local service appointments feel effortless—for the people who book them and the businesses that provide them.

Independent service businesses (barbers, salons, clinics, coaches, therapists, trainers, and similar providers) need a simple way to take appointments. Their clients need a simple way to find them, book them, and show up on time—without learning software.

### What problem it solves

**For clients:** Scattered phone calls, DMs, and ad-hoc scheduling create friction and uncertainty. Clients want one place to discover local businesses, see real availability, book confidently, and keep track of what is coming next.

**For business owners:** Spreadsheets, paper books, and generic tools treat scheduling as an afterthought. Owners need to see today’s work, book walk-ins, manage services and staff, and know their business is discoverable when they are ready—not before.

**For the platform:** One shared application should support many businesses and many roles without forcing people to switch “modes” or maintain separate identities.

### What success looks like

At launch, success means:

- A client can open Zentra, find a business, book an appointment, and see it on their schedule—without confusion or developer-facing UI.
- A business owner can run today’s operations, book on behalf of clients, and publish their business when ready to be found.
- ~20 businesses and ~2,000 clients rely on Zentra daily without training, lost appointments, or loss of trust.
- The product feels like a **consumer mobile application**, not an internal admin tool.
- Real people **enjoy using it**—or at minimum, never fight it.

**Priority order when trade-offs arise (frozen):**

1. Client experience  
2. Owner experience  
3. UI/UX quality  
4. Developer maintainability  
5. Architecture purity  
6. Implementation effort  

---

## 2. Product Philosophy

This is the soul of Zentra—the belief behind every product decision.

**Clients think about their appointments, not booking software.**  
They wonder when they are going, who they are seeing, and whether they are all set. They do not wonder about client records, booking intervals, or authentication flows. Zentra should meet them in that world.

**Business owners think about serving customers, not managing software.**  
They wonder what is happening today, who is coming in, and whether the shop is ready. They do not wonder about tenant status, snapshot fields, or scheduling grids. Zentra should stay out of their way.

**Zentra handles complexity quietly in the background.**  
Linking accounts to client records, generating available times, preventing double bookings, preserving history—these are the platform’s job. Users should feel the results, not the machinery.

**The best software is barely noticed.**  
When everything feels natural—finding a business, picking a time, confirming a booking, opening the app and knowing what matters—users are not “using Zentra.” They are living their day. That is the standard.

When future product questions arise, ask: *Does this help people focus on their appointments and their customers—or does it ask them to focus on us?* If the latter, reconsider.

---

## 3. Product Principles

These principles guide every product decision:

| Principle | Meaning |
|-----------|---------|
| **Simplicity over cleverness** | Prefer obvious flows over smart but fragile ones. |
| **Clients choose; they don’t type** | Selection beats free text wherever possible. |
| **Automation beats configuration** | When Zentra can safely make the correct decision automatically, it should. Users should rarely configure what the system can reasonably infer. |
| **One obvious next action** | Every screen should have one clear primary action. Users should never wonder what to do next. |
| **Owners manage businesses, not software** | Operational language, not system language. |
| **Consistency beats customization** | Predictable patterns across businesses at launch. |
| **The platform hides complexity** | Users never see scheduling math, internal IDs, or lifecycle enums. |
| **One account, one app, one identity** | No mode switching, no duplicate identities. |
| **Time first, role second** | Show what matters now before who someone is. |
| **Confirmation creates confidence** | Booking must end with clear, human-readable confirmation. |
| **Developer experience matters** | Clean product rules enable clean implementation—but UX wins when they conflict. |
| **Home is personal; Explore is discovery** | Never mix these responsibilities. |

### Automation beats configuration (examples)

Zentra should infer—not ask—when safe:

- Resume booking after login  
- Auto-select a single staff member  
- Auto-create or link client records during consumer booking  
- Automatically load available slots when service, staff, and date are chosen  
- Default booking interval for new businesses (15 minutes at launch)  

Configuration is for genuine business preference—not for work the platform should do on the user’s behalf.

---

## 4. User Types

Zentra serves several kinds of people. One person may be several of these at once.

### Anonymous visitor

**Who:** Someone who has not signed in.

**Goal:** Browse businesses, view profiles, understand what a business offers.

**Can do (Phase 1):** Explore businesses, search, view business profiles, view services/staff/hours on profiles.

**Cannot do without signing in:** Book appointments, view personal schedule, manage account, manage businesses.

### Authenticated client

**Who:** A signed-in user booking appointments for themselves.

**Goal:** Book across many businesses with one account; see upcoming appointments; rebook favorites.

**Can do:** Everything an anonymous visitor can do, plus book appointments, view Schedule, manage Profile, see recent businesses.

**Product rule:** The client never manually selects or creates their own client record during booking. The platform resolves or creates a business-specific client record linked to the user automatically.

### Business owner

**Who:** A user with owner membership in one or more businesses.

**Goal:** Run daily operations, configure the business, book on behalf of clients, publish when ready.

**Can do:** Access business operations (Today, appointments, services, staff, hours, settings), book with client search/create, publish business to Explore.

**Entry path:** Profile → **Manage your businesses** → select or create a business. The user enters the business **by name** (e.g. “RK Barber”), never “Workspace.”

### Staff member

**Who:** A person listed as staff at a business—may or may not have a Zentra login.

**Goal (product intent):** Provide services clients can book; eventually manage their own schedule.

**Phase 1 reality:** Staff exist as bookable resources on business profiles and in scheduling. A dedicated staff daily-use experience is **not** Phase 1. Staff may hold platform accounts for other reasons (e.g. they are also owners or clients).

### Future platform administrator

**Who:** Internal Zentra operator (not a business owner).

**Goal:** Support businesses, handle abuse, manage platform health.

**Phase 1:** Not a user-facing product surface. No admin app in scope.

---

## 5. Navigation Philosophy

### Consumer shell (frozen)

Four bottom tabs:

| Tab | Primary question | Responsibility |
|-----|------------------|----------------|
| **Home** | What matters to me right now? | Personal hub—up next, calm, oriented |
| **Explore** | Where can I book? | All discovery—search, categories, businesses |
| **Schedule** | When am I going? | Unified personal time view |
| **Profile** | Who am I? | Account, recent businesses, owner entry |

**Frozen rules:**

- No role or mode switching in navigation.
- No “Browse vs Owner” chooser.
- App opens to **Explore** (anonymous-friendly entry).
- **Profile** is the tab name (not “You,” “Account,” or “Me”).
- Owner operations live **inside** a business context, reached from Profile—not a separate app personality.

### Home

**Primary question:** “What matters to me right now?”

**Emotional purpose:** Home exists to **reduce uncertainty**. When someone opens Zentra, they should feel oriented—not lost, not overwhelmed, not prompted to hunt.

**For clients, Home answers:** “What matters to me today?”  
Upcoming appointments, what is next, and easy paths to book again should be visible immediately. The client should never open Home and wonder whether they are forgetting something.

**For owners (when applicable), Home also supports:** “My day is under control.”  
Operational relevance may surface here in the future (e.g. today’s work). The feeling should be confidence, not chaos.

**Contains:**

- Up Next (next upcoming appointment)
- Also coming up (additional upcoming, if any)
- Today’s Work (when user has owner/staff operational relevance—future-adaptive)
- Book Again / recent businesses (repeat booking shortcut)
- View full schedule (when signed in with appointments)

**Must NOT contain:**

- Category shortcuts
- Business directories
- Discovery features (those belong in Explore)

**Timeless rule:** Future changes to Home may add content, but must **always preserve** its purpose—reduce uncertainty and answer what matters now. Home is not a directory. Home is not marketing. Home is **me**.

### Explore

**Primary question:** “Where can I book?”

**Contains:**

- Search by business name (first-class, immediately visible)
- Category browse (secondary to search)
- Business list results
- Path to business profile → booking

**Frozen:** Users must never need to pick a category just because they already know the business name.

### Schedule

**Primary question:** “When am I going?”

**Contains:** The signed-in user’s appointments across all businesses, in human-readable form.

**Guest state:** Prompt to sign in; explain value.

### Profile

**Primary question:** “Who am I?”

**Contains:**

- Account identity (email)
- Recent businesses
- Manage your businesses (owner entry)
- Sign in / sign out

### Business operations (owner context)

When an owner enters a business by name, they operate **that business**. Internal architecture may call this a “workspace”; **users never see that term**.

**Business Today primary question:** “What does my business need today?”

Owner tabs (within business context):

- Home / Today
- Appointments
- Services
- Staff
- Settings

---

## 6. Authentication Philosophy

### Frozen rules

| Rule | Detail |
|------|--------|
| **Browsing is public** | Discovery list, search, and business profile viewing do not require login. |
| **Auth for personal actions only** | Booking, Schedule, Profile management, owner operations require sign-in. |
| **Booking resumes after login** | If auth is prompted mid-booking, the flow continues where the user left off. |
| **Profile always in navigation** | Even guests see Profile with a welcoming sign-in path. |
| **Email login for Phase 1** | Email + password registration and login. |
| **Future auth must remain possible** | Phone (especially Israel), Google, and Apple login are future—not Phase 1. Architecture must not block them. |
| **Account status** | Accounts may be ACTIVE or DISABLED. Disabled accounts cannot authenticate. |

### What authentication is NOT

Authentication is identity only. It does not grant business access by itself—business access comes from memberships.

---

## 7. Discovery Philosophy

### Why Explore exists

Explore is the **only** place for finding new businesses. Home is not a directory.

### Categories

Phase 1 discovery categories (consumer labels):

- Barber  
- Beauty  
- Dentist  
- Fitness  
- Clinic  
- Coaching  
- Other  

Categories map to underlying business types; users never see raw type codes.

### Search

- Search by **business name** is first-class.
- Search and categories filter the same business list—they are not separate product worlds.
- Debounced, inline results preferred over “submit search” patterns.

### Business profile (public)

A profile answers: *What is this business, what do they offer, who works there, when are they open, can I book?*

**Shows:** Name, type/category label, location (city/address when available), hours summary, active services, active staff, **Book appointment** action.

**Does not show:** Internal IDs, raw status enums, developer terminology.

### Public visibility vs publish (see §10)

**Important clarification (frozen):**

- “All businesses are publicly visible” means **no private/public toggle per business** in Phase 1—not that incomplete businesses appear in Explore.
- Only **ACTIVE** (published) businesses appear in discovery.
- Unpublished businesses are invisible to clients by design.

---

## 8. Booking Philosophy

### Consumer booking flow (frozen)

```
Business
  ↓
Service
  ↓
Staff (when applicable)
  ↓
Date
  ↓
Available times
  ↓
Confirmation
```

### Owner booking flow

Same scheduling steps after client selection:

```
Client (search or create)
  ↓
Service
  ↓
Staff (when applicable)
  ↓
Date
  ↓
Available times
  ↓
Confirmation
```

### Frozen booking rules

| Rule | Detail |
|------|--------|
| **Clients mostly select; they rarely type** | No manual date entry (`YYYY-MM-DD`). Use date strip and slot grid. |
| **No manual clientId (consumer)** | Platform links user to business client record automatically. |
| **Auth gate before slots** | Guests may browse; available times require sign-in. |
| **Single staff auto-select** | If a business has exactly one staff member, select silently; show “With [Name].” |
| **Multiple staff: selection required** | User picks a staff member. “No Preference” is **future** (see §13). |
| **Slot chips show start time only** | Duration appears on service card and confirmation. |
| **Confirmation shows full window** | Date, start, end, business, service, staff—in human language. |
| **Booking resumes after login** | Pending booking state preserved through auth prompt. |

### What clients should almost never do

- Type dates or times manually  
- Paste or see UUIDs  
- Choose internal records (clientId)  
- Understand scheduling intervals or grid math  

---

## 9. Scheduling Philosophy

**Status:** Frozen (approved Scheduling Philosophy)

### Core separation (frozen)

| Concept | Belongs to | Meaning |
|---------|------------|---------|
| **Service duration** | Service | How long the appointment occupies the calendar |
| **Booking interval** | Business | How often appointments may **start** |

**Frozen rule:** Appointment duration **never** changes booking interval. They are independent.

### Booking interval (business-level)

- Each business has one booking interval for its calendar (Phase 1: shared across all staff).
- **Allowed values:** 5, 10, 15, 20, 30, 60 minutes (whitelist only).
- **Phase 1 default:** Every new business receives **15 minutes** automatically.
- **Phase 1 UI:** Interval is **not exposed** to owners or clients.
- **Future:** Owners may configure interval when vertical needs differ (express barber vs massage clinic).

### Slot generation (product behavior)

1. Generate candidate starts on the business booking interval grid within business hours.
2. Include a start only if `start + service duration` fits within hours and does not overlap blocking appointments.
3. Present surviving starts as available times.

### Client visibility (frozen)

Clients **never** see:

- Booking interval  
- Grid step size  
- “15-minute slots” or similar mechanics  

They simply choose from **available times**.

### Display rules (frozen)

| Surface | Shows |
|---------|--------|
| Slot chips | Start time only (e.g. “9:15 AM”) |
| Service selection | Duration (e.g. “30 min”) |
| Confirmation | Full window (e.g. “Tue, Jul 7 · 9:15 AM – 9:45 AM”) |
| Under slot grid (optional) | Duration reminder (e.g. “30 min appointment”) |

### Worked examples (15-minute default)

| Service duration | Offered starts (empty day) |
|------------------|----------------------------|
| 10 min | `:00`, `:15`, `:30`, `:45` … |
| 30 min | All grid points where 30 min fits |
| 45 min | All grid points where 45 min fits |

Small gaps after short services on a 15-minute grid are **acceptable and often desirable** (turnover, cleanup).

### Overlap and blocking (product behavior)

- **BOOKED** appointments block overlapping slots.
- **CANCELLED** appointments do not block.
- **COMPLETED** appointments in the past block; completed future appointments do not block scheduling (edge case handling).

---

## 10. Business Philosophy

### Terminology

- **User-facing:** Business  
- **Internal/engineering:** Tenant (never shown to users)

### Business lifecycle (frozen)

| Status | Meaning |
|--------|---------|
| **PENDING_ONBOARDING** | Created; **not discoverable**; owner configuring |
| **ACTIVE** | Published; **discoverable** in Explore; accepting bookings |
| **DEACTIVATED** | Closed; not discoverable; preserved for history |

### Onboarding

When an owner creates a business:

1. Business starts as **PENDING_ONBOARDING**.
2. Owner adds services, staff, hours, and location as needed.
3. Owner completes publish checklist.
4. Owner publishes → **ACTIVE** → appears in Explore.

**Why not immediately public:** Prevents empty, broken, or half-configured listings from eroding client trust. Owners must not silently remain undiscoverable without understanding why—surface a clear **Go live** path.

### Publish / Go Live (frozen)

**Requirements before publish:**

- At least one **active service**
- At least one **active staff member**
- **City** set (so clients can find and contextualize the business)

**Owner-facing language:**

- “Finish setup to appear in Explore”
- “Publish business” / “Go live”
- Checklist with human-readable missing steps—not error codes

**Phase 1:** Publish UI in owner Settings and banner on Today when unpublished.

### Owner responsibilities

Owners manage:

- Business profile metadata (name, type, timezone, city, address)
- Services (duration, price optional)
- Staff
- Business hours
- Publishing to Explore
- Daily operations (today’s schedule, booking clients, complete/cancel)

Owners should **not** need to understand booking interval, snapshots, or membership mechanics to run their business.

### Business hours

- All seven days of the week must be represented when hours are configured.
- Closed days are valid.
- Hours respect business timezone.

---

## 11. UX Principles

### Interaction

- **Fewer taps** — every tap must earn its place.
- **Fewer decisions** — auto-select when there is only one sensible option.
- **Clear hierarchy** — one primary action per screen.
- **One obvious next action** — users should never wonder what to do next.

### Language

- **Human language** — “Book appointment,” not “Create appointment entity.”
- **No UUIDs** — never visible in UI.
- **No ISO timestamps** — use localized, readable date/time.
- **No developer terminology** — no “PENDING_ONBOARDING,” “tenant,” “workspace,” “clientId.”
- **Status labels for clients/owners** — “Booked,” “Completed,” “Cancelled,” “Finish setup,” “Active.”

### Feedback

- **Confirmation creates confidence** — explicit success screen after booking.
- **Empty states help** — explain what to do next, not merely “No data.”
- **Errors explain recovery** — “Try another date,” not stack traces.
- **Loading states** — human (“Loading available times…”), not silent hangs.

### Visual product identity (reserved, not Phase 1)

Business cards and profiles should **accommodate future** logo, cover image, and short description without layout redesign. Do not ship these assets in Phase 1 unless explicitly scoped.

### Labels (resolved)

| Choice | Decision |
|--------|----------|
| Tab name: You / Profile / Account / Me | **Profile** (frozen) |
| Home repeat section: Book Again vs Recent Businesses | **Book Again** for action-oriented home section; **Recent businesses** acceptable on Profile |

---

## 12. What Zentra Is NOT

This section protects the product from scope creep. When proposed features drift here, pause and ask whether they belong in Zentra at all.

**Zentra is not:**

- An ERP or general business operating system  
- An accounting or invoicing system  
- An inventory or stock management system  
- A marketing automation or email campaign platform  
- A social network or review site (reviews may come later; they are not the core)  
- A payroll, HR, or staff compliance system  
- A website builder or generic CRM  

**Zentra is:**

A platform whose primary purpose is helping people **discover businesses**, **book appointments**, and helping businesses **run those appointments** effortlessly.

Everything we build should serve that purpose—or it should wait.

---

## 13. Product Rules (Frozen)

Complete registry of approved product rules. Implementation must comply.

### Defining principles (elevated)

These two principles are among Zentra’s defining beliefs. They sit above individual feature rules.

**Clients choose. They don’t type.**  
Selection—not data entry—is the default interaction. Dates, times, services, and staff are chosen from clear options. Free text is reserved for things only a human can provide (e.g. a client’s name when an owner creates a record).

**Every screen answers exactly one primary question.**  
Each screen has one job. Users should never land somewhere and wonder what they are looking at.

| Screen | Primary question |
|--------|------------------|
| Home | What matters to me right now? |
| Explore | Where can I book? |
| Schedule | When am I going? |
| Profile | Who am I? |
| Business Today | What does my business need today? |

Future screens must declare and honor their primary question before they ship.

---

### Identity & navigation

1. One account, one application, one identity.  
2. No role or mode switching.  
3. Consumer tabs: **Home · Explore · Schedule · Profile**.  
4. Home is personal; Explore is all discovery.  
5. Schedule replaces “My Appointments.”  
6. Users enter businesses **by name**; never expose “Workspace.”  
7. Owner entry: Profile → Manage your businesses.  
8. App opens to Explore without requiring sign-in.  

### Authentication & access

9. Browsing and business profiles are public (no JWT required).  
10. Booking, Schedule, Profile actions, and owner operations require authentication.  
11. Booking resumes automatically after login.  
12. Profile tab always visible (guest welcome + sign-in).  
13. Email/password auth for Phase 1; future phone/Google/Apple must remain possible.  
14. Disabled accounts cannot log in.  

### Discovery

15. Only **ACTIVE** businesses appear in Explore.  
16. No private/public visibility toggle in Phase 1.  
17. No invite links or QR onboarding in Phase 1.  
18. Discovery supports category filter and name search.  
19. Search is first-class; categories are secondary.  
20. Public profiles show active services and active staff only.  
21. Optional city and address on businesses for display—not full geo search in Phase 1.  

### Booking

22. Consumer flow: Business → Service → Staff (if needed) → Date → Times → Confirm.  
23. Owner flow: Client → Service → Staff → Date → Times → Confirm.  
24. Clients do not manually enter clientId; platform resolves via linked user.  
25. Owner booking supports client search and inline create.  
26. Single staff member is auto-selected.  
27. Multiple staff: user must select (No Preference deferred).  
28. Clients select dates and times; they do not type them.  
29. Slot chips show start time; confirmation shows full range.  

### Scheduling

30. Service duration belongs to the **Service**.  
31. Booking interval belongs to the **Business**.  
32. Duration and interval are independent concepts.  
33. Phase 1 default booking interval: **15 minutes** for all new businesses.  
34. Phase 1: booking interval not exposed in UI.  
35. Allowed intervals: 5, 10, 15, 20, 30, 60 minutes.  
36. Clients never see scheduling mechanics.  
37. Slots respect business hours, timezone, duration, and overlap rules.  
38. Cancelled appointments do not block availability.  

### Data integrity & history

39. **Historical appointments never change** — snapshots are immutable.  
40. Appointments store snapshots of service name, duration, price, staff name, client name/phone at booking time.  
41. Later edits to service, staff, or client records do not rewrite past appointments.  
42. Deactivation does not delete records.  

### Entity rules

43. **Client records belong to businesses** — not global shared CRM contacts across businesses.  
44. A user may link to client records at many businesses via linkedUserId.  
45. **Service names are unique within a business** (normalized comparison among active services).  
46. **Inactive/deactivated entities** do not appear in booking or public selection lists.  
47. Services require positive duration.  
48. Business timezone must be valid IANA timezone.  

### Business lifecycle

49. New businesses start **PENDING_ONBOARDING**.  
50. Publish requires: ≥1 service, ≥1 staff, city.  
51. Publish transitions business to **ACTIVE** and enables discovery.  
52. Deactivated businesses are not discoverable.  

### Display & trust

53. No UUIDs in user interface.  
54. No raw ISO timestamps in user interface.  
55. No raw enum values in user interface.  
56. Consumer-facing currency/display follows product locale choices (e.g. ₪ for price display where applicable).  

### Priority

57. When trade-offs conflict, follow priority order: Client → Owner → UI/UX → Dev maintainability → Architecture → Effort.  

---

## 14. Future Vision

The following are **intentionally outside Phase 1**. Do not implement unless explicitly approved in a future phase. Architecture should not block them; product behavior must not assume they exist at launch.

### Phase 2

Near-term enhancements that extend the core loop without changing what Zentra is:

- Push notifications and SMS reminders  
- Phone number authentication (especially Israel)  
- Google Sign-In and Apple Sign-In  
- “No Preference” staff assignment  
- Configurable booking interval in owner settings  
- Business branding self-serve (logo, cover image, short description)  
- Apple Calendar and Google Calendar sync  
- Staff daily-use experience (view and manage own appointments)  
- Appointment detail screen (richer client-facing and owner-facing views)  

### Phase 3

Medium-term capabilities that deepen business and client value:

- Payments and deposits  
- Reviews and ratings  
- Private vs public business visibility  
- Invite links and QR codes for client onboarding  
- Multi-location businesses  
- Buffers and processing time between appointments  
- Per-staff booking intervals or availability exceptions  
- CRM-style client notes and history (within business scope)  
- Marketing campaigns and re-engagement tools  
- Advanced owner analytics  
- Featured businesses and marketplace ranking  
- Nearby search and geo-based discovery  

### Future ideas

Longer-horizon possibilities—not designed, not committed:

- Loyalty programs and rewards  
- AI-assisted scheduling or support  
- Platform administrator console  
- Enterprise multi-tenant administration  
- Inventory tied to services  
- Waitlists and walk-in queues  
- Video consultations  
- White-label or franchise tooling  

---

## 15. Resolved Contradictions

The following tensions appeared across iterations. This handbook records the **resolved** interpretation.

| Earlier statement | Later resolution | Frozen interpretation |
|-------------------|------------------|------------------------|
| “All businesses are publicly visible” | Publish / Go Live added | No private toggle in Phase 1, but only **ACTIVE** businesses appear in Explore. Unpublished businesses are hidden intentionally. |
| Client flow starts with login | Anonymous browsing approved | Explore and profiles are public; auth required for booking and Schedule. |
| “Browse vs My Businesses” mode chooser | No mode switching | Single app; owner access via Profile → Manage your businesses. |
| “My Appointments” | Navigation freeze | Tab is **Schedule**. |
| “Workspace” as user concept | Terminology adjustment | Internal architecture only; user enters **business by name**. |
| Platform-wide 15-minute interval | Business-level interval | Interval is a **business property** defaulting to 15 min at launch with no UI. |
| Category-first discovery | Search-first polish | Search is first-class; categories filter, not gate. |

**No unresolved contradictions remain** for Phase 1 product behavior. If new conflicts arise during implementation, escalate for handbook amendment—do not silently choose.

---

## 16. Glossary

### User-facing product language

| Term | Meaning |
|------|---------|
| **Account** | A person’s Zentra identity (email login in Phase 1) |
| **Anonymous visitor** | Someone using Zentra without signing in |
| **Appointment** | A booked time block between a client and a business |
| **Available times** | Start times a client or owner can choose when booking |
| **Book again** | Shortcut to rebook with a recently visited business |
| **Booking** | The act of reserving an appointment |
| **Business** | A bookable local service provider on Zentra |
| **Business hours** | When a business is open for appointments |
| **Business profile** | Public page showing what a business offers |
| **Category** | Discovery grouping (Barber, Beauty, etc.) |
| **Client** | A person who books at a business; may be linked to a Zentra account |
| **Confirmation** | The screen moment after a successful booking |
| **Discovery** | Finding businesses in Explore |
| **Explore** | The tab for search and business discovery |
| **Finish setup** | Owner-facing: business not yet published |
| **Go live / Publish** | Owner action that makes a business discoverable |
| **Home** | Personal tab—what matters now |
| **Owner** | Person who manages a business on Zentra |
| **Profile** | Account tab—identity and business management entry |
| **Schedule** | Personal tab—all upcoming appointments |
| **Service** | Something a client can book, with a name and duration |
| **Sign in / Sign out** | Authentication actions |
| **Slot** | One choosable start time (shown as a chip or list item) |
| **Staff** | A person at a business who delivers services |
| **Up next** | The client’s nearest upcoming appointment |
| **Active** | Business is published and discoverable |
| **Booked** | Appointment status: confirmed and upcoming |
| **Cancelled** | Appointment status: no longer happening |
| **Completed** | Appointment status: service was delivered |

### Internal terms (never user-facing)

| Term | Use instead (if needed) |
|------|-------------------------|
| **Tenant** | Business |
| **Workspace** | The business name (e.g. “RK Barber”) |
| **clientId, userId, UUID** | Never shown |
| **PENDING_ONBOARDING** | Finish setup |
| **Booking interval** | Never shown to clients; “available times” instead |
| **Snapshot** | Never shown; historical appointment details |
| **linkedUserId** | Never shown; automatic account linking |
| **Membership** | Never shown; “you manage this business” |
| **Discovery API** | Never shown; Explore / search |
| **JWT / token** | Never shown; sign in |

### Support and documentation language

When writing help articles or support replies, mirror product language:

- Say **“book an appointment”**, not “create an appointment record.”  
- Say **“your schedule”**, not “My Appointments entity list.”  
- Say **“publish your business”**, not “transition tenant status to ACTIVE.”  
- Say **“available times”**, not “slot grid at 15-minute intervals.”  

---

## 17. Amendment Process

This handbook is **frozen** as Product Handbook v1.0.

To change product behavior after freeze:

1. Propose amendment with user impact analysis.  
2. Obtain explicit product approval.  
3. Update handbook version (e.g. v1.1).  
4. Then implement.  

Implementation must not drift ahead of the handbook.

---

*End of Zentra Product Handbook v1.0*
