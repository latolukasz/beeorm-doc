# Data pools


TODO

## MySQL database

TODO

<code-group>
<code-block title="manual">
```go
registry := &orm.Registry{}
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db")
```
</code-block>

<code-block title="yaml">
```yml
default:
  mysql: user:password@tcp(localhost:3306)/db
```
</code-block>
</code-group>

## Local in-memory cache

TODO
