# Log tables

In many applications it's required to log all data changes.
BeeORM provides a feature called `log table` that helps you store
all changes in special MySQL log table. 

In our example we will use `UserEntity`:

```go
type UserEntity struct {
    beeorm.ORM
    ID        uint
    Name      string
}
```

## Enabling log table

To enable log table simply add `log` tag for `beeorm.ORM` field:

```go{2}
type UserEntity struct {
    beeorm.ORM `orm:"log"`
    ID         uint
    Name       string
}
```
Now when you run [database schema update](/guide/schema_update.html#updating-database-schema)
new table will be created:

```sql
CREATE TABLE `_log_default_UserEntity` (
  `id` bigint(11) unsigned NOT NULL AUTO_INCREMENT,
  `entity_id` int(10) unsigned NOT NULL,
  `added_at` datetime NOT NULL,
  `meta` json DEFAULT NULL,
  `before` json DEFAULT NULL,
  `changes` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `entity_id` (`entity_id`)
) ENGINE=InnoDB CHARSET=utf8mb4 ROW_FORMAT=COMPRESSED KEY_BLOCK_SIZE=8;
```

As you can see this table starts with `_log` prefix followed 
by [MySQL data pool](/guide/validated_registry.html#getting-mysql-pools) name and
entity name.

By default log table will be created in the same MySQL database where entity table is 
located. You can define which MySQL database (data pool) should be used to store this table:

<code-group>
<code-block title="entity">
```go{2}
type UserEntity struct {
    beeorm.ORM `orm:"log=logs"`
    ID         uint
    Name       string
    Age        uint8
}
```
</code-block>

<code-block title="registry">
```go
registry := beeorm.NewRegistry()
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/logs", "logs")
```
</code-block>
</code-group>

:::tip
It's a good practice to use dedicated database or even MySQL
server to store all log tables (see example above).
:::

## Consuming log events

Now, whe our `UserEntity` entity has `log tagle` enabled, it's time to
save some data and see our first logs:

```go
engine.Flush(&UserEntity{Name: "Adam", Age 39})
```

All entity changes automatically publish special event to 
[redis stream](/guide/event_broker.html) that are consumed in
[background consumer](/guide/background_consumer.html). You must run
at least one [background consumer](/guide/background_consumer.html) when
`log table` feature is used:

```go
beeorm.NewBackgroundConsumer(engine).Digest(context.Background())
```

Let's see what we can find in `_log_default_UserEntity` table:

```sql
SELECT * FROM _log_default_UserEntity\G;

*************************** 1. row ***************************
       id: 1
entity_id: 1
 added_at: "2021-06-30 12:48:59"
     meta: NULL
   before: NULL
  changes: {"Name": "Adam", "Age": 39}
```

Log tables has 6 columns:
 * `id` - primary key of log table
 * `entity_id` - primary key of entity
 * `added_at` - date time when entity was changed
 * `meta` - [log meta data](/guide/log_tables.html#log-meta)
 * `before` - json with map that holds all entity fields that were changed with old values 
   (before change). `NULL` when entity was inserted into table.
 * `changes` - json with map that holds all entity fields that were changed with new values
   (after change). `NULL ` when entity was removed from table.
   
Now let's update our user:

```go
user.Age = 18
engine.Flush()
```

```sql
SELECT * FROM _log_default_UserEntity WHERE id = 2\G;

*************************** 1. row ***************************
       id: 2
entity_id: 1
 added_at: "2021-06-30 12:49:00"
     meta: NULL
   before: {"Age": 39}
  changes: {"Age": 18}
```

At the end we will remove our entity:

```go
engine.Delete(user)
```

```sql
SELECT * FROM _log_default_UserEntity WHERE id = 3\G;

*************************** 1. row ***************************
       id: 3
entity_id: 1
 added_at: "2021-06-30 12:49:01"
     meta: NULL
   before: {"Name": "Adam", "Age": 18}
  changes: NULL
```

## Log meta data

You can store extra data in log table:

```go{2,3}
user := &UserEntity{Name: "Tom", Age 20}
user.SetEntityLogMeta("ip", "213.22.11.24")
user.SetEntityLogMeta("admin_id", 77)
engine.Flush(user)
```

```sql{7}
SELECT * FROM _log_default_UserEntity\G;

*************************** 1. row ***************************
       id: 1
entity_id: 1
 added_at: "2021-06-30 12:48:59"
     meta: {"ip": "213.22.11.24", "admin_id": 77}
   before: NULL
  changes: {"Name": "Adam", "Age": 39}
```

You can also register global log meta data in `beeorm.Engine`:

```go{1}
engine.SetLogMetaData("ip", "213.22.11.24")
user1 := &UserEntity{Name: "Tom", Age 20}
user2 := &UserEntity{Name: "John", Age 30}
user2.SetEntityLogMeta("admin_id", 77)
engine.FlushMany(user1, user2)
```

```sql{7,14}
SELECT * FROM _log_default_UserEntity\G;

*************************** 1. row ***************************
       id: 1
entity_id: 1
 added_at: "2021-06-30 12:48:59"
     meta: {"ip": "213.22.11.24"}
   before: NULL
  changes: {"Name": "Tom", "Age": 20}
*************************** 2. row ***************************
       id: 2
entity_id: 2
 added_at: "2021-06-30 12:48:59"
     meta: {"ip": "213.22.11.24", "admin_id": 77}
   before: NULL
  changes: {"Name": "John", "Age": 30}  
```

## Skipping fields in log

If you don't need to track changes for specific entity
field you can use `skip-log` tag:

```go{5}
type UserEntity struct {
    beeorm.ORM `orm:"log"`
    ID          uint
    Name        string
    LastLogin   time.Time `orm:"skip-log"`
}
```

Now when you are updating `UserEntity` and only `LastLogin`
is changed no log entry will be added into log table:

```go
user.LastLogin = time.Now()
engine.Flush()
```

```sql
SELECT * FROM _log_default_UserEntity WHERE\G;

*************************** 0. row ***************************
```

```go
user.Name = "Lucas"
engine.Flush()
```

```sql
SELECT * FROM _log_default_UserEntity WHERE\G;

*************************** 1. row ***************************
       id: 2
entity_id: 1
 added_at: "2021-06-30 12:49:00"
     meta: NULL
   before: {"Name": "Tom"}
  changes: {"Name": "Lucas"}
```

## Log channel

By default all log events are published into
`orm-log-channel` [redis channel](/guide/event_broker.html#registering-streams) 
in `default` redis [server pool](/guide/data_pools.html#redis-server-pool) and are
consumed by `orm-async-consumer` consumer group. 
You can define this channel in another redis server pool if needed. You must use
`orm-log-channel` as channel name and `orm-async-consumer` as consumer group name:

<code-group>
<code-block title="code">
```go{3}
registry := beeorm.NewRegistry()
registry.RegisterRedis("192.123.11.12:6379", "", 0, "log")
registry.RegisterRedisStream("orm-log-channel", "log", []string{"orm-async-consumer"})
```
</code-block>

<code-block title="yaml">
```yml{4,5}
log:
    redis: 192.123.11.12:6379
    streams:
        orm-log-channel:
          - orm-async-consumer
```
</code-block>
</code-group>

## Forcing log

You can also force BeeORM to enable log in all registered entities:

```go{3}
registry := beeorm.NewRegistry()
 // provide db pool name used to store log tables
registry.ForceEntityLogInAllEntities("default")
```

## extra consumer

You can also register extra consumer group that can be used to track changes in entity. In
belov example we are adding `my-consumer` consumer group: 

<code-group>
<code-block title="code">
```go{3}
registry := beeorm.NewRegistry()
registry.RegisterRedis("192.123.11.12:6379", "", 0)
registry.RegisterRedisStream("orm-log-channel", "default", []string{"orm-async-consumer", "my-consumer"})
```
</code-block>

<code-block title="yaml">
```yml{6}
default:
    redis: 192.123.11.12:6379
    streams:
        orm-log-channel:
          - orm-async-consumer
          - my-consumer
```
</code-block>
</code-group>

Consumer group example:

```go
var logEvent beeorm.LogQueueValue
consumer := engine.GetEventBroker().Consumer("my-consumer")
consumer.Consume(context.Background(), 10, func(events []Event) {
    for _, event := range events {
	    event.Unserialize(&logEvent)
	    logEvent.PoolName // log table MySQL pool name
	    logEvent.TableName // log table name
	    logEvent.ID // primary key of entity
	    logEvent.LogID // primary key of log entry
	    logEvent.Meta // log meta data
	    logEvent.Before // old entity values
	    logEvent.Changes // new entity values
	    logEvent.Updated // datetime of the change
	    
	    if logEvent.TableName == "_log_default_UserEntity" { // UserEntity
	        if logEvent.Before != nil && logEvent.Changes != nil { // update
	            if has { // Name was changesd
	                new := logEvent.Changes["Name"]
	                fmt.Printf("USER %d CHANGED NAME FROM %s TO %s\n", logEvent.ID, old, new)
	            }
	        }
	    }
	}
})
```
