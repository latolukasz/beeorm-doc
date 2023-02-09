# Log table

This plugin extends [CRUD stream](/plugins/crud_stream.html) plugin by adding special MySQL tables
that stores tracked entities changes and allows you to easily retrieve them.

## Activating the Plugin

```go{10,11}
package main

import {
    "github.com/latolukasz/beeorm/v2/plugins/crud_stream"
    "github.com/latolukasz/beeorm/v2/plugins/log_table"
}

func main() {
    registry := beeorm.NewRegistry()
    egistry.RegisterPlugin(crud_stream.Init(nil))  // required
    registry.RegisterPlugin(log_table.Init(nil)) 
} 
```

## Enabling Log Event Tracking

You need to specify which entities you want to store in log tables by adding the special tag `log-table` to them:

```go{2}
type CarEntity struct {
    beeorm.ORM `orm:"crud-stream;log-table"`
    Name       string
}
```

:::tip
As you can see you must also add `crud-stream` tag which instruct [CRUD stream](/plugins/crud_stream.html) plugin
to track entity changes as events in `beeorm-crud-stream` stream.
:::

You can also change the tag name using plugin options:

```go{1,5}
pluginOptions := &log_table.Options{TagName: "enable-log-plugin"}
registry.RegisterPlugin(log_table.Init(pluginOptions)) 

type CarEntity struct {
    beeorm.ORM `orm:"crud-stream;enable-log-plugin"`
    Name       string
}
```

By default log tables are created in "default" MySQL pool name. You can also change it using plugin options:

```go
pluginOptions := &log_table.Options{DefaultMySQLPool: "logs"}
registry.RegisterPlugin(log_table.Init(pluginOptions)) 
```

It's also possible to define MySQL pool name using tag:

```go{2}
type CarEntity struct {
    beeorm.ORM `orm:"crud-stream;log-table=logs"`
    Name       string
}
```

## Creating log tables

Now hen plugin is registered and entities are marked as tracked with tags it's time to create tables using
BeeORM [schema update](/guide/schema_update.html#schema-update):

```go
for _, alter := range engine.GetAlters() {
    alter.Exec()
}
```

## Running consumer

To store CRUD events in log MySQL tables at least one `log_table.ConsumerGroupName` must be run in your application:

```go
consumer := engine.GetEventBroker().Consumer(log_table.ConsumerGroupName)
consumer.Consume(context.Background(), 100, log_table.NewEventHandler(engine))
```

Above consumer reads events from `beeorm-crud-stream` stream and stores them in special MySQL log tables.

Log table name is build as a `_log_[LOG_POOL_NAME]_[ENTITY_NAME]`. 

For example below entity creates table `log_logs_CarEntity`:

```go
type CarEntity struct {
    beeorm.ORM `orm:"crud-stream;log-table=logs"`
    Name       string
}
```

## Reading logs

You can read log events directly from MySQL log tables. Table structure is very simple and easy to understand.
But also you can use `GetEntityLogs()` table to retrieve events in your code, as described in below example:

```go
schema := engine.GetRegistry().GetEntitySchema("main.CarEntity")
for _ log := range log_table.GetEntityLogs(engine, schema, 1, nil, nil) {
    log.LogID // ID of a row in log table
    log.EntityID // ID of an entity
    log.Date // time when entity was modified
    log.Before // values of changed fields before update
    log.Afer // values of changed fields after update
}
```

Log event has also field `MetaData` which hols [crud event metadata](/plugins/crud_stream.html#storing-additional-metadata-in-crud-events).

`GetEntityLogs()` accepts also `beeorm.Pager` and `beeorm.Where`  parameters that can be sued to filter results:

```go
pager := beeorm.NewPager(1, 100)
where := beeorm.NewWhere("added_at > 20022-01-02")
logs := log_table.GetEntityLogs(engine, schema, 1, pager, nil)
```

