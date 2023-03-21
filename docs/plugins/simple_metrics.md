# Simple Metrics

This plugin is designed to collect statistics on all MySQL queries and provide a useful report to help developers identify database bottlenecks in their application, such as slow or heavily used queries.

## Enabling the Simple Metrics Plugin

To enable the Simple Metrics Plugin, you will need to add the following code to your application:

```go
package main

import {
    "github.com/latolukasz/beeorm/v2"
    "github.com/latolukasz/beeorm/v2/plugins/simple_metrics"
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterPlugin(simple_metrics.Init(nil)) 
} 
```

This will initialize the plugin and allow you to start collecting metrics on your MySQL queries. From there, you can use the provided report to optimize your application and improve its performance.

## MySQL Slow Queries Report

MySQL Slow Queries Report
If you need to retrieve a list of the slowest MySQL queries in your application, ordered by query duration, you can use the `GetMySQLSlowQueriesStats()` method provided by the Simple Metrics plugin. Here's an example of how to use it in your code:

```go
simpleMetrics = engine.GetRegistry().GetPlugin(simple_metrics.PluginCode).(*simple_metrics.Plugin)
for _, slowQuery := range simpleMetrics.GetMySQLSlowQueriesStats() {
    slowQuery.Query // "SELECT * FROM...."
    slowQuery.Pool // "default"
    slowQuery.Duration //query execution time
}
```

By default, the plugin logs the 500 slowest queries from your application. You can change this limit by setting the `MySQLSlowQueriesLimit` option when initializing the plugin. Here's an example:
```go
pluginOptions := &simple_metrics.Options{MySQLSlowQueriesLimit: 1000}
registry.RegisterPlugin(simple_metrics.Init(pluginOptions)) 
```

Note that the Simple Metrics plugin only stores slow queries for queries that are not executed with [Lazy Flush](/guide/lazy_flush.html). This can help you optimize your application's performance by identifying slow queries that may be impacting its overall speed.

## Metrics Tag Name

By default all queries are grouped into two groups:

 * lazy queries flushed with [Lazy Flush](/guide/lazy_flush.html)
 * all other queries

Lazy queries are marked with tag (described later) `"lazy"` and other queries use empty string `"""` tag name.

You can instruct simple metrics plugin to track all queries executed by single `beeorm.Engine` in a custom group:

```go{2}
simpleMetrics = engine.GetRegistry().GetPlugin(simple_metrics.PluginCode).(*simple_metrics.Plugin)
simpleMetrics.SetTagName(engine, "my_tag")
```

## MySQL Query Statistics Report

The Simple Metrics plugin tracks all MySQL queries and groups them by different criteria, such as pool name, query type, table name, and whether the query was executed lazily.

The plugin groups queries into the following types:

 * pool name
 * query type (INSERT, UPDATE...)
 * table name
 * tag name

Query type is constant with one of these values:

 * **QUERY** - all `SELECT ...` queries
 * **INSERT** - all `INSERT INTO ...` queries
 * **UPDATE** - all `UPDATE ...` queries
 * **DELETE** - all `DELETE FROM ...` queries
 * **SHOW** - all `SHOW ...` queries
 * **ALTER** - all `ALTER TABLE ...` queries
 * **OTHER** - all other queries

You can retrieve all the grouped queries with the `GetMySQLQueriesStats(tag string)` method. For instance, to retrieve all non-lazy queries, you can use the following code:

```go
simpleMetrics = engine.GetRegistry().GetPlugin(simple_metrics.PluginCode).(*simple_metrics.Plugin)
for _, query := range simpleMetrics.GetMySQLQueriesStats("") { // all non-lazy queries with default tag name
    query.Table // "Users"
    query.Pool // "default"
    query.Operation //query type, for instace simple_metrics.INSERT
    query.Counter // number of executed queries
    query.TotalTime // total execution time of all queries
    query.SlowQueries // number of queries reported as slow query
}
```

To better understand how queries are grouped, take a look at the example below:

```go
// we used  &simple_metrics.Options{MySQLSlowQueriesLimit: 2}

engine.Flush(&UserEntity{Name: "John"}) // took 2ms
engine.Flush(&UserEntity{Name: "Tom"}) // took 4ms
engine.FlushLazy(&UserEntity{Name: "Ivona"}) // took 7ms
engine.LoadByID(12, &UserEntity{})) // took 1ms

slowQueries :=  simpleMetrics.GetMySQLSlowQueriesStats()

slowQueries[0].Query // INSERT INTO UserEntity(Name) VALUES("Tom")
slowQueries[0].Pool // default
slowQueries[0].Duration // 4ms

slowQueries[1].Query // INSERT INTO UserEntity(Name) VALUES("Ivona")
slowQueries[1].Pool // default
slowQueries[1].Duration // 3ms

queries := simpleMetrics.GetMySQLQueriesStats(")

queries[0].Table // UserEntity
queries[0].Pool // default
queries[0].Operation // simple_metrics.INSERT
queries[0].Counter // 2
queries[0].TotalTime // 5ms
queries[0].SlowQueries // 2

queries[0].Table // UserEntity
queries[0].Pool // default
queries[0].Operation // simple_metrics.SELECT
queries[0].Counter // 1
queries[0].TotalTime // 1ms
queries[0].SlowQueries // 0

queries := simpleMetrics.GetMySQLQueriesStats("lazy")

queries[0].Table // UserEntity
queries[0].Pool // default
queries[0].Operation // simple_metrics.INSERT
queries[0].Counter // 1
queries[0].TotalTime // 7ms
queries[0].SlowQueries // 0
```

The grouped queries are ordered by the `TotalTime` field, starting from the highest value. This way, you can focus on the queries that take the most time and try to optimize them.

## Resetting statistics

o reset all stored statistics, use the `ClearMySQLStats()` method:

```go
simpleMetrics = engine.GetRegistry().GetPlugin(simple_metrics.PluginCode).(*simple_metrics.Plugin)
simpleMetrics.ClearMySQLStats()
```

This method will clear all previously collected data, including slow query logs and grouped query statistics.

## Disabling statistics

You can disable statistics for all queries executed by a single `beeorm.Engine` with `DisableMetrics` method:

```go
simple_metrics.DisableMetrics(engine)
```