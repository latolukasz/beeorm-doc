# Plugins

BeeORM can be enhanced with new functionality through the use of plugins. Currently, these plugins only allow for partial extension of BeeORM's features, but in upcoming releases, it will be possible to extend all of BeeORM's functionalities.

## Enabling Plugins

Activating plugins in BeeORM is straightforward. Simply register the plugin using the `RegisterPlugin()` method:

```go{10}
package main

import (
    "github.com/latolukasz/beeorm/v2"
    "github.com/latolukasz/beeorm/v2/plugins/log_tables"
)

func main() {
  registry := beeorm.NewRegistry()
  registry.RegisterPlugin(log_tables.Init())
}
```

BeeORM offers several built-in plugins that can be found in the [Plugins](/plugins/) section.

## Creating a BeeORM Plugin

You can create your own custom BeeORM plugin by implementing the following interface:

```go
type Plugin interface {
	GetCode() string
}
```

The GetCode function returns a unique name that identifies your plugin. It is recommended to include the go module name in the plugin name, such as `github.com/latolukasz/beeorm/my_debugger`, to prevent collisions with other plugins created by other developers.

Here's an example of a basic plugin called `my_debugger`:

```go
package my_debugger

const PluginCode = "github.com/me/my_project/my_debugger"

type MyDebuggerPlugin struct{}

func (p *MyDebuggerPlugin) GetCode() string {
	return PluginCode
}
```

