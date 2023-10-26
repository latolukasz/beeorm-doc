# Entity Schema

The `EntitySchema` object holds information about every registered entity. There are many ways to get the entity schema for an entity:

Using `Registry` and the entity type:

```go
entitySchema :=  engine.Registry().EntitySchema(reflect.TypeOf(CarEntity{}))
```

Using `Registry` and the entity name:

```go
// remember to use full entity name including package name
entitySchema := engine.Registry().EntitySchema("main.CarEntity")
```

Using `Registry` and the entity instance:

```go
entitySchema :=  engine.Registry().EntitySchema(CarEntity{})
```

Using `Registry` and the entity type:

```go
entitySchema :=  engine.Registry().EntitySchema(reflect.TypeOf(CarEntity{}))
```

If the entity is not registered in the `beeorm.Registry`, above methods will return nil.

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