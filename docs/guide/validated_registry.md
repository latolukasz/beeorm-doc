# Validated registry

On previous pages you learned how to create `beeorm.Registry` and entities.
You should also know already how to configure database connections.
Now it's time to learn how to create the heart of BeeORM - object called `ValidatedRegistry`.

## Validating registry

```go{17}
package main

import "github.com/latolukasz/beeorm"

type UserEntity struct {
	beeorm.ORM `beeorm:"mysql=sales"`
	ID   uint
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    registry.RegisterRedis("localhost:6379", 0) 
    registry.RegisterLocalCache(100000)
    registry.RegisterEntity(&UserEntity{}) 
    
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
}  
```

::: tip
You should create `beeorm.Registry` and run `registry.Validate()` only once
in your application, when applications start. For instance if you are running
http server run above code before `http.ListenAndServe(":8080", nil)` line.
:::

You should share returned object `beeorm.ValidatedRegistry` in your application across all goroutines. 
We can think about it as a source of BeeORM configuration - connection credentials 
to all databases and entities structures. It provides only getters. You can't use
it to register more entities or connection. We can say `beeorm.Registry` is a place 
where you configure BeeORM, `beeorm.ValidatedRegistry` is a readonly, validated 
source of BeeORM settings.

## Updating validated registry

If you need change configuration you need to create new `beeorm.ValidatedRegistry`:

```go{1}
registry := validatedRegistry.GetSourceRegistry()
// change configuration:
registry.RegisterEntity(&ProductEntity{})
//overrite validated registry: 
validatedRegistry, err =  registry.Validate()
```

## Getting entities settings

If you need information about registered entities validated registry provides
useful getters. In our example we are registering two entities and one enum:

```go
package main

import "github.com/latolukasz/beeorm"

type CarEntity struct {
	beeorm.ORM
	ID    uint
	Color string `beeorm:"enum=colors;required"` 
}
type PersonEntity struct {
	beeorm.ORM
	ID    uint
	Name  string
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/my_db")
    registry.RegisterRedis("localhost:6379", 0)
    registry.RegisterLocalCache(1000, "my_storage")
    registry.RegisterEnum("colors", "red", "blue", "yellow")
    registry.RegisterEntity(&CarEntity{}, &PersonEntity{}) 
    validatedRegistry, err := registry.Validate()
}  
```

To get list of registered entities use `GetEntities` method:

<code-group>
<code-block title="code">
```go
// returns map[string]reflect.Type
for name, type := range := validatedRegistry.GetEntities() {
    fmt.Printf("%s = %s\n")
}
```
</code-block>

<code-block title="output">
```
main.CarEntity = CarEntity
main.PersonEntity = PersonEntity
```
</code-block>
</code-group>

To get details about registered enum use `GetEnum()` method:

```go
colors := validatedRegistry.GetEnum("colors")
colors.GetFields() // []string{"red", "blue", "yellow"}
colors.GetDefault() // "red"
colors.Has("blue") // true
colors.Has("orange") // false
```

## Entity schema

TODO

## Getting MySQL pools

To get list of registered MySQL pools use `GetMySQLPools()` method:

<code-group>
<code-block title="code">
```go
for code, pool := range := validatedRegistry.GetMySQLPools() {
    fmt.Printf("Pool '%s':\n", code)
    fmt.Printf("Database: %d\n", pool.GetDatabase())
    fmt.Printf("URI: %s\n", pool.GetDataSourceURI())
    fmt.Printf("Version: %d\n", pool.GetVersion()) // 5 or 8
}
```
</code-block>

<code-block title="output">
```
Pool 'default':
Database: my_db
URI: user:password@tcp(localhost:3306)/my_db
Version: 8
```
</code-block>
</code-group>

## Getting Redis pools

To get list of registered redis pools use `GetRedisPools()` method:

<code-group>
<code-block title="code">
```go
for code, pool := range := validatedRegistry.GetRedisPools() {
    fmt.Printf("Pool '%s':\n", code)
    fmt.Printf("DB: %d\n", pool.GetDB())
    fmt.Printf("Address: %s\n", pool.GetAddress())
}
```
</code-block>

<code-block title="output">
```
Pool 'default':
DB: 0
Address: localhost:6379
```
</code-block>
</code-group>

## Getting local cache pools

To get list of registered local cache pools use `GetLocalCachePools()` method:

<code-group>
<code-block title="code">
```go
for code, pool := range := validatedRegistry.GetLocalCachePools() {
    fmt.Printf("Pool '%s':\n", code)
    fmt.Printf("Limit: %d\n", pool.GetLimit())
}
```
</code-block>

<code-block title="output">
```
Pool 'my_storage':
Limit: 1000
```
</code-block>
</code-group>
