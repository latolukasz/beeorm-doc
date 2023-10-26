# Engine

In previous sections, you learned how to create a `Registry` object and register entities with it. You should also know how to configure database connections by now. In this section, you will learn about the `Engine`, which is the heart of BeeORM.

## Validating the Registry

To create an Engine, you first need to create a `Registry` object and register the necessary database connections and entities with it. Then, you can call the `registry.Validate()` method to create a `Engine` object. Here is an example:

```go{16}
package main

import "github.com/latolukasz/beeorm/v3"

type UserEntity struct {
	ID   uint64
	Name string `orm:"required"`
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQL("user:password@tcp(localhost:3306)/db", beeorm.DefaultPoolCode, nil)
    registry.RegisterRedis("localhost:6379", 0, beeorm.DefaultPoolCode, nil)
    registry.RegisterEntity(&UserEntity{}) 
    
    engine, err := registry.Validate()
    if err != nil {
        panic(err)
    }
}  
```

::: tip
It is recommended to create the `Registry` object and call `registry.Validate()` only once in your application, when it starts. For example, if you are running an HTTP server, you should run the above code before the `http.ListenAndServe(":8080", nil)` line.
:::

The `Engine` object should be shared across all goroutines in your application. It serves as a read-only, validated source of BeeORM settings, including connection credentials and entity structures. You cannot use it to register more entities or connections - this should be done using a `Registry` object. In other words, the `Registry` is where you configure BeeORM, while the `Engine` is a read-only source of the resulting configuration.


## Engine Registry

The `Engine` object provides method `Registry()` for accessing information about registered entities and data pools:

```go{22,27,32,37}
package main

import "github.com/latolukasz/beeorm/v3"

type CarEntity struct {
	ID    uint64
	Color string
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQL("user:password@tcp(localhost:3306)/db", beeorm.DefaultPoolCode, nil)
    registry.RegisterRedis("localhost:6379", 0, beeorm.DefaultPoolCode, nil)
    registry.RegisterLocalCache(beeorm.DefaultPoolCode, 0)
    registry.RegisterEntity(&CarEntity{}) 
    engine, err := registry.Validate()
    if err != nil {
      panic(err)
    }
    
    // Returns all registered entities
    for name, type := range := engine.Registry().GetEntities() {
        fmt.Printf("%s = %s\n", name, type.Name())
    }
    
    // Returns all MySQL pools
     for code, db := range := engine.Registry().DBPools() {
        fmt.Printf("%s = %s\n", code, db.GetConfig().GetDatabaseName())
    }
    
     // Returns all Redis pools
     for code, redisPool := range := engine.Registry().RedisPools() {
        fmt.Printf("%s = %d\n", code, redisPool.GetConfig().GetDatabaseNumber())
    }
    
     // Returns all local cache pools
     for code, localCache := range := engine.Registry().LocalCachePools() {
        fmt.Printf("%s = %d\n", code, localCache.GetConfig().GetLimit())
    }
}  
```

## Entity Schema

The `ValidatedRegistry` object holds information about every registered entity in the form of a `beeorm.EntitySchema` object. There are two ways to get the entity schema for an entity:

Using the entity name:

```go
// remember to use full entity name including package name
entitySchema := validatedRegistry.GetEntitySchema("main.CarEntity")
```

Using the entity itself:

```go
var carEntity *CarEntity
entitySchema := validatedRegistry.GetEntitySchema(carEntity)
```

If the entity is not registered in the `beeorm.Registry`, the `GetEntitySchema()` and `GetEntitySchemaForEntity()` methods will return nil.

### Entity Schema Getters

Once you have the `beeorm.EntitySchema` object, you can use the following methods to get useful information about the entity:

```go
entitySchema := validatedRegistry.GetEntitySchema("main.CarEntity")
entitySchema.GetTableName() // "CarEntity"
entitySchema.GetType() // Returns the reflect.Type of the CarEntity
entitySchema.GetColumns() // []string{"ID", "Color", "Owner"}
entitySchema.GetReferences() // []string{"Owner"} // Returns the names of one-to-one
```

### Entity Schema Usage

`beeorm.EntitySchema` provides a special method called `GetUsage()` that returns a map of types and field names where the entity is used as a one-to-one or one-to-many reference. The map has a key of type reflect.Type and a value of a slice of field names where the entity is used. Here's an example of how to use it:

```go{2}
entitySchema := validatedRegistry.GetEntitySchema("main.PersonEntity")
for type, fields := range entitySchema.GetUsage(validatedRegistry) {
    fmt.Println(type.Name()) // "CarEntity"
    fmt.Printf("%v", fields) // ["Owner"]
}
```

### New Entity Instance

You can use the `NewEntity()` method to create a new instance of the entity. For example:

```go{2}
entitySchema := validatedRegistry.GetEntitySchema("main.PersonEntity")
carEntity := entitySchema.NewEntity().(*CarEntity)
```

You can also retrieve the `beeorm.EntitySchema` from the entity cache key. For example, if you see the following query in Redis:

```GET f3b2d:123```

You can retrieve the entity schema with:

```go
entitySchema := validatedRegistry.GetEntitySchemaForCachePrefix("f3b2d")
```

### Accessing Entity Tags

`EntitySchema` provides methods that helps you read beeorm struct tags:

```go
type CarEntity struct {
	beeorm.ORM `orm:"my-tag-1=value-1"` 
	ID    uint32
	Color string `orm:"my-tag-2=value-2;my-tag-3"` 
}
entitySchema := validatedRegistry.GetEntitySchema("main.CarEntity")

entitySchema.GetTag("ORM", "my-tag-1", "", "") // value-1
entitySchema.GetTag("Color", "my-tag-2", "", "") // value-2
entitySchema.GetTag("Color", "my-tag-3", "yes", "") // yes
entitySchema.GetTag("Color", "missing-tag", "", "") // ""
entitySchema.GetTag("Color", "missing-tag", "", "default value") // default value
```

## Getting MySQL pools

To retrieve a list of registered MySQL pools, you can use the `GetMySQLPools()` method:

```go
for code, pool := range := validatedRegistry.GetMySQLPools() {
    fmt.Printf("Pool '%s':\n", code)
    fmt.Printf("Database: %d\n", pool.GetDatabase())
    fmt.Printf("URI: %s\n", pool.GetDataSourceURI())
    fmt.Printf("Version: %d\n", pool.GetVersion()) // 5 or 8
}
```

## Getting Redis pools

To retrieve a list of registered Redis pools, you can use the `GetRedisPools()` method:

```go
for code, pool := range := validatedRegistry.GetRedisPools() {
    fmt.Printf("Pool '%s':\n", code)
    fmt.Printf("DB: %d\n", pool.GetDB())
    fmt.Printf("Address: %s\n", pool.GetAddress())
}
```

## Getting local cache pools

To retrieve a list of registered local cache pools, you can use the GetLocalCachePools() method:

```go
for code, pool := range := validatedRegistry.GetLocalCachePools() {
    fmt.Printf("Pool '%s':\n", code)
    fmt.Printf("Limit: %d\n", pool.GetLimit())
}
```