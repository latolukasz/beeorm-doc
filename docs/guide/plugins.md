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

TODO

### PluginInterfaceInitTableSchema

TODO

### PluginInterfaceSchemaCheck

TODO

### PluginInterfaceEntityFlushed

TODO