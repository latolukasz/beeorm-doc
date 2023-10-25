# Data pools

It's time to learn how to set up connections to your databases in BeeORM.

Each connection pool in BeeORM requires a unique name that will be used in your code to identify the source of data. This name will be used later to access the data in your code. 
Make sure to choose a clear and descriptive name for each connection pool to avoid confusion and make your code easy to read and maintain.

## MySQL pool

To connect to a MySQL database, you can use the `RegisterMySQL` method, which takes a MySQL golang sql driver [data source name](https://github.com/go-sql-driver/mysql#dsn-data-source-name) as an first argument. 
The method is defined as follows:

```go
registry := beeorm.NewRegistry()

//MySQL pool with name "default" with default options:
registry.RegisterMySQL("user:password@tcp(localhost:3306)/db", beeorm.DefaultPoolCode, nil)

//pool with name "logs" and custom options:
registry.RegisterMySQL("user:password@tcp(localhost:3306)/logs", "logs", *beeorm.MySQLOptions{MaxOpenConnections: 100})
```

```yml
default:
  mysql: 
   uri: user:password@tcp(localhost:3306)/db
logs:
  mysql: 
    uri: user:password@tcp(localhost:3306)/logs
    maxOpenConnections: 100
```

### MySQL options

With `MySQLOptions` argument yon can configure very important [MySQL golang driver important setting](https://github.com/go-sql-driver/mysql#important-settings):

```go
options := beeorm.MySQLPoolOptions{
    MaxOpenConnections: 30, 
    MaxIdleConnections: 20, 
    ConnMaxLifetime: 3 * time.Minute,
    DefaultEncoding: "greek", // utf8mb4 by default
    DefaultCollate: "greek_general_ci", // 0900_ai_ci by default
    IgnoredTables: []string{"table1", "table2"}}
    
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db", "global", options)
```

```yml
global:
  mysql: 
   uri: user:password@tcp(localhost:3306)/db
   maxOpenConnections: 30
   maxIdleConnections: 20
   connMaxLifetime: 180 // seconds
   defaultEncoding: greek
   defaultCollate: greek_general_ci
   ignoredTables:
     - table1
     - table2 
```

::: tip
You can configure MySQL connection settings, including parameters like `maxOpenConnections` and `maxIdleConnections`, 
but it's advisable to retain the default values (empty). BeeORM can automatically determine and set the optimal settings based on your MySQL database configuration.
:::

### Ignored tables


BeeORM's default behavior is to attempt to [remove all MySQL tables](/guide/schema_update.html#schema-update)  that are not explicitly defined in your application code. 
However, you have the option to retain these tables by specifying their names in the `IgnoredTables` option.


## Local cache pool

BeeORM offers a simple and extremely fast in-memory key-value cache for storing values. The cache uses the least recently used ([LRU](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU))) algorithm to manage its size and automatically evicts the least frequently used values when it reaches capacity.

To use the cache, you simply need to specify the pool name and the maximum number of cached keys:

```go
// default pool with max 100 000 values
registry.RegisterLocalCache(beeorm.DefaultPoolCode, 100000)
// pool "last_searches" with no limits
registry.RegisterLocalCache(beeorm.DefaultPoolCode, 0)
```

```yml
default:
  local_cache: 100000
last_searches:
  local_cache: 0
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

