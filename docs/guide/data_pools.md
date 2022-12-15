# Data pools

It's time to learn how to set up connections to your databases in BeeORM.

Each connection pool in BeeORM requires a unique name that will be used in your code to identify the source of data. This name will be used later to access the data in your code. 
Make sure to choose a clear and descriptive name for each connection pool to avoid confusion and make your code easy to read and maintain.

## MySQL pool

To connect to a MySQL database, you can use the RegisterMySQLPool method, which takes a MySQL golang sql driver [data source name](https://github.com/go-sql-driver/mysql#dsn-data-source-name) as an argument. The method is defined as follows:

<code-group>
<code-block title="in go">
```go
registry := beeorm.NewRegistry()
//MySQL pool with name "default":
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db")
//above line is equivalent to:
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db", "default")
//pool with name "logs":
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/logs", "logs")
```
</code-block>

<code-block title="yaml">
```yml
default:
  mysql: user:password@tcp(localhost:3306)/db
logs:
  mysql: user:password@tcp(localhost:3306)/logs
```
</code-block>
</code-group>


By default, BeeORM allows up to 100 simultaneous client connections in one MySQL pool. However, this limit cannot exceed 90% of the value of 
the [max_connections](https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_max_connections) system variable in MySQL. For example, 
if max_connections is set to 50, BeeORM will set the connection limit to 45.

You can override this default behavior and specify a custom connection limit by using the limit_connections parameter in the data source URI, as shown in the following example:

```go
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db?limit_connections=10")
```

By default, BeeORM allows up to 100 simultaneous client connections in one MySQL pool. However, this limit cannot exceed 90% of the value of the max_connections system variable in MySQL. For example, if max_connections is set to 50, BeeORM will set the connection limit to 45.

You can override this default behavior and specify a custom connection limit by using the limit_connections parameter in the data source URI, as shown in the following example:

```go
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db?limit_connections=10")
```

This will set the connection limit to 10, regardless of the value of max_connections in MySQL. Keep in mind that setting the connection limit too low may result in connection errors if too many clients try to connect to the database at the same time.

::: tip
Setting the limit_connections value correctly is crucial to the performance of your application and the stability of your MySQL server. The ideal value is a balance between allowing enough connections to serve the needs of your application, while not overloading the MySQL server.

If the limit_connections value is set too low, it can slow down your application because some goroutines may need to wait for other connections to be returned to the pool after query execution. On the other hand, if the value is too high, it can put a strain on the MySQL server and cause it to become slow or unresponsive.

It is recommended to carefully monitor the performance of your application and MySQL server, and adjust the limit_connections value as needed to find the right balance. You may also need to tune other MySQL server parameters, such as max_connections, to optimize its performance.
:::

By default, BeeORM uses the utf8mb4 character set and 0900_ai_ci collation for all tables. You can change this default behavior using the SetDefaultEncoding and SetDefaultCollate methods, as shown in the following example:

<code-group>
<code-block title="in go">
```go{2}
registry := beeorm.NewRegistry()
registry.SetDefaultEncoding("latin2")
registry.SetDefaultCollate("0900_ai_ci")
```
</code-block>

<code-block title="yaml">
```yml
default:
  mysqlEncoding: latin2
  mysqlCollate: 0900_ai_ci
```
</code-block>
</code-group>

## Local cache pool

BeeORM offers a simple and extremely fast in-memory key-value cache for storing values. The cache uses the least recently used ([LRU](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU))) algorithm to manage its size and automatically evicts the least frequently used values when it reaches capacity.

To use the cache, you simply need to specify the pool name and the maximum number of cached keys:

<code-group>
<code-block title="in go">
```go
// default pool with max 100 000 values
registry.RegisterLocalCache(100000)
// pool "last_searches" with max 1000 values
registry.RegisterLocalCache(1000, "last_searches")
```
</code-block>

<code-block title="yaml">
```yml
default:
  local_cache: 100000
last_searches:
  local_cache: 1000
```
</code-block>
</code-group>

::: tip
When using BeeORM's in-memory key-value cache, it's important to carefully consider the cache size. If the cache is too small, data will be evicted frequently, resulting in a low hit rate. On the other hand, if the cache is too large, it will use up a lot of memory and may contain data that is no longer needed.

