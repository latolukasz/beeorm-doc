# Log tables

In many applications it's required to log all data changes.
BeeORM provides a feature called that helps you store
all changes in special MySQL log [archive](https://dev.mysql.com/doc/refman/8.0/en/archive-storage-engine.html) table. 

In our example we will use `UserEntity`:

```go
type UserEntity struct {
    ID        uint64
    Name      string
}
```

## Enabling log table

To enable log table simply register `beeorm.LogEntity` with a `UserEntity` attribute:

```go{2}
registry := beeorm.NewRegistry()
registry.RegisterEntity(beeorm.LogEntity[UserEntity]{})
```
Now when you run [database schema update](/guide/schema_update.html#updating-database-schema)
new table will be created:

```sql
CREATE TABLE `_LogEntity_default_UserEntity` (
  `ID` bigint unsigned NOT NULL AUTO_INCREMENT,
  `EntityID` bigint unsigned NOT NULL DEFAULT '0',
  `Date` datetime NOT NULL DEFAULT '1000-01-01 00:00:00',
  `Meta` blob,
  `Before` blob,
  `After` blob,
  PRIMARY KEY (`ID`)
) ENGINE=ARCHIVE DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=COMPRESSED KEY_BLOCK_SIZE=8;
```

As you can see this table starts with `_LogEntity` prefix followed 
by [MySQL data pool](/guide/validated_registry.html#getting-mysql-pools) name and
entity name.

By default log table will be created in `default` MySQL pool. 
You can define which MySQL database (data pool) should be used to store this table by adding `log-pool` tag:

```go{2}
type UserEntity struct {
    beeorm.ORM `orm:"log-pool=logs"`
    ID         uint
    Name       string
    Age        uint8
}
```

:::tip
It's a good practice to use dedicated database or even MySQL
server to store all log tables (see example above).
:::

## Consuming log events

Now it's time to save some data and see our first logs:

```go
user := beeorm.NewEntity[UserEntity](c)
user.Name = "Adam"
user.Age = 39
c.Flush()
```

All entity changes automatically generates [async queries](/guide/async_flush.html) to log table so
you must [consume events](/guide/async_flush.html#consuming-async-queries) with `ConsumeAsyncFlushEvents()` function.


Let's see what we can find in `__LogEntity_default_UserEntity` table:

```sql
SELECT * FROM _LogEntity_default_UserEntity\G;

*************************** 1. row ***************************
       ID: 1
 EntityID: 1
     Date: "2021-06-30 12:48:59"
     Meta: NULL
   Before: NULL
   After: {"Name": "Adam", "Age": 39}
```

Log tables has 6 columns:
 * `ID` - primary key of log table
 * `EntityID` - primary key of entity
 * `Date` - date time when entity was changed
 * `Meta` - [log meta data](/guide/log_tables.html#log-meta-data)
 * `Before` - json with map that holds all entity fields that were changed with old values 
   (before change). `NULL` when entity was inserted into table.
 * `After` - json with map that holds all entity fields that were changed with new values
   (after change). `NULL ` when entity was removed from table.
   
Now let's update our user:

```go
user = beeorm.EditEntity(c, user)
user.Age = 18
c.Flush()
```

```sql
SELECT * FROM _LogEntity_default_UserEntity WHERE ID = 2\G;

*************************** 1. row ***************************
       ID: 2
 EntityID: 1
     Date: "2021-06-30 12:49:00"
     Meta: NULL
   Before: {"Age": 39}
    After: {"Age": 18}
```

At the end we will remove our entity:

```go
beeorm.DeleteEntity(c, entity)
c.Flush()
```

```sql
SELECT * FROM _LogEntity_default_UserEntity WHERE ID = 3\G;

*************************** 1. row ***************************
       ID: 3
 EntityID: 1
     Date: "2021-06-30 12:49:01"
     Meta: NULL
   Before: {"Name": "Adam", "Age": 18}
    After: NULL
```

## Log meta data

You can  register log meta data in `beeorm.Context`:

```go{1}
c.SetMetaData("ip", "213.22.11.24")
user := beeorm.NewEntity[UserEntity](c)
user.Name = "Tom"
user.Age = 20
c.Flush()
c.Flush()
```

```sql
SELECT * FROM _LogEntity_default_UserEntity\G;

*************************** 1. row ***************************
       ID: 1
 EntityID: 1
     Date: "2021-06-30 12:48:59"
     Meta: {"ip": "213.22.11.24"}
   Before: NULL
    After: {"Name": "Tom", "Age": 20}
```