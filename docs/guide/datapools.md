# Data pools

Every ORM needs connection to database. In BeeORM you can define connection by registering
data pools in `beeorm.Registy`. 

Every data pool has a name that we call `pool name`.
All methods used to register data pool accepts optional last argument that defines data pool name.
If not provided pool is registered with name `default`.


## MySQL data pool

Connection to MySQL database can be defined using `RegisterMySQLPool` method
which requires [MySQL golang sql driver data source name](https://github.com/go-sql-driver/mysql#dsn-data-source-name).

<code-group>
<code-block title="in go">
```go
registry := beeorm.NewRegistry()
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db")
// above line is equivalent to  
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db", "default")

registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/logs", "logs")
```
</code-block>

<code-block title="yaml">
```yml
default:
  mysql: user:password@tcp(localhost:3306)/db
logs:
  mysql: user:password@tcp(localhost:3306)/logs?limit_connections=10
```
</code-block>
</code-group>

By default BeeORM allows to open 100 maximum permitted number of simultaneous 
client connections in one MySQL pool.
But no more than 90% of current [MySQL max_connections system variable](https://dev.mysql.com/doc/refman/8.0/en/server-system-variables.html#sysvar_max_connections).
For example if your MySQL server has `max_connections = 50` BeeORM will set limit to 45. But you can define your own
limit of connection using special parameter `limit_connections` in data source URI, for example:

```go
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db?limit_connections=10")
```

::: tip
Setting correct`limit_connections` value is very important. You should try to find a right balance.
Setting low value will protect you MySQL server from too many connections that slows down server and 
even can block new connections. But at the same time too low value will slow down your application 
because some goroutines need to wait for another connections to be returned 
to pool after query execution.
:::

By default all tables use character set `utf8mb4`. You can change that with `SetDefaultEncoding` method:

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

## Local in-memory cache

TODO
