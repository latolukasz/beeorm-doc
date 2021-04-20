# Data pools

Now it's time to learn how to configure connections to your databases. 

In BeeORM every connection pool requires a name that will be used later in your code to define
where data is located.

## MySQL pool

Connection to MySQL database can be defined using `RegisterMySQLPool` method
which requires [MySQL golang sql driver data source name](https://github.com/go-sql-driver/mysql#dsn-data-source-name).

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

By default BeeORM allows to open 100 permitted number of simultaneous 
client connections in one MySQL pool.
But no more than 90% of current [MySQL max_connections system variable](https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_max_connections).
For example if your MySQL server has `max_connections = 50` BeeORM will set limit to 45. But you can define your own
limit of connection using special parameter `limit_connections` in data source URI, for example:

```go
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db?limit_connections=10")
```

::: tip
Setting correct`limit_connections` value is very important. You should try to find a right balance.
Low value protects your MySQL server from too many connections which may slow down MySQL server. 
At the same time too low value will slow down your application 
because some goroutines need to wait for another connections to be returned 
to pool after query execution.
:::

By default all tables use character set `utf8mb4`. 
You can change it with `SetDefaultEncoding` method:

<code-group>
<code-block title="in go">
```go{2}
registry := beeorm.NewRegistry()
registry.SetDefaultEncoding("latin2")
```
</code-block>

<code-block title="yaml">
```yml
default:
  mysqlEncoding: latin2
```
</code-block>
</code-group>

## Local cache pool

BeeORM provides simple and extremely fast in-memory key-value cache. 
Values are stored in local map using [LRU](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_recently_used_(LRU))
algorithm to evict least recently used value in case cache is full. 

Simply define pool name and cache size (maximum number of cached keys):

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
Be sure that cache size is not too small (data is evicted very often, low hit rate) 
or too big (cache is using lots of memory, most of data is not used anymore).
Remember you can also define many pools with different cache size to optimise evictions.
Keep popular data in big pools and other values in small pools.
:::

## Redis server pool

Connection to single Redis server can be defined using `RegisterRedis` method
which requires connection URI in format `HOST:PORT` followed by reds database number (0-15).

<code-group>
<code-block title="in go">
```go
//pool with name "default" and redis database #0: 
registry.RegisterRedis("localhost:6379", 0)
//pool with name "products" and redis database #1: 
registry.RegisterRedis("198.112.22.21:6379", 1, "products")
```
</code-block>

<code-block title="yaml">
```yml
default:
  redis:localhost:6379:0
products:
  198.112.22.21:6379:1
```
</code-block>
</code-group>

## Redis sentinel pool

TODO

<code-group>
<code-block title="in go">
```go
//pool with name "default" and redis database #0: 
pool1 := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
registry.RegisterRedisSentinel("master", 0, pool1)
//pool with name "products" and redis database #1: 
pool2 := []string{":26379", "192.23.12.11:26379", "192.23.12.12:26379"}
registry.RegisterRedisSentinel("master", 1, pool2, "products") 
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
    my-master:1:
      - :26380
      - 192.156.23.24:26379
      - 192.156.23.25:26379
```
</code-block>
</code-group>
