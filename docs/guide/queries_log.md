# Queries Log

You can log all MySQL, Redis, and local cache queries by registering a logger using the `engine.RegisterQueryLogger()` method:

```go{7}
type MyLogger struct{}

func (l *MyLogger) Handle(log map[string]interface{}) {
	fmt.Printf("QUERY %s in %s", log["query"], log["source"])
}

engine.RegisterQueryLogger(&MyLogger{}, true, true, true)
```

This method requires an implementation of the `beeorm.LogHandler` interface:

```go
type LogHandler interface {
	Handle(log map[string]interface{})
}
```

The `log` map attribute provides the following fields:

| key        | value type         | description  |
| :------------- |:-------------| :-----|
| source      | string  | `mysql` or `redis` or `local_cache`  |
| pool      | string  | [data pool](/guide/data_pools.html#mysql-pool) name  |
| query      | string  | full query  |
| operation      | string  | short label of query  |
| microseconds      | int64  | query time  |
| started      | int64  | Unix timestamp (nanoseconds) when the query started  |
| finished      | int64  | Unix timestamp (nanoseconds) when the query finished  |
| error      | string  | query error, if the query returned an error  |

Queries to the [local cache](/guide/local_cache.html) are very fast, which is why the query log for this cache layer does not provide the microseconds, started, and finished keys.

You can specify which queries should be logged by setting the respective boolean arguments in the `engine.RegisterQueryLogger()` method:

```go
// only queries to MySQL
engine.RegisterQueryLogger(&MyLogger{}, true, false, false)
// only queries to redis
engine.RegisterQueryLogger(&MyLogger{}, false, true, false)
// only queries to local cache
engine.RegisterQueryLogger(&MyLogger{}, false, false, true)
```

## Queries Debug

BeeORM provides a special query logger that prints a human-friendly output to the console (os.Stderr) that is useful when debugging your queries. You can enable it with the `engine.EnableQueryDebug()` or `engine.EnableQueryDebugCustom()` method:

```go{2,4,6}
// all queries
engine.EnableQueryDebug()
// only queries to MySQL
engine.EnableQueryDebugCustom(true, false, false)
// only queries to MySQL and Redis
engine.EnableQueryDebugCustom(true, true, false)
```

Here is an example of how the debug output looks:

![An image](/query_debug_1.png)

Every query is displayed in two lines. The first line (with a white background) contains the following fields:

 * BeeORM logo
 * query source (MySQL, redis, local cache)
 * data pool name
 * operation
 * query time in milliseconds

The length of the white bar is correlated with the query time. If a query takes more time, the bar is longer and more red. This helps you to identify slow queries. The full query is displayed on the second line.
