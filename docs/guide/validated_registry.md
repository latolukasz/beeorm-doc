# Validated registry

On previous pages you learned how to create `beeorm.Registry` and entities.
You should also know already how to configure database connections.
Now it's time to learn how to create the heart of BeeORM - object called `ValidatedRegistry`.

## Validating registry

```go{17}
package main

import "github.com/latolukasz/beeorm"

type UserEntity struct {
	beeorm.ORM `orm:"mysql=sales"`
	ID   uint
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users")
    registry.RegisterRedis("localhost:6379", 0) 
    registry.RegisterLocalCache(100000)
    registry.RegisterEntity(&UserEntity{}) 
    
    validatedRegistry, deferF, err := registry.Validate()
    if err != nil {
        panic(err)
    }
    defer deferF()
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
validatedRegistry, deferF, err = registry.Validate()
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
	Color string `orm:"enum=colors;required"` 
	Owner *PersonEntity
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
    validatedRegistry, deferF, err := registry.Validate()
    if err != nil {
      panic(err)
    }
    defer deferF()
}  
```

To get list of registered entities use `GetEntities` method:

<code-group>
<code-block title="code">
```go
// returns map[string]reflect.Type
for name, type := range := validatedRegistry.GetEntities() {
    fmt.Printf("%s = %s\n", name, type.Name())
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

## Getting enum settings

To get details about registered enum use `GetEnum()` method:

```go
colors := validatedRegistry.GetEnum("colors")
colors.GetFields() // []string{"red", "blue", "yellow"}
colors.GetDefault() // "red"
colors.Has("blue") // true
colors.Has("orange") // false
colors.Index("blue") // 2 (start with 1)
colors.Index("orange") // 0
```

## Entity schema

Validated registry holds information about every registered entity in
object `beeorm.TableSchema`. You have two options to get entity table schema:

<code-group>
<code-block title="using name">
```go
// remember to use full entity name including package name
tableSchema := validatedRegistry.GetTableSchema("main.CarEntity")
```
</code-block>

<code-block title="using entity">
```go
var carEntity *CarEntity
tableSchema := validatedRegistry.GetTableSchemaForEntity(carEntity)
```
</code-block>
</code-group>

This method returns `nil` if entity is not registered in `beeorm.Registry`.

Once you have `beeorm.TableSchema` object, you can get useful data about entity:

```go
tableSchema := validatedRegistry.GetTableSchema("main.CarEntity")
tableSchema.GetTableName() // "CarEntity"
tableSchema.GetType() // reftect.Type of CarEntity
tableSchema.GetColumns() // []string{"ID", "Color", "Owner"}
tableSchema.GetReferences() // []string{"Owner"} // one-one and one-many field names
```

`beeorm.TableSchema` provides special method `GetUsage()` that shows where this entity
is used as one-one or one-many reference. It returns ` map[reflect.Type][]string` where
key is type of parent entity and value is a slice of field names where this entity is used.
Hard to understand? Hope below example helps you understand it better:

```go{2}
tableSchema := validatedRegistry.GetTableSchema("main.PersonEntity")
for type, fields := range tableSchema.GetUsage(validatedRegistry) {
    fmt.Println(type.Name()) // "CarEntity"
    fmt.Printf("%v", fields) // ["Owner"]
}
```

With `NewEntity()` method you can create new instance of entity:

```go{2}
tableSchema := validatedRegistry.GetTableSchema("main.PersonEntity")
carEntity := tableSchema.NewEntity().(*CarEntity)
```

You can also get `beeorm.TableSchema` from entity cache key.
For example if you see query in redis:

```GET f3b2d:123```

you can get table schema with:

```go
tableSchema := validatedRegistry.GetTableSchemaForCachePrefix("f3b2d")
```


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
