# Company Documents — access model & build spec

Notes for the *build later* step. Nothing here is wired up yet — these three
documents are plain markdown drafts, no routes, roles, or guards exist.

## Intended home

A gated area, described by the owner as `portal.ronation.live/legal/company/documents`.

Caveat carried over from planning: **`legal` is a reserved partner slug**
(`src/lib/partners/registry.ts`), and `portal.ronation.live/legal/...` is not a
route today. The portal host serves `/shasha`, `/docs`, `/files`, `/<partner>`,
etc. So the real home is most likely a **new gated section modelled on the
existing `/docs` reader area** (`src/app/docs/(reader)/`), reachable at something
like `/company-documents` on the portal host — final path TBD with the owner.

## Who can read it

Decided: **Partner** and **Potential partner** are a *brand-new, separate,
lightweight identity* — NOT the existing subdomain/portal partner tenants
(Sleep Token etc.), and not RNL Roblox ranks.

| Role                | Can read the 3 documents | Can view their own credit notes |
| ------------------- | :----------------------: | :-----------------------------: |
| RNL Managers        |           yes            |          (all, existing)        |
| Partner             |           yes            |               yes               |
| Potential partner   |           yes            |               no                |

- **Managers** = RNL managers, a Roblox group rank (see `src/lib/company.ts`,
  `env.company.minRank`). Confirm the exact rank that counts as "manager".
- **Partner** = a party we have a live agreement with. Reads the documents **and**
  can view **their own** credit notes.
- **Potential partner** = a party we're in talks with. Reads the documents only.

Credit notes already exist as `DocumentKind.CREDIT_NOTE` in the accounting system
(`src/lib/accounting/kinds.ts`, documents in `/company/accounting`). "A partner
views their credit notes" = scoping those existing documents to the partner's
identity. This needs a link between the new Partner identity and their accounting
documents — a per-partner scope/id — which does not exist yet.

## Build sketch (for the next session)

1. Model the new external identity (Partner / Potential partner) and how they sign
   in / are granted access. Options to weigh: a small DB table keyed to a Roblox
   account, vs. an invite/grant like `PartnerMember`. This is the main open design
   question.
2. Add the gated route + a guard composing `manager OR partner OR potential-partner`,
   modelled on `requireDocsReader()` (`src/lib/docs-guard.ts`).
3. Render the three markdown files (react-markdown + remark-gfm are already deps).
4. For partners only: a credit-notes view scoped to their identity.
5. Sort out the reserved-slug / path question before touching the portal host
   routing (`src/middleware.ts`, `PORTAL_PATHS`).

## Decisions locked into the wording

- **Post-tax profit** = Sale Price less **Roblox Tax of 30%** (i.e. 70% of the
  Sale Price). RNL keeps **10% of that post-tax profit**; the Partner keeps 90%.
  Worked example baked into each money document: R$100 → R$30 tax → R$70 post-tax
  → RNL R$7, Partner R$63.
- **Merchandise** permission is **non-exclusive** (Partner may sell elsewhere).
- **Ticketing & packages** is **exclusive** — sold only through RNL's official
  channels while the agreement is in force ("all … under official channels").
- **Payout currency** defaults to **Robux (R$)**, matching the accounting system,
  with "or another method the parties agree in writing" to cover DevEx.

## Still worth a look

- The 30% tax rate is written as "at the date of this Agreement", with a clause
  that recalculates post-tax profit if Roblox changes the rate — so the number
  ages gracefully. Confirm that framing is what you want.
- Payment method beyond Robux (DevEx specifics) is left open in the documents by
  design; tighten it if you have a fixed process.
