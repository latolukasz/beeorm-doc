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
    beeorm.ORM `beeorm:"log"`
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
    beeorm.ORM `beeorm:"log=logs"`
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
beeorm.NewBackgroundConsumer(engine).Digest()
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

## Define redis

TODO

## extra consumer
