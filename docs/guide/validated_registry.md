# Validated Registry

n previous sections, you learned how to create a `beeorm.Registry` object and register entities with it. You should also know how to configure database connections by now. In this section, you will learn about the `ValidatedRegistry`, which is the heart of BeeORM.

## Validating the Registry

Validating the Registry
To create a ValidatedRegistry, you first need to create a `beeorm.Registry` object and register the necessary database connections and entities with it. Then, you can call the `registry.Validate()` method to create a `ValidatedRegistry` object. Here is an example:

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
    
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
}  
```

::: tip
It is recommended to create the `beeorm.Registry` object and call `registry.Validate()` only once in your application, when it starts. For example, if you are running an HTTP server, you should run the above code before the `http.ListenAndServe(":8080", nil)` line.
:::

The `ValidatedRegistry` object should be shared across all goroutines in your application. It serves as a read-only, validated source of BeeORM settings, including connection credentials and entity structures. You cannot use it to register more entities or connections - this should be done using a `beeorm.Registry` object. In other words, the `beeorm.Registry` is where you configure BeeORM, while the `ValidatedRegistry` is a read-only source of the resulting configuration.


## Updating the Validated Registry

If you need to make changes to the configuration of a `ValidatedRegistry`, you will need to create a new one. To do this, you can use the `GetSourceRegistry()` method to retrieve the original `beeorm.Registry` object, make the necessary changes to it, and then call the `registry.Validate()` method again to create a new `ValidatedRegistry` object.

Here is an example:

```go{1}
registry := validatedRegistry.GetSourceRegistry()
// Make changes to the configuration:
registry.RegisterEntity(&ProductEntity{})
// Overwrite the validated registry: 
validatedRegistry, err = registry.Validate()

```

## Getting Entity Settings

The `ValidatedRegistry` object provides useful getters for accessing information about registered entities. In the following example, we register two entities and an enum:
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
    validatedRegistry, err := registry.Validate()
    if err != nil {
      panic(err)
    }
}  
```

To get a list of registered entities, you can use the `GetEntities` method:

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

The GetEntities method returns a map with the names of the entities as keys and their types as values. You can use this information to retrieve additional details about the entities and their fields.

## Getting Enum Settings

To get details about a registered enum, you can use the `GetEnum()` method on the `ValidatedRegistry` object. This method takes the name of the enum as an argument and returns a `beeorm.Enum` object that provides several methods for accessing information about the enum.

Here is an example of how to use the `GetEnum()` method and the various methods provided by the `beeorm.Enum` object:

```go
colors := validatedRegistry.GetEnum("colors")
colors.GetFields() // []string{"red", "blue", "yellow"}
colors.GetDefault() // "red"
colors.Has("blue") // true
colors.Has("orange") // false
colors.Index("blue") // 2 (starts at 1)
colors.Index("orange") // 0
```

The `GetFields()` method returns a slice of strings containing the names of the enum fields. The `GetDefault()` method returns the default value of the enum, which is the first field by default. The `Has()` method checks if the enum has a field with the given name, and returns a boolean indicating whether it does or not. The `Index()` method returns the index of the field with the given name, or 0 if the field does not exist. These methods can be useful for validating and processing user input or data stored in the database.

## Entity Schema

The `ValidatedRegistry` object holds information about every registered entity in the form of a `beeorm.TableSchema` object. There are two ways to get the table schema for an entity:

Using the entity name:

```go
// remember to use full entity name including package name
tableSchema := validatedRegistry.GetTableSchema("main.CarEntity")
```

Using the entity itself:

```go
var carEntity *CarEntity
tableSchema := validatedRegistry.GetTableSchemaForEntity(carEntity)
```

If the entity is not registered in the `beeorm.Registry`, the `GetTableSchema()` and `GetTableSchemaForEntity()` methods will return nil.

Once you have the `beeorm.TableSchema` object, you can use the following methods to get useful information about the entity:

```go
tableSchema := validatedRegistry.GetTableSchema("main.CarEntity")
tableSchema.GetTableName() // "CarEntity"
tableSchema.GetType() // Returns the reflect.Type of the CarEntity
tableSchema.GetColumns() // []string{"ID", "Color", "Owner"}
tableSchema.GetReferences() // []string{"Owner"} // Returns the names of one-to-one

```

`beeorm.TableSchema` provides a special method called `GetUsage()` that returns a map of types and field names where the entity is used as a one-to-one or one-to-many reference. The map has a key of type reflect.Type and a value of a slice of field names where the entity is used. Here's an example of how to use it:

```go{2}
tableSchema := validatedRegistry.GetTableSchema("main.PersonEntity")
for type, fields := range tableSchema.GetUsage(validatedRegistry) {
    fmt.Println(type.Name()) // "CarEntity"
    fmt.Printf("%v", fields) // ["Owner"]
}
```

You can use the `NewEntity()` method to create a new instance of the entity. For example:

```go{2}
tableSchema := validatedRegistry.GetTableSchema("main.PersonEntity")
carEntity := tableSchema.NewEntity().(*CarEntity)
```

You can also retrieve the `beeorm.TableSchema` from the entity cache key. For example, if you see the following query in Redis:

```GET f3b2d:123```

You can retrieve the table schema with:

```go
tableSchema := validatedRegistry.GetTableSchemaForCachePrefix("f3b2d")
```

## Getting MySQL pools

To retrieve a list of registered MySQL pools, you can use the `GetMySQLPools()` method:

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

To retrieve a list of registered Redis pools, you can use the `GetRedisPools()` method:

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

To retrieve a list of registered local cache pools, you can use the GetLocalCachePools() method:

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
