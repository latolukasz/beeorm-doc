---
home: true
heroText:
siteTitle:
heroImage: logo2.svg
heroImageDark: logoDark2.svg
tagline: Code-generation-based Go ORM for MySQL and Redis with ClickHouse queries, NATS JetStream entity change events, background tasks and a transactional outbox — type-safe Providers, dirty tracking and two-tier caching
actionText: Quick Start →
actionLink: /guide/
footer: MIT Licensed | Copyright © 2024-present Łukasz Lato
actions:
- text: Quick Start →
  link: /guide/
  type: primary
features:
- title: Code Generation
  details: Define entities as plain Go structs with orm tags and run Generate() to emit a typed Provider, Entity, getters and setters with dirty tracking, and typed field descriptors — no reflection at runtime.
- title: MySQL Schema & Transactions
  details: GetAlters() diffs your entities against the live schema and returns one Alter per change, each classified as safe or destructive; ctx.Transaction() gives lazy per-pool BEGIN, nesting and post-commit work.
- title: Two-Tier Caching + Redis Search
  details: A per-Context identity map plus a Redis row cache that writes invalidate and never write back, cached unique index lookups, and FT.SEARCH indexes maintained automatically on every Save.
- title: ClickHouse
  details: Query-only ClickHouse pools for analytics, plus a table builder that reconciles ClickHouse schema with GetClickhouseAlters() alongside your MySQL alters.
- title: NATS Entity Events & Consumers
  details: Tag an entity orm:"cdc" and every committed insert, update or delete is published once to JetStream; declare a ConsumerDef and get a generated, typed consumer with per-entity handlers and replay.
- title: Tasks & Outbox
  details: Dispatch plain task structs through JetStream queues with a retry ladder and a JobRunEntity audit row, and tag entities orm:"outbox" so the change event is written in the same transaction as the row.
---