Once you have created a basic plugin, you can implement one or many of the BeeORM plugin interfaces defined [here](https://github.com/latolukasz/beeorm/blob/v2/plugin.go) to add custom functionality.

### PluginInterfaceInitRegistry

```go
type PluginInterfaceInitRegistry interface {
	PluginInterfaceInitRegistry(registry *Registry)
}
```

The `PluginInterfaceInitRegistry` interface is executed when the plugin is registered in the BeeORM Registry.

:::tip
The code for plugins is executed in the same order in which they were registered in BeeORM.
:::

### PluginInterfaceInitEntitySchema

```go
type PluginInterfaceInitEntitySchema interface {
	InterfaceInitEntitySchema(schema SettableEntitySchema, registry *Registry) error
}
```

The `PluginInterfaceInitEntitySchema` interface is executed for every Entity when the [registry.Validate()](/guide/validated_registry.html#validating-the-registry)  method is called. You have access to the `beeorm.Registry` and the `beeorm.SettableEntitySchema` object, which allows you to save additional settings in the [Entity Schema](/guide/validated_registry.html#entity-schema) using the ``SetPluginOption()` method.

For example:

```go{12-13}
package my_debugger

const PluginCode = "github.com/me/my_project/my_debugger"

type MyDebuggerPlugin struct{}

func (p *MyDebuggerPlugin) GetCode() string {
	return PluginCode
}

func (p *MyDebuggerPlugin) InterfaceInitEntitySchema(schema SettableEntitySchema, _ *Registry) error {
	schema.SetPluginOption(PluginCode, "my-option-1", 200)
	schema.SePlugintOption(PluginCode, "my-option-2", "Hello")
	return nil
}
```

Note that the `schema.SetPluginOption` method requires the plugin code name as its first argument, to prevent overrides of options with the same name from other plugins. The Entity Schema options can be easily accessed through the `GetPluginOption...` methods.

For example:

```go
entitySchema := validatedRegistry.GetEntitySchema(carEntity)
entitySchema.GetPluginOption(PluginCode, "my-option-1") // int(200)
entitySchema.GetPluginOption(PluginCode, "my-option-2") // "Hello"
entitySchema.GetPluginOption(PluginCode, "missing-key") // nil
```

### PluginInterfaceSchemaCheck

```go
type PluginInterfaceSchemaCheck interface {
	PluginInterfaceSchemaCheck(engine Engine, schema EntitySchema) (alters []Alter, keepTables map[string][]string)
}
```

The PluginInterfaceSchemaCheck interface is executed during [schema update](/guide/schema_update.html#schema-update) and allows you to return any additional database alters to be executed.

For example, you can use this to truncate a table if the `truncate-on-init` ORM tag is set to "true"

```go{11-16}
package my_debugger

const PluginCode = "github.com/me/my_project/my_debugger"

type MyDebuggerPlugin struct{}

func (p *MyDebuggerPlugin) GetCode() string {
	return PluginCode
}

func (p *MyDebuggerPlugin) PluginInterfaceSchemaCheck(_ Engine, schema EntitySchema) (alters []Alter, keepTables map[string][]string) {
    if schema.GetTag("ORM", "truncate-on-init", "true", "") == "true" {
        alter := Alter{SQL: fmt.Sprintf( "TRUNCATE TABLE `%s`", schema.GetTableName()), Safe: false, Pool: schema.GetMysqlPool()}
        return []Alter{alter}, nil
    }
}
```

Additionally, you can return a map of table names to keep by pool name, in case they should not be dropped. For instance, if you have a table that is not registered as an Entity:

```go
func (p *MyDebuggerPlugin) PluginInterfaceSchemaCheck(_ Engine, schema EntitySchema) (alters []Alter, keepTables map[string][]string) {
    // do not drop table `debug_table`
    return nil, map[string][]string{"default": {"debug_table"}}
}
```

### PluginInterfaceEntityFlushing

```go
type PluginInterfaceEntityFlushing interface {
	PluginInterfaceEntityFlushing(engine Engine, event EventEntityFlushing)
}
```

The `PluginInterfaceEntityFlushing` interface is called every time an Entity is flushed prior to the execution of the SQL query in the MySQL database. The `EventEntityFlushing` object contains information about the changes, such as the type of action (Insert, Update, or Delete), the entity name, ID, and the values of the fields before and after the SQL query.

Additionally, the EventEntityFlushing object provides a method `SetMetaData()` which allows you to store extra parameters in the flush entity event that can be used in subsequent plugin interfaces, such as [PluginInterfaceEntityFlushed](/guide/plugins.html#plugininterfaceentityflushed).

```go
func (p *MyDebuggerPlugin) PluginInterfaceEntityFlushing(engine Engine, event EventEntityFlushing) {
    event.Type() // beeorm.Insert or beeorm.Update or beeorm.Delete
    event.EntityName() // flushed entity name, for instance "package.CarEntity"
    event.EntityID() // flushed entity ID, zero when  event.Type() is beeorm.Insert
    event.Before() // map of changed fields values before SQL query. nil when Action is "beeorm.Insert"
    event.After() // map of changed fields values after SQL query. nil when Action is "beeorm.Delete"
    event.SetMetaData("meta-1", "value")
}
```

### PluginInterfaceEntityFlushed

```go
type PluginInterfaceEntityFlushed interface {
	PluginInterfaceEntityFlushed(engine Engine, event EventEntityFlushed, cacheFlusher FlusherCacheSetter)
}
```

This interface is executed every time an Entity is flushed in the MySQL database after the SQL query has been executed but before any cache-related operations (e.g. deleting the Entity cache in Redis) are carried out.

The `EventEntityFlushed` object holds all information about the changes made to the Entity.

```go
func (p *MyDebuggerPlugin) PluginInterfaceEntityFlushed(engine Engine, event EventEntityFlushed, cacheFlusher FlusherCacheSetter) {
    event.Type() // beeorm.Insert or beeorm.Update or beeorm.Delete
    event.EntityName() // flushed entity name, for instance "package.CarEntity"
    event.EntityID() // flushed entity ID
    event.Before() // map of changed fields values before SQL query. nil when Action is "beeorm.Insert"
    event.After() // map of changed fields values after SQL query. nil when Action is "beeorm.Delete"
    event.MetaData() // meta data set in `PluginInterfaceEntityFlushing`
}
```

For example:

```go
package my_package

car := &CarEntity{Name: "BMW", Year: 2006}
engine.FLush(car)
// then
event.Type() // beeorm.Insert
event.EntityName() // my_package.CarEntity
event.EntityID() // 1
event.Before() // nil
event.After() // {"Name": "Bmw", "Year": "2006"}

car.Year = 2007
engine.Flush(car)
// then
event.Type() // beeorm.Update
event.EntityName() // my_package.CarEntity
event.EntityID() // 1
event.Before() // {"Year": "2006"}
event.After() // {""Year": "2007"}

engine.Delete(car)
engine// then
event.Type() // beeorm.Delete
event.EntityName() // my_package.CarEntity
event.EntityID() // 1
event.Before() // {"Name": "BMW", "Year": "2007"}
event.After() // nil
```

The last argument, `FlusherCacheSetter`, is used to add extra cache operations to Redis or the local cache that should be executed after the Entity is updated in the database. BeeORM groups all cache operations in an optimized way by using pipelines.

For example:

```go
func (p *MyDebuggerPlugin) PluginInterfaceEntityFlushed(engine Engine, event EventEntityFlushed, cacheFlusher FlusherCacheSetter) {
    cacheFlusher.GetRedisCacheSetter("default").Del("my-key")
    cacheFlusher.PublishToStream("my-stream", "hello")
}
```

## Engine Plugin Options

The `SetPluginOption` and `GetPluginOption` methods of the `beeorm.Engine` allow you to store and retrieve extra options in the engine.

Here's an example of how you can use these methods:

```go
engine.SetPluginOption(PluginCode, "option-1", "value")
val := engine.GetPluginOption(PluginCode, "options-1") // "value"
```