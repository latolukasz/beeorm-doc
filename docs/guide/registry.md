# Registry

## MySQL database

TODO

<code-group>
<code-block title="GO">
```go
registry := &orm.Registry{}
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db")
```
</code-block>

<code-block title="YAML">
```yml
default:
  mysql: user:password@tcp(localhost:3306)/db
```
</code-block>
</code-group>

## Local in-memory cache

TODO
