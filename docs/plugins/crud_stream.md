# CRUD Stream

This plugin creates a specials Redis channel called `beeorm-crud-stream` and sends event to it 
every time Entity is added, updated or deleted.

## Enabling Plugin

```go{7}
package main

import "github.com/latolukasz/beeorm/v2/plugins/crud_stream"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterPlugin(crud_stream.Init(nil)) 
} 
```

## Enabling CRUD event

Registering plugin is a first step. Next you need to specify which entities should be tracked for any changes with
special tag `crud-stream`:

```go{2}
type CarEntity struct {
    beeorm.ORM `orm:"crud-stream"`
    Name       string
}
```

Starting from now every time `CarEntity` is added, updated or deleted special event is send to `beeorm-crud-stream` stream.

You can change tag name with plugin options:

```go{1,5}
pluginOptions := &crud_stream.Options{TagName: "enable-crud-plugin"}
registry.RegisterPlugin(crud_stream.Init(pluginOptions)) 

type CarEntity struct {
    beeorm.ORM `orm:"enable-crud-plugin"`
    Name       string
}
```

By default this plugin creates stream event if at least one entity field (that is stored in database) is changed.
You can configure plugin to skip some fields with special tag `skip-crud-stream`:

```go{4}
type UserEntity struct {
    beeorm.ORM `orm:"crud-stream"`
    Name       string
    LastLoggedAt time.Time `orm:"skip-crud-stream"`
}
```

Staring from now if `UserEntity` is updated and the only field is changed is `LastLoggedAt` then
plugin do not send any event to `beeorm-crud-stream` stream.

By default `beeorm-crud-stream` is created in `default` Redis data pool. You can change it using plugin options:

```go
pluginOptions := &crud_stream.Options{DefaultRedisPool: "streams-pool"}
registry.RegisterPlugin(crud_stream.Init(pluginOptions)) 
```

## Reading CRUD events

TO read CRUD events from this `beeorm-crud-stream` first you need to register group consumer:

```go{8}
package main

import "github.com/latolukasz/beeorm/v2/plugins/crud_stream"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterPlugin(crud_stream.Init(nil)) 
    registry.RegisterRedisStreamConsumerGroups(crud_stream.ChannelName, "test-consumer")
} 
```

`RegisterRedisStreamConsumerGroups()` must be executed after plugin is registered in registry (as showed above).
Otherwise error is thrown.

Now we are ready to consume events:

```go

consumer := engine.GetEventBroker().Consumer("test-consumer")
consumer.Consume(context.Background(), 100, func(events []beeorm.Event) {
    for _, event := range events {
        var crudEvent crud_stream.CrudEvent
        event.Unserialize(&crudEvent)
    }
})
```

As you can see CRUD event is represented as `crud_stream.CrudEvent`. It holds information about entity changes:

```go
carEntity := &CarEntity{Name: "BMW"}
engined.Flush(carEntity)

// then crudEvent has these values:
event.EntityName // "main.CarEntity"
event.ID // 1
event.Action // beeorm.Insert
event.Before // nil
event.Changes // {"Name": "BMW"}
event.Updated // time when query was executed

carEntity.Name = "Mazda"
engined.Flush(carEntity) 

// then crudEvent has these values:
event.EntityName // "main.CarEntity"
event.ID // 1
event.Action // beeorm.Update
event.Before // {"Name": "BMW"}
event.Changes // {"Name": "Mazda"}
event.Updated // time when query was executed

engined.Delete(carEntity) 

// then crudEvent has these values:
event.EntityName // "main.CarEntity"
event.ID // 1
event.Action // beeorm.Delete
event.Before // {"Name": "Mazda"}
event.Changes // nil
event.Updated // time when query was executed
```

## CRUD event metadata

TODO