To optimize the use of the cache, you can define multiple pools with different cache sizes. For example, you can keep frequently accessed data in larger pools, while less frequently used data can be stored in smaller pools. This will help to ensure that the most relevant data is always available and that the cache is used efficiently.
:::

## Redis server pool

BeeORM allows you to connect to a single Redis server using the RegisterRedis method. This method requires a connection URI in the format HOST:PORT, followed by a Redis keys namespace and the database number (0-15).

Here are some examples of how to use the RegisterRedis method:

<code-group>
<code-block title="in go">
```go
// pool with name "default", empty keys namespace, pointing to Redis database #0:
registry.RegisterRedis("localhost:6379", "", 0)

// pool with name "users", keys namespace "global", pointing to Redis database #0:
registry.RegisterRedis("/var/redis.sock", "global", 0, "users")

// pool with name "products", empty keys namespace pointing to Redis database #1:
registry.RegisterRedis("198.112.22.21:6379", "", 1, "products")

// pool with credentials
registry.RegisterRedisWithCredentials("198.112.22.21:6379", "", "user", "password"," 1, "products")
```
</code-block>

<code-block title="yaml">
```yml
default:
  redis:localhost:6379:0
users:
  redis:/var/redis.sock:1:global
products:
  198.112.22.21:6379:1?user=user&password=pass
```
</code-block>
</code-group>

## Redis sentinel pool

You can define a Redis pool connected to a [Redis Sentinel](https://redis.io/topics/sentinel) group using the RegisterRedisSentinel method. 
This method requires the master name, a list of addresses to the Sentinel daemons, and the Redis database number.


<code-group>
<code-block title="in go">
```go
// Define a pool with the name "default" pointing to Redis database #0: 
poolDefault := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
registry.RegisterRedisSentinel("master", "", 0, poolDefault)

// Define a pool with the name "products" pointing to Redis database #1:
poolProducts := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
registry.RegisterRedisSentinel("master", "global", 1, poolProducts, "products")
```
</code-block>

<code-block title="yaml">
```yml
default:
  sentinel:
    master:0:
      - :26379
      - 192.156.23.11:26379
      - 192.156.23.12:26379
products:
  sentinel:
    my-master:1:global:
      - :26380
      - 192.156.23.24:26379
      - 192.156.23.25:26379
```
</code-block>
</code-group>

Redis Sentinel provides high availability for Redis by allowing multiple Sentinel instances to monitor the master and its slaves. When the master fails, one of the slaves is promoted to master automatically and the Sentinels update the client connections to use the new master. By using a Redis Sentinel pool, you can ensure that your applications can continue to access Redis even if the master fails.

::: tip
We strongly recommend using Redis Sentinel pools instead of a single server pool in your production environment.
:::

To provide Redis credentials, you can use the RegisterRedisSentinelWithCredentials method in Go:

<code-group>
<code-block title="in go">
```go
poolDefault := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
registry.RegisterRedisSentinelWithCredentials("master", "", "user", "password", 0, poolDefault)
```
</code-block>

<code-block title="yaml">
```yml
default:
  sentinel:
    master:0?user=user&password=pass:
      - :26379
      - 192.156.23.11:26379
      - 192.156.23.12:26379
```
</code-block>
</code-group>

Providing Redis credentials is optional, but it can improve the security of your Redis instance by requiring clients to authenticate before they can access the data stored in Redis.

## Redis keys namespace

You should always try to use dedicated redis server for your application.
There are three reasons:
 * performance. Only your application is using redis, it's easy then to monitor and optimise redis performance
 * duplicate key prevention. If two applications uses the same redis instance and DB number and
both applications store for example key "user:1" then one application overrides other application data
 * flushing database. Sometimes you need to remove all keys in redis database. Using FLushDB() will 
remove all keys from all applications that are using the same redis DB. Having one instance of redis
for one application you are sure keys are removed only for this application.

But sometimes you have no other options than using one redis for many applications.
Also when you are running tests in parallel you must be sure each test is using different
redis keys. Lucky you BeeORM provides a feature called **keys namespace**.
Simply define unique namespace name for each application in every BeeORM redis pool.
This name will be added as prefix to all keys used in this redis pool.

Application #1
```go
registry.RegisterRedis("localhost:6379", "application1", 0)
```

Application #2
```go
registry.RegisterRedis("localhost:6379", "application2", 0)
```
