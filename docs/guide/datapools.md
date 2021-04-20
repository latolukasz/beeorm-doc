# Data pools

So you know now how to create `beeorm.Registry` object. Now it's time to learn how to 
configure connections to your databases. 

In BeeORM every connection pool requires a name that will be used later in your code to define
where data is located.


## MySQL pool

Connection to MySQL database can be defined using `RegisterMySQLPool` method
which requires [MySQL golang sql driver data source name](https://github.com/go-sql-driver/mysql#dsn-data-source-name).

<code-group>
<code-block title="in go">
```go
registry := beeorm.NewRegistry()
//register MySQL pool with name "default":
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db")
//above line is equivalent to:
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db", "default")
//register pool with name "logs":
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

TODO

<code-group>
<code-block title="in go">
```go
registry.RegisterLocalCache(100000)
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
