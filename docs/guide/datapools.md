# Data pools


TODO

## MySQL database

Connection to MySQL database can be defined using `RegisterMySQLPool` method
which requires [MySQL golang sql driver data source name](https://github.com/go-sql-driver/mysql#dsn-data-source-name)
followed by optional pool name.

<code-group>
<code-block title="manual">
```go
registry := beeorm.NewRegistry()
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db")
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

::: tip
By default BeeORM allows to open up to 90% of
:::


## Local in-memory cache

TODO
