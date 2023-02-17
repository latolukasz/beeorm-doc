# Data pools

It's time to learn how to set up connections to your databases in BeeORM.

Each connection pool in BeeORM requires a unique name that will be used in your code to identify the source of data. This name will be used later to access the data in your code. 
Make sure to choose a clear and descriptive name for each connection pool to avoid confusion and make your code easy to read and maintain.

## MySQL pool

To connect to a MySQL database, you can use the RegisterMySQLPool method, which takes a MySQL golang sql driver [data source name](https://github.com/go-sql-driver/mysql#dsn-data-source-name) as an argument 
and required `MySQLPoolOptions` as second argument. The method is defined as follows:

```go
registry := beeorm.NewRegistry()
//MySQL pool with name "default" with default pool options:
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db", beeorm.MySQLPoolOptions{})
//above line is equivalent to:
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db",  beeorm.MySQLPoolOptions{}, "default")
//pool with name "logs" and default pool options:
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/logs", beeorm.MySQLPoolOptions{}, "logs")
```

```yml
default:
  mysql: 
   uri: user:password@tcp(localhost:3306)/db
logs:
  mysql: 
    uri: user:password@tcp(localhost:3306)/logs
```

### MySQL Pool settings

With `MySQLPoolOptions` argument yon can configure very important [MySQL golang driver important setting](https://github.com/go-sql-driver/mysql#important-settings):

```go
poolOptions := beeorm.MySQLPoolOptions{MaxOpenConnections: 30, MaxIdleConnections: 20, ConnMaxLifetime: 3 * time.Minute}
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db", poolOptions)
```

```yml
default:
  mysql: 
   uri: user:password@tcp(localhost:3306)/db
   MaxOpenConnections: 30
   MaxIdleConnections: 20
   ConnMaxLifetime: 180 // seconds
```

### MySQL Encoding and Collation

By default, BeeORM uses the utf8mb4 character set and 0900_ai_ci collation for all tables. You can change this default behavior using the SetDefaultEncoding and SetDefaultCollate methods, as shown in the following example:

```go{2}
registry := beeorm.NewRegistry()
registry.SetDefaultEncoding("latin2")
registry.SetDefaultCollate("0900_ai_ci")
```

```yml
default:
  mysqlEncoding: latin2
  mysqlCollate: 0900_ai_ci
```

## Local cache pool

BeeORM offers a simple and extremely fast in-memory key-value cache for storing values. The cache uses the least recently used ([LRU](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU))) algorithm to manage its size and automatically evicts the least frequently used values when it reaches capacity.

To use the cache, you simply need to specify the pool name and the maximum number of cached keys:

```go
// default pool with max 100 000 values
registry.RegisterLocalCache(100000)
// pool "last_searches" with max 1000 values
registry.RegisterLocalCache(1000, "last_searches")
```

```yml
default:
  local_cache: 100000
last_searches:
  local_cache: 1000
```

::: tip
When using BeeORM's in-memory key-value cache, it's important to carefully consider the cache size. If the cache is too small, data will be evicted frequently, resulting in a low hit rate. On the other hand, if the cache is too large, it will use up a lot of memory and may contain data that is no longer needed.

To optimize the use of the cache, you can define multiple pools with different cache sizes. For example, you can keep frequently accessed data in larger pools, while less frequently used data can be stored in smaller pools. This will help to ensure that the most relevant data is always available and that the cache is used efficiently.
:::

## Redis server pool

BeeORM allows you to connect to a single Redis server using the RegisterRedis method. This method requires a connection URI in the format HOST:PORT, followed by a Redis keys namespace and the database number (0-15).

Here are some examples of how to use the RegisterRedis method:

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

```yml
default:
  redis:localhost:6379:0
users:
  redis:/var/redis.sock:1:global
products:
  198.112.22.21:6379:1?user=user&password=pass
```

## Redis sentinel pool

You can define a Redis pool connected to a [Redis Sentinel](https://redis.io/topics/sentinel) group using the RegisterRedisSentinel method. 
This method requires the master name, a list of addresses to the Sentinel daemons, and the Redis database number.

```go
// Define a pool with the name "default" pointing to Redis database #0: 
poolDefault := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
registry.RegisterRedisSentinel("master", "", 0, poolDefault)

// Define a pool with the name "products" pointing to Redis database #1:
poolProducts := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
registry.RegisterRedisSentinel("master", "global", 1, poolProducts, "products")
```

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

Redis Sentinel provides high availability for Redis by allowing multiple Sentinel instances to monitor the master and its slaves. When the master fails, one of the slaves is promoted to master automatically and the Sentinels update the client connections to use the new master. By using a Redis Sentinel pool, you can ensure that your applications can continue to access Redis even if the master fails.

::: tip
We strongly recommend using Redis Sentinel pools instead of a single server pool in your production environment.
:::

To provide Redis credentials, you can use the RegisterRedisSentinelWithCredentials method in Go:

```go
poolDefault := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
registry.RegisterRedisSentinelWithCredentials("master", "", "user", "password", 0, poolDefault)
```

```yml
default:
  sentinel:
    master:0?user=user&password=pass:
      - :26379
      - 192.156.23.11:26379
      - 192.156.23.12:26379
```

Providing Redis credentials is optional, but it can improve the security of your Redis instance by requiring clients to authenticate before they can access the data stored in Redis.

## Redis keys namespace

It is best to use a dedicated Redis server for each application for several reasons:

 * Performance: By using a separate Redis server for each application, it is easier to monitor and optimize Redis performance for that specific application.
 * Duplicate key prevention: If two applications use the same Redis instance and database number, and both applications store a key like "user:1," one application may overwrite the other's data.
 * Flushing the database: If you need to remove all keys in a Redis database, using the FLUSHDB() command will remove all keys for all applications that are using that same Redis database. By using a separate Redis server for each application, you can be sure that only the keys for that specific application will be removed.
However, sometimes it may not be possible to use a separate Redis server for each application. In these cases, it is important to ensure that different applications do not use the same Redis keys. The BeeORM framework provides a feature called keys namespace that can help with this. By defining a unique namespace name for each application in every BeeORM Redis pool, this name will be added as a prefix to all keys used in that pool, ensuring that the keys are unique.

Here is an example of how to register a Redis pool for two different applications with unique namespace names:

Application #1
```go
registry.RegisterRedis("localhost:6379", "application1", 0)
```

Application #2
```go
registry.RegisterRedis("localhost:6379", "application2", 0)
```

With this approach, each application will have its own keys namespace, preventing key collisions and ensuring that data is not overwritten.

