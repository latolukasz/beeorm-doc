# Transactions

`ctx.Save` with several entities already commits them together. When the writes are spread over several calls, or interleaved with reads and raw SQL, wrap them in `ctx.Transaction`.

```go
Transaction(fn func(tx Context) error) error
InTransaction() bool
DB(pool string) DBBase
```

## Basic usage

```go
err := ctx.Transaction(func(tx fluxaorm.Context) error {
    category := entities.CategoryEntityProvider.New(tx)
    category.SetCode("books").SetName("Books")
    if err := tx.Save(category); err != nil {
        return err
    }

    user, found, err := entities.UserEntityProvider.GetByID(tx, userID)
    if err != nil {
        return err
    }
    if !found {
        return errors.New("user not found")
    }
    user.SetCategory(category.GetID())
    return tx.Save(user)
})
```

`fn` returning `nil` commits; returning an error or panicking rolls back (the panic is re-raised after the rollback). The `tx` passed to `fn` is the **same** `Context` you called `Transaction` on — not a clone — so entities loaded before the call can be saved inside it, the [context cache](/guide/context_cache.html) is shared, and `ctx.InTransaction()` is `true` for the duration of `fn`.

## What joins the transaction

- **`Save`, `Delete`, `ForceDelete`** on the context. Their SQL statements execute immediately through the transaction, so the transaction sees its own writes. Their post-commit work (see below) is deferred until `COMMIT`.
- **Reads through the generated providers** (`GetByID`, `GetByIDs`, `Search*`, `Count`) and **`Reload`** — they all use `ctx.DB(pool)`.
- **`ctx.DB(pool)`** returns the open `DBTransaction` for that pool, so raw SQL executed through it (see [MySQL Queries](/guide/mysql_queries.html)) is part of the transaction.
- **Nested `ctx.Transaction` calls** join the outer transaction (see below).

`BEGIN` is lazy and per pool: the transaction for a MySQL pool is opened by the first write to that pool. A `fn` that only reads never opens one.

::: warning Lazy BEGIN and reads
Before the first `Save` on a pool, `ctx.DB(pool)` still returns the plain pool and reads run in autocommit mode. If you need `SELECT ... FOR UPDATE` semantics, obtain the locks with raw SQL after the first write, or use a [distributed lock](/guide/distributed_lock.html).
:::

When writes hit several pools, each pool gets its own transaction and they are committed in the order they were opened. If a later `COMMIT` fails after an earlier one succeeded, the error is `commit failed on pool "<pool>" after pools [<pools>] already committed: <cause>` — there is no cross-pool atomicity.

## What does not join the transaction

- `ctx.Engine().DB(pool)` is always the pool itself (needed for DDL, the locker and `GetDBClient`).
- `ctx.Clone()` / `ctx.CloneWithContext(...)` return a new `Context` with no transaction and an empty context cache.
- Direct Redis commands (`ctx.Engine().Redis(pool).Set(...)` and friends) run immediately. Pipelines obtained from `ctx.RedisPipeLine(pool)` that have not been executed yet are executed by the post-commit step of the next `Save` and discarded on rollback.
- `fluxaorm.DispatchTask` and `fluxaorm.RedispatchJobRun` refuse to run inside a transaction and return `fluxaorm.ErrDispatchInTransaction`; dispatch after the transaction commits, or use the [outbox](/guide/outbox.html). See [Tasks](/guide/tasks.html).

## Cache behaviour inside a transaction

While `ctx.InTransaction()` is true the generated code **bypasses the Redis row cache and the cached unique index keys entirely** — no reads and no fills. A transaction must see its own uncommitted rows, and a cache filled from a pre-commit snapshot would go stale the moment the transaction rolled back. Reads inside a transaction therefore go: context cache, then MySQL through the transaction. The context cache is still used, since it lives on the same `Context`.

Cache invalidation keys registered by the writes are deleted twice: once when `Save` runs the statement, and again after `COMMIT`. On rollback the pending keys are discarded together with the pending Redis pipelines. See [Redis Cache](/guide/redis_cache.html).

## Nested transactions

A `Transaction` call while one is already open does not open a second one; `fn` simply runs inside the outer transaction. If the nested `fn` returns an error the outer transaction is marked **rollback-only**: it can no longer commit, even if the caller swallowed the inner error, and the outermost `Transaction` returns `fluxaorm.ErrTxRollbackOnly` (`transaction is rollback-only`).

```go
err := ctx.Transaction(func(tx fluxaorm.Context) error {
    _ = tx.Transaction(func(tx fluxaorm.Context) error {
        return errors.New("inner failure") // swallowed by the caller
    })
    return nil
})
// errors.Is(err, fluxaorm.ErrTxRollbackOnly) == true, nothing was committed
```

Within an open transaction an entity that has already been saved and has no new changes is skipped by a second `Save`, so helper functions may call `tx.Save(e)` defensively without re-issuing inserts.

## Rollback

On an error or a panic the SQL transactions of every pool are rolled back, the pending database and Redis pipelines are discarded and the pending cache invalidations are dropped. The Go objects are **not** reverted: a new entity is still new, a modified entity still holds its changes, so you may fix the cause and save them again on the same context.

## Post-commit work and `PostCommitError`

Some of what `Save` does must only become visible once the rows are durable. Inside a transaction these steps are queued and run right after `COMMIT`, in this order:

1. the second deletion of the invalidated Redis row-cache and unique-index keys;
2. the Redis pipelines queued by the writes (Redis Search hashes);
3. publishing [entity events](/guide/entity_events.html) and marking [outbox](/guide/outbox.html) rows dispatched;
4. the `After*` [lifecycle handlers](/guide/lifecycle_callbacks.html);
5. evicting deleted entities from the context cache and marking every saved entity clean.

If any of these fails, the rows are already committed. `Transaction` (and `Save` outside a transaction) then returns a `*fluxaorm.PostCommitError`:

```go
type PostCommitError struct {
    Err error
}

func (e *PostCommitError) Error() string // "post-commit failure (database changes are committed): " + e.Err.Error()
func (e *PostCommitError) Unwrap() error
```

Handle it explicitly — retrying the whole operation would apply the writes twice:

```go
err := ctx.Transaction(func(tx fluxaorm.Context) error {
    return tx.Save(user)
})
var postCommit *fluxaorm.PostCommitError
if errors.As(err, &postCommit) {
    // The rows are durable. Log postCommit.Err, and repair the side effect
    // (for example clear the entity's Redis cache) instead of retrying the write.
    return nil
}
if err != nil {
    return err // nothing was written
}
```

`errors.Is(err, target)` still works through `PostCommitError`, so a sentinel error returned by an `After*` handler can be matched directly.
