# UUID

By default all MySQL tables use `PRIMARY KEY AUTO_INCREMENT. It means
that MySQL server is responsible to automatically generate new unique number (ID) 
every time new row is created. It's simple and easy to use, but also it comes with few
limitations:

 * When one entity holds reference to another entity (with foreign key) and you are inserting both entities at
at the same time then two queries needs to be executed. First referenced entity is added, and when ID is generated
this ID is used in second entity.

<code-group>
<code-block title="code">
```go
address := &AddressEntity{Street: "Blue bird 23", City: "New York"}
person := &PersonEntity{Name: "Adam Smith", Address: address}
engine.FlushMany(person, address)
```
</code-block>

<code-block title="queries">
```sql
INSERT INTO AddressEntity(Street, City) VALUES("Blue bird 23", "New York"); // ID = 1
// sends another query to MySQL
INSERT INTO PersonEntity(Name, Address) VALUES("Adam Smith", 1);
```
</code-block>
</code-group>

 * When new entity (that needs to be inserted in table) is [flushed lazy](/guide/lazy_crud.html#lazy-flush) 
insert query `is not` add to queue, instead query is executed at the same time when
`engine.FlushLazy()` is executed. Only entity updates and deletes are added to queue and
executed in background (in another goroutine). If your application generates many inserts
it may cause performance issues.

<code-group>
<code-block title="code">
```go
address := &AddressEntity{Street: "Blue bird 23", City: "New York"}
person := &PersonEntity{Name: "Adam Smith", Address: address}
engine.FlushLazyMany(person, address)
```
</code-block>

<code-block title="queries">
```sql
INSERT INTO AddressEntity(Street, City) VALUES("Blue bird 23", "New York"); // ID = 1
// sends another query to MySQL
INSERT INTO PersonEntity(Name, Address) VALUES("Adam Smith", 1);
```
</code-block>
</code-group>

## Enabling UUID

You can solve above issues using special tag `uuid`:

```go{2,9}
type AddressEntity struct {
	ORM  `orm:"uuid"`
	ID   uint64 // ID must be uint64
	Street string `orm:"required"`
	City string `orm:"required"`
}

type PersonEntity struct {
	ORM  `orm:"uuid"`
	ID   uint64
	Name string `orm:"required"`
	Address *AddressEntity `orm:"required"`
}
```

Notice field `ID` is type of `uint64`. If you use `uuid` tag in entity which has
`ID` different than `uint64` exception is thrown.

Above entity creates table where `ID` is defined as `bigint unsigned NOT NULL`. 
As you can see `AUTO_INCREMENT` is missing. From now BeeORM is responsible to 
generate ID using function similar to [MySQL uuid_short()](https://dev.mysql.com/doc/refman/8.0/en/miscellaneous-functions.html#function_uuid-short).

There is one big limitation. If you are running your application
using more than one binary at once you must define unique `UUIDServerID` in each
application:

```go
// first applications
beeorm.SetUUIDServerID(0)
// second applications
beeorm.SetUUIDServerID(1)
```

You can define UUIDServerID between 0 and 255. It means 
you can run ap to 256 binary applications at the same time when
uuid functionality is enabled.

## Benefits using UUID

It's worth to spend some time and enable UUID in your code, because
you can handle even bigger traffic. Below you can see how
all limitations described at the beginning of this page are solved with
UUID enabled:

<code-group>
<code-block title="code">
```go
address := &AddressEntity{Street: "Blue bird 23", City: "New York"}
person := &PersonEntity{Name: "Adam Smith", Address: address}
engine.FlushMany(person, address)
```
</code-block>

<code-block title="queries">
```sql
// all these queries are sent as one multi-query to MySQL:
INSERT INTO AddressEntity(ID, Street, City) VALUES(28025074678235139, "Blue bird 23", "New York");
INSERT INTO PersonEntity(ID, Name, Address) VALUES(28025074678235140", Adam Smith", 1);
```
</code-block>
</code-group>

<code-group>
<code-block title="code">
```go
address := &AddressEntity{Street: "Blue bird 23", City: "New York"}
person := &PersonEntity{Name: "Adam Smith", Address: address}
engine.FlushLazyMany(person, address)
```
</code-block>

<code-block title="queries">
```sql
// None:) both queries are added to lazy queue, and executed later.
```
</code-block>
</code-group>

