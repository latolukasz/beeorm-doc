# Log table

The Log Table plugin enhances the functionality of the CRUD stream](/plugins/crud_stream.html) by adding specialized MySQL tables to track changes to entities and simplify data retrieval.

## Activating the Plugin

The following code demonstrates how to activate the Log Table plugin in your project.

```go
package main

import {
    "github.com/latolukasz/beeorm/v2"
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

To store entities in log tables, you need to specify which entities to track by adding the special tag `log-table` to them. Here's an example:

```go{2}
type CarEntity struct {
    beeorm.ORM `orm:"crud-stream;log-table"`
    ID         uint16
    Name       string
}
```

:::tip
In addition to the `log-table` tag, it's also necessary to add the `crud-stream` tag. This informs the [CRUD stream](/plugins/crud_stream.html) plugin to track changes to the entity as events in the `beeorm-crud-stream` stream.
:::

You can also customize the tag name using the `TagName` option in the plugin options:

```go{1,5}
pluginOptions := &log_table.Options{TagName: "enable-log-plugin"}
registry.RegisterPlugin(log_table.Init(pluginOptions)) 

type CarEntity struct {
    beeorm.ORM `orm:"crud-stream;enable-log-plugin"`
    ID         uint16
    Name       string
}
```

By default, log tables are created in the "default" MySQL pool. You can change this by using the `DefaultMySQLPool` option in the plugin options:
```go
pluginOptions := &log_table.Options{DefaultMySQLPool: "logs"}
registry.RegisterPlugin(log_table.Init(pluginOptions)) 
```

It's also possible to specify the MySQL pool name using the tag:

```go{2}
type CarEntity struct {
    beeorm.ORM `orm:"crud-stream;log-table=logs"`
    ID         uint16
    Name       string
}
```

## Generating Log Tables

Once the plugin is registered and the entities are marked as tracked with the appropriate tags, it's time to generate the log tables using BeeORM's [schema update](/guide/schema_update.html#schema-update) feature:

```go
for _, alter := range engine.GetAlters() {
    alter.Exec()
}
```

## Implementing the Consumer

In order to store CRUD events in the log MySQL tables, at least one instance of `log_table.ConsumerGroupName` must be running in your application:

```go
consumer := engine.GetEventBroker().Consumer(log_table.ConsumerGroupName)
consumer.Consume(context.Background(), 100, log_table.NewEventHandler(engine))
```

The consumer reads events from the `beeorm-crud-stream` stream and stores them in the designated log MySQL tables.

The name of the log table is constructed as `_log_[LOG_POOL_NAME]_[ENTITY_NAME]`.

For example, if you have the following entity definition:

```go
type CarEntity struct {
    beeorm.ORM `orm:"crud-stream;log-table=logs"`
    ID         uint16
    Name       string
}
```

The log table created would be `_log_logs_CarEntity`.

## Reading Logs

You have multiple options for reading log events from the MySQL log tables:

 * Direct access to the log tables - The table structure is simple and straightforward, making it easy for you to directly access the logs.

 * Use `GetEntityLogs()` - This function allows you to retrieve log events within your code. Here's an example:

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

Note that each log event also has a MetaData field that holds the [crud event metadata](/plugins/crud_stream.html#storing-additional-metadata-in-crud-events).

`GetEntityLogs()` also accepts `beeorm.Pager` and `beeorm.Where` parameters that you can use to filter the results:

```go
pager := beeorm.NewPager(1, 100)
where := beeorm.NewWhere("added_at > 20022-01-02")
logs := log_table.GetEntityLogs(engine, schema, 1, pager, nil)
```