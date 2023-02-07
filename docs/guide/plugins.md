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
	PluginInterfaceInitRegistry(registry *beeorm.Registry)
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
settings in [Entity Schema](/guide/validated_registry.html#entity-schema) using `SetOption()` method:

```go{12-13}
package my_debugger

const PluginCode = "github.com/me/my_project/my_debugger"

type MyDebuggerPlugin struct{}

func (p *MyDebuggerPlugin) GetCode() string {
	return PluginCode
}

func (p *MyDebuggerPlugin) InterfaceInitEntitySchema(schema beeorm.SettableEntitySchema, _ *beeorm.Registry) error {
	schema.SetOption(PluginCode, "my-option-1", 200)
	schema.SetOption(PluginCode, "my-option-2", "Hello")
	return nil
}
```
`schema.SetOption` requires plugin code name as a first argument so you will not override options with the same name
from another plugins. Entity Schema options can be easily accessed by `GetOption...` methods:

```go
entitySchema := validatedRegistry.GetEntitySchema(carEntity)
entitySchema.GetOption(PluginCode, "my-option-1") // int(200)
entitySchema.GetOption(PluginCode, "my-option-2") // "Hello"
entitySchema.GetOption(PluginCode, "missing-key") // nil
// if you know opton value is an string:
entitySchema.GetOptionString(PluginCode, "my-option-2") // "Hello"
```

### PluginInterfaceSchemaCheck

TODO



### PluginInterfaceEntityFlushed

TODO