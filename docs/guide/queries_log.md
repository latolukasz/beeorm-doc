# Queries log

You can log all MySQL, Redis and local cache queries.
Simply register logger with `engine.RegisterQueryLogger()`:

```go{7}
type MyLogger struct{}

func (l *MyLogger) Handle(log map[string]interface{}) {
	fmt.Printf("QUERY %s in %s", log["query"], log["source"])
}

engine.RegisterQueryLogger(&MyLogger{}, true, true, true)
```

This method requires instance of `beeorm.LogHandler` interface:

```go
type LogHandler interface {
	Handle(log map[string]interface{})
}
```

`log` map attribute provides these fields:

| key        | value type         | description  |
| :------------- |:-------------| :-----|
| source      | string  | `mysql` or `redis` or `local_cache`  |
| pool      | string  | [data pool](/guide/data_pools.html#mysql-pool) name  |
| query      | string  | full query  |
| operation      | string  | short label of query  |
| microseconds      | int64  | query time  |
| started      | int64  | unix timestamp (nanoseconds) when query started  |
| finished      | int64  | unix timestamp (nanoseconds) when query finished  |
| error      | string  | query error if query returned error  |

Queries to [local cache](/guide/local_cache.html) are very fast, that's why
query log for this cache layer doesn't provide `microseconds`, `started` and `finished`
keys.

You can decide which queries should be logged:

```go
// only queries to MySQL
engine.RegisterQueryLogger(&MyLogger{}, true, false, false)
// only queries to redis
engine.RegisterQueryLogger(&MyLogger{}, false, true, false)
// only queries to local cache
engine.RegisterQueryLogger(&MyLogger{}, false, false, true)
```

## Queries debug

BeeORM provides special query logger that prints human friendly output
to console (`os.Stderr`) that is very useful when you are debugging your queries.
You can enable it with `engine.EnableQueryDebug()` or `engine.EnableQueryDebugCustom()` method:

```go{2,4,6}
// all queries
engine.EnableQueryDebug()
// only queries to MySQL
engine.EnableQueryDebugCustom(true, false, false)
// only queries to MySQL and Redis
engine.EnableQueryDebugCustom(true, true, false)
```

Below you can see example how debug will look like:

![An image](/query_debug_1.png)

Every query is displayed in two lines.
First one (with white background) contains these fields:

 * BeeORM logo
 * query source (MySQL, redis, local cache)
 * data pool name
 * operation
 * query time in milliseconds

White bar length has correlation with query time. If query takes more time
this bar is longer and more red. It helps you to spot queries that are slow.
In the second line, full query is displayed.
