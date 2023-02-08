# Plugins

BeeORM can be easily extended with new features by plugins. 

## Using plugins

Enabling plugin in BeeORM is very simple. You just need to register plugin with `RegisterPlugin()` method:

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

BeeORM provides few plugins by default. You can find them in [Plugins](/plugins/) section.

## Writing plugin

You can create your own BeeORM plugin. The simplest plugin (that does nothing:) is just a struct which implements
this interface:

```go
type Plugin interface {
	GetCode() string
}
```

Code is a unique name that identifies your plugin. It's recommended to include go module name in plugin name, for 
instance `github.com/latolukasz/beeorm/plugin_name` so your plugin name will never collide with another plugin created by
another developer.

So let's create our first plugin called `my_debugger`:

```go
package my_debugger

const PluginCode = "github.com/me/my_project/my_debugger"

type MyDebuggerPlugin struct{}

func (p *MyDebuggerPlugin) GetCode() string {
	return PluginCode
}
```

As mentioned before this plugin does nothing. Now we must to implement one or many BeeORM plugin interfaces
defined [here](https://github.com/latolukasz/beeorm/blob/v2/plugin.go).

We will describe each of them below.

### PluginInterfaceInitRegistry

```go
type PluginInterfaceInitRegistry interface {
	PluginInterfaceInitRegistry(registry *Registry)
}
```

This interface is executed when plugin is registered in beeorm.Registry.

:::tip
Plugins code is executed in the same order plugins were registered in BeeORM.
:::

### PluginInterfaceInitEntitySchema

```go
type PluginInterfaceInitEntitySchema interface {
	InterfaceInitEntitySchema(schema SettableEntitySchema, registry *Registry) error
}
```

This interface is executed for every Entity when [registry.Validate()](/guide/validated_registry.html#validating-the-registry) 
is executed. You have access to `beeorm.Registry` and special object `beeorm.SettableEntitySchema` which allows you to save additional
settings in [Entity Schema](/guide/validated_registry.html#entity-schema) using `SetPluginOption()` method:

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

`schema.SetPluginOption` requires plugin code name as a first argument so you will not override options with the same name
from another plugins. Entity Schema options can be easily accessed by `GetPluginOption...` methods:

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

This code is executed during [schema update](/guide/schema_update.html#schema-update). You can return extra database alters
that should be executed:

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

Second returned argument is a map of table names in specific pool name that shouldn't be dropped by BeeORM (for instance when a table is not registered as Entity):

```go
func (p *MyDebuggerPlugin) PluginInterfaceSchemaCheck(_ Engine, schema EntitySchema) (alters []Alter, keepTables map[string][]string) {
    // do not drop table `debug_table`
    return nil, map[string][]string{"default": {"debug_table"}}
}
```

### PluginInterfaceEntityFlushing

TODO

### PluginInterfaceEntityFlushed

```go
type PluginInterfaceEntityFlushed interface {
	PluginInterfaceEntityFlushed(engine Engine, data *EntitySQLFlush, cacheFlusher FlusherCacheSetter)
}
```

This interface is executed every time `Entity` is flushed and SQL query is executed in MySQL database but before
all required queries to cache are executed (for instance deleting Entity cache in Redis).

Object `EventEntityFlushQueryExecuted` holds whole information about changes:

```go
func (p *MyDebuggerPlugin) PluginInterfaceEntityFlushed(engine Engine, event EventEntityFlushQueryExecuted, cacheFlusher FlusherCacheSetter) {
    event.Type() // beeorm.Insert or beeorm.Update or beeorm.Delete
    event.EntityName() // flushed entity name, for instance "package.CarEntity"
    event.EntityID() // flushed entity ID
    event.Before() // map of changed fields values before SQL query. nil when Action is "beeorm.Insert"
    event.After() // map of changed fields values after SQL query. nil when Action is "beeorm.Delete"
    event.MetaData() // meta data set in `PluginInterfaceEntityFlushing`
}
```

It's easier to understand it by example:

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

Last argument `FlusherCacheSetter` is used to inject extra queries to Redis or Local Cache that should be executed after
Entity is updated in database. BeeORM execute all queries in most optimised way by grouping all cache queries into pipelines.

Check below example:

```go
func (p *MyDebuggerPlugin) PluginInterfaceEntityFlushed(engine Engine, event EventEntityFlushQueryExecuted, cacheFlusher FlusherCacheSetter) {
    cacheFlusher.GetRedisCacheSetter("default").Del("my-key")
    cacheFlusher.PublishToStream("my-stream", "hello")
}
```