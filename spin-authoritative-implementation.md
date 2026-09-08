# Spin & Win Authoritative Candidate

## Implemented contract

This isolated candidate replaces browser-selected Spin & Win eligibility and reward selection with a server-owned reservation flow. A signed-in customer has one daily spin claim represented by a dated wallet field and receives exactly three additional free tickets per sellable product unit only when the persisted order is `delivered` and its payment status is `verified` or `paid`. Cart creation, checkout opening, payment initiation, abandoned checkout, browser refresh, and localStorage do not create ticket entitlements.

The database migration adds `spin_wallets`, `spin_entitlement_events`, and `spin_plays`. Wallet rows are locked during reservation and event application. Purchase grants and reversals use unique source keys, so repeated admin status updates cannot grant the same order twice. A reversal is emitted once when a qualifying order later becomes cancelled, refunded, or wrong; if the balance cannot safely absorb the reversal, the status transaction fails instead of silently corrupting the ledger.

## HTTP contract

| Endpoint | Behavior |
|---|---|
| `GET /spin/state` | Authenticated, private/no-store wallet state with daily availability and extra-ticket count. |
| `POST /spin/reserve` | Authenticated, bounded idempotency key; atomically reserves daily entitlement first or one ticket, then returns a server-selected existing campaign reward. |
| `POST /spin/plays/:id/settle` | Authenticated, subject-scoped terminal settlement after the deterministic client animation reaches its server-selected segment. |

The browser now waits for the server reservation before choosing the visual target, animates toward the returned reward, settles on animation completion (or immediately under reduced motion), and shows a terminal truthful error if reservation, settlement, or the watchdog fails. It does not show a locally fabricated reward.

## Explicit boundaries

This is a review-only candidate. The migration has not been applied to Neon, the branch has not been merged, and production Pages has not been deployed. The existing production API writer is intentionally suspended; no customer, wallet, order, reward, or promotion data was created or modified. Production activation requires the owner to restore or promote one parity-verified mutation-capable writer, apply the migration through the normal release path, and then run a disposable synthetic end-to-end validation without customer data.

Guest entitlements, expiry, prize inventory governance, and additional admin ledger visibility require the owner’s established business and operational policy before being expanded. No browser-side database write, exposed provider key, fake fallback, or quota bypass was added.
