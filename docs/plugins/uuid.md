# UUID

By default, all MySQL tables use `PRIMARY KEY AUTO_INCREMENT`, which means that the MySQL server automatically generates a new, unique number (ID) every time a new row is created. While this is simple and easy to use, it also comes with a few limitations:

* When one entity holds a reference to another entity and you are inserting both entities at the same time, two queries need to be executed. First, the referenced entity is added, and when the ID is generated, this ID is used in the second entity. For example:

```go
father := &PersonEntity{Name: "John Conan"}
son := &PersonEntity{Name: "Adam Smith", Father: father}
engine.Flush(son, father)
```

```sql
INSERT INTO PersonEntity(Name, Father) VALUES("John Conan", NULL); // ID = 1
// sends another query to MySQL
INSERT INTO PersonEntity(Name, Father) VALUES("Adam Smith", 1);
```

* When a new entity is [flushed lazy](/guide/lazy_flush.html), the ID is not generated and you cannot use it in your code after FlushLazy() is executed. For example:

```go{3}
user := ProductEntity{Name: "Shoe"}
engine.FlushLazy(user)
user.GetID() //panics
```

## Enabling UUID

This plugin provides an option to use generated UUID instead of MySQL's auto-incrementing values for the ID of an entity. To do this, simply register plugin and add the `uuid` tag to the `beeorm.ORM` field:

```go{7}
package main

import "github.com/latolukasz/beeorm/v2/plugins/uuid"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterPlugin(uuid.Init(nil)) 
} 

```go{2}
type PersonEntity struct {
	beeorm.ORM  `orm:"uuid"`
	Name string `orm:"required"`
	Father *PersonEntity
}
```

The above entity will create a table with an ID column defined as bigint unsigned NOT NULL. As you can see, AUTO_INCREMENT is missing, and BeeORM will be responsible for generating the ID using a function similar to [MySQL's uuid_short()](https://dev.mysql.com/doc/refman/8.0/en/miscellaneous-functions.html#function_uuid-short).

There is one limitation to using uuid: if you are running your application with more than one binary at the same time, you must define a unique `UUIDServerID` in each application:

```go
// first applications
registry.RegisterPlugin(uuid.Init(&uuid.Options{UUIDServerID: 0})) 
// second applications
registry.RegisterPlugin(uuid.Init(&uuid.Options{UUIDServerID: 1})) 
```

You can define the `UUIDServerID` to be any value between 0 and 255. This means you can run up to 256 binary applications at the same time with the uuid functionality enabled.

You can also change the tag name using plugin options:

```go{1,5}
pluginOptions := &uuid.Options{TagName: "enable-uuid"}
registry.RegisterPlugin(uuid.Init(pluginOptions)) 

type CarEntity struct {
    beeorm.ORM `orm:"enable-uuid"`
    Name       string
}
```

## Benefits of using UUID

With UUID enabled, all of the limitations described at the beginning of this page can be solved, as demonstrated in the following examples:

```go
father := &PersonEntity{Name: "John Conan"}
son := &PersonEntity{Name: "Adam Smith", Father: father}
engine.Flush(son, father)
```

```sql
// all these queries are sent as one multi-query to MySQL:
INSERT INTO PersonEntity(ID, Name, Father) VALUES
(28025074678235140", Adam Smith", 28025074678235141),
(28025074678235141, "John Conan", NULL);
```

```go
user := ProductEntity{Name: "Shoe"}
engine.FlushLazy(user)
user.GetID() // returns valid id 
```