# CRUD Stream

The CRUD Stream plugin creates a special Redis channel called `beeorm-crud-stream` and sends an event to it
every time an Entity is added, updated, or deleted.

## Activating the Plugin

```go{7}
package main

import "github.com/latolukasz/beeorm/v2/plugins/crud_stream"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterPlugin(crud_stream.Init(nil)) 
} 
```

## Enabling CRUD Event Tracking

The first step in enabling CRUD event tracking is to register the plugin. After that, you need to specify which entities you want to track for changes by adding the special tag `crud-stream` to them:

```go{2}
type CarEntity struct {
    beeorm.ORM `orm:"crud-stream"`
    Name       string
}
```

From this point forward, every time a CarEntity is added, updated, or deleted, a special event will be sent to the `beeorm-crud-stream` stream.

You can also change the tag name using plugin options:

```go{1,5}
pluginOptions := &crud_stream.Options{TagName: "enable-crud-plugin"}
registry.RegisterPlugin(crud_stream.Init(pluginOptions)) 

type CarEntity struct {
    beeorm.ORM `orm:"enable-crud-plugin"`
    Name       string
}
```

By default, the plugin will send an event to the `beeorm-crud-stream` stream if any entity field stored in the database has changed. However, you can configure the plugin to skip certain fields by adding the special tag `skip-crud-stream` to them:

```go{4}
type UserEntity struct {
    beeorm.ORM `orm:"crud-stream"`
    Name       string
    LastLoggedAt time.Time `orm:"skip-crud-stream"`
}
```

If a UserEntity is updated and the only changed field is LastLoggedAt, the plugin will not send an event to the `beeorm-crud-stream` stream.

By default, the `beeorm-crud-stream` is created in the default Redis data pool. You can change this using the plugin options:
```go
pluginOptions := &crud_stream.Options{DefaultRedisPool: "streams-pool"}
registry.RegisterPlugin(crud_stream.Init(pluginOptions)) 
```

## Reading CRUD Events

In order to read CRUD events from the `beeorm-crud-stream`, you must first register a group consumer. This can be done as follows:

```go{8}
package main

import "github.com/latolukasz/beeorm/v2/plugins/crud_stream"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterPlugin(crud_stream.Init(nil)) 
    registry.RegisterRedisStreamConsumerGroups(crud_stream.ChannelName, "test-consumer")
} 
```

It's important to note that the `RegisterRedisStreamConsumerGroups()` method must be called after the plugin is registered in the registry, otherwise an error will be thrown.

Once the group consumer is registered, we can now consume events:

```go

consumer := engine.GetEventBroker().Consumer("test-consumer")
consumer.Consume(context.Background(), 100, func(events []beeorm.Event) {
    for _, event := range events {
        var crudEvent crud_stream.CrudEvent
        event.Unserialize(&crudEvent)
    }
})
```

The CRUD event is represented as `crud_stream.CrudEvent`, which holds information about changes made to entities. For example, consider the following code:

```go
carEntity := &CarEntity{Name: "BMW"}
engine.Flush(carEntity)

// then crudEvent has these values:
event.EntityName // "main.CarEntity"
event.ID // 1
event.Action // beeorm.Insert
event.Before // nil
event.Changes // {"Name": "BMW"}
event.Updated // time when query was executed

carEntity.Name = "Mazda"
engine.Flush(carEntity) 

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

In this example, when the CarEntity is inserted, the crudEvent will contain information about the new entity, such as its ID and name. When the entity is updated, the crudEvent will show the changes made to the entity, including the updated name. Finally, when the entity is deleted, the crudEvent will show that the entity was deleted and will not contain any information about its previous state.

## Storing Additional Metadata in CRUD Events

In some cases, you may want to include additional information about a CRUD event, such as the user IP or ID of the person who made the change. This plugin allows you to store this extra information, referred to as "metadata", in the event.

Here is an example:

```go
crud_stream.SetMetaData(engine, "user_ip", "132.12.23.43")
crud_stream.SetMetaData(engine, "user_id", "114")

carEntity := &CarEntity{Name: "BMW"}
engine.Flush(carEntity)

// then crudEvent has these values:
event.MetaData // {"user_ip": 132.12.23.43", "user_id": "114"}
```