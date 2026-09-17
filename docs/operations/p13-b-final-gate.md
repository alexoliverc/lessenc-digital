# P13-B — Attribution Persistence Foundation — Final Gate

**Project:** L'Essenc Digital\
**Phase:** P13-B — Attribution Persistence Foundation\
**Date:** 2026-09-16\
**Status:** COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED\
**Branch:** `phase/p13-b-attribution-persistence`\
**Starting baseline:** `328de43bedfb400d2b5bb0cd5f2a1014375ac2d8`

## 1. P13-A baseline

Verified P13-A lifecycle:

- documentary commit: `86fb0d1d6b09c5375ac386f45baf47f61a63111b`;
- PR #21: MERGED;
- merge: `328de43bedfb400d2b5bb0cd5f2a1014375ac2d8`;
- checkpoint: `checkpoint/p13-a-architecture-freeze-r2`.

## 2. P13-B migration

Migration:

`20260917002445_p13_attribution_persistence_foundation`

SHA-256:

`FC996BFE634DACF41C98C9C989F482EC580420EAE0D74D2CE787D5C0384DB33B`

The migration creates:

1. `acquisition_journeys`;
2. `attribution_touches`;
3. `order_attributions`;
4. `analytics_events`;
5. `analytics_dispatches`.

Physical proof:

- 5 tables;
- 3 foreign keys;
- 3 unique indexes;
- OrderAttribution one-per-Order uniqueness;
- PURCHASE deduplication key uniqueness;
- dispatch `(analyticsEventId, provider, channel)` uniqueness;
- invalid FK rejection;
- rollback proof;
- zero synthetic residue.

## 3. Persistence architecture

Provider-neutral application ports:

- AttributionJourneyRepository;
- OrderAttributionRepository;
- AnalyticsEventRepository;
- AnalyticsDispatchRepository.

Prisma infrastructure adapters implement these ports.

Application code does not import infrastructure.

P13-B does not implement Google, Meta, GTM, GA4 or Mercado Pago-specific analytics behavior.

## 4. Frozen boundaries preserved

P13-B does not implement:

- First Touch / Last Touch policy;
- UTM capture;
- event producers;
- canonical PURCHASE reconciliation;
- dispatch workers;
- provider adapters;
- Admin Analytics.

The P10/P11 Outbox is not reused as a second independent subscriber.

## 5. Technical evidence

Unit regression:

- 42 files PASS;
- 435/435 tests PASS.

P13-B targeted MySQL:

- 1 file PASS;
- 6/6 tests PASS.

Full MySQL regression:

- 17 files PASS;
- 155/155 tests PASS.

Other gates:

- production build PASS;
- Prisma validate PASS;
- Prisma format stable;
- typecheck PASS;
- lint PASS;
- git diff --check PASS;
- lessenc_dev CURRENT;
- lessenc_test CURRENT.

## 6. Build environment

Build validation used a random synthetic process-only `P12_ADMIN_AUTH_SECRET`.

It was removed after the build.

No real administrative credential was created and no secret was persisted to `.env.local`.

## 7. Prettier baseline exception

Repository-wide Prettier reports 36 pre-existing unchanged files outside P13-B.

Final audit proved:

- zero P13-B overlap;
- none of those 36 files was modified by P13-B;
- P13-B scoped Prettier PASS;
- no unrelated global formatting rewrite.

## 8. Final status

P13-B implementation, technical validation, documentation and Git integration are complete.

`P13-B = COMPLETE / PASS / DOCUMENTED / INTEGRATED / CHECKPOINTED`

Canonical Git evidence:

- implementation commit: `78d20ad0c4afec4cb3a9f9c8ea11e7b880ef0663`;
- PR: #22 — MERGED;
- canonical implementation merge: `d5e829fbff763431bcb434fc5f694054247926d1`;
- checkpoint: `checkpoint/p13-b-attribution-persistence-complete`;
- checkpoint target: `d5e829fbff763431bcb434fc5f694054247926d1`;
- local implementation branch: DELETED;
- remote implementation branch: DELETED;
- deployment: NOT PERFORMED.

The P13-B checkpoint intentionally remains attached to the implementation merge and is not moved by documentation-only closeout work.

P13-C remains NOT STARTED.
