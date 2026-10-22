# Ideas and ranking

The 20 ideas we considered for UNLOCKED, how they ranked, and why we picked **Two-Person Rule**.
None copy Tide's 12 example ideas; where one is close, it's noted. An interactive demo of the top 8
is at https://claude.ai/artifact/Jr9jNGjKR1L9KsNNCzGEca (private until shared).

Scores are our estimate against the five weighted judging criteria (out of 100). Rank also accounts
for build risk, because a half-working ambitious idea loses to a polished simple one.

## Ranking

| Rank | Idea | One line | Score | Build risk |
|---|---|---|---|---|
| 1 | **Sealed** | Speak-up channel: the person you report can't read the report, even if they run IT | 91 | Low |
| 2 | **Dead Drop** | Newsroom tip line the paper's owner can't read | 91 | Low |
| 3 | **Two-Person Rule** ✅ | An AI proposes plant actions; two operators must approve | 93 | Medium |
| 4 | **Safe Harbour** | Evidence locker for family-violence survivors | 88 | Low–medium |
| 5 | **Refuge** | Asylum testimony only the assigned caseworker can read | 88 | Low |
| 6 | **Leashed AI** | Personal AI assistant that can't widen its own access | 93 | High |
| 7 | **Co-Parent** | Separated parents share a child's records; no one-sided changes | 85 | Medium |
| 8 | **Body Cam Custody** | Police footage opens only with a supervisor and a civilian overseer | 84 | Medium |
| 9 | **Legacy Vault** | Digital inheritance released when 2 of 3 executors confirm | 83 | Low |
| 10 | **Strength in Numbers** | Petition names stay secret until it reaches its target | 81 | Medium |
| 11 | **Sealed Tender** | Procurement bids no insider can peek at (close to "Supplier Evidence Exchange") | 80 | Low–medium |
| 12 | **Gene Vault** | DNA data that can't be sold with the company (close to "Research Consent Vault") | 80 | Low–medium |
| 13 | **Origins** | Adoption records opened only when both sides agree | 80 | Low |
| 14 | **AI Flags, Humans Decide** | AI moderator flags; two reviewers must approve a ban | 80 | Medium |
| 15 | **Break Glass** | Emergency medical access needing two responders (close to "Care Passport") | 79 | Medium |
| 16 | **Guest Key** | Smart lock the vendor's cloud can't open | 79 | Low |
| 17 | **Blind Trial** | Clinical-trial unblinding the sponsor can't trigger | 77 | Low–medium |
| 18 | **Camera Committee** | Apartment CCTV the building manager can't browse | 76 | Low |
| 19 | **Special Consideration** | Extension requests without exposing the diagnosis (close to "Care Passport") | 71 | Low |
| 20 | **Exam Vault** | Exam papers that can't leak early | 67 | Low |

## Why Two-Person Rule

- **Originality (25%):** it takes on the challenge's own question, "how much access should AI have?",
  in a domain no example idea covers.
- **Trust insight (20%):** high-stakes sites keep AI away from controls because one credential or
  one admin could cause a disaster, and prompt injection can't be fully prevented.
- **Value (20%):** speed with safety. The AI drafts the action in seconds; two humans confirm in a
  minute.
- **Why TideCloak (20%):** operators can't be forged, nobody becomes an operator without quorum, and
  there's no key on the server to steal. With ordinary login, one admin could grant themselves the role.
- **Risk:** medium. The core uses standard TideCloak features; the network-signed version (Forseti)
  is a time-boxed stretch. See [`PLAN.md`](PLAN.md) and [`TIDECLOAK-NOTES.md`](TIDECLOAK-NOTES.md).

## Fallback

If the build hits a wall early, **Sealed** (rank 1) uses only role-locked encryption and quorum on
role changes, which are the lowest-risk TideCloak features, and reuses the same realm setup.

## Idea details

Short descriptions of the top 8, with the demo moment for each.

- **Sealed.** Employees report misconduct; only investigators can decrypt. The accused CTO is a system
  admin, sees ciphertext, and his attempt to make himself an investigator stalls in quorum.
- **Dead Drop.** Tips are sealed to the story team. The media owner sees ciphertext, and editors deny
  his request to join the story team.
- **Two-Person Rule.** Sentinel proposes a shutdown; a prompt-injected execute is refused; the plant
  admin's self-promotion stalls; two operators approve and the pumps stop.
- **Safe Harbour.** Evidence is encrypted on the survivor's phone. The abuser controlling the family
  account sees nothing; a lawyer gets access after the survivor and caseworker approve.
- **Refuge.** Testimony is sealed to the caseworker. IT admins and a breached database copy see only
  ciphertext; reassigning the case needs both case managers.
- **Leashed AI.** The assistant has the Calendar role only. A phishing email tells it to read the
  medical file: refused. Medical access needs the user plus a trusted contact.
- **Co-Parent.** Adding a new pickup person needs both parents. The school sees the pickup list but
  not the medical file.
- **Body Cam Custody.** Footage is encrypted at upload. Viewing needs a police supervisor and a
  civilian oversight member; a superintendent can't grant himself access.
