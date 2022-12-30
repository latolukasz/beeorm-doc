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
father := &PersonEntity{Name: "John Conan"}
son := &PersonEntity{Name: "Adam Smith", Father: father}
engine.Flush(son, father)
```
</code-block>

<code-block title="queries">
```sql
INSERT INTO PersonEntity(Name, Father) VALUES("John Conan", NULL); // ID = 1
// sends another query to MySQL
INSERT INTO PersonEntity(Name, Father) VALUES("Adam Smith", 1);
```
</code-block>
</code-group>

 * When new entity is [flushed lazy](/guide/lazy_crud.html#lazy-flush) 
`ID` is not generated and you cann't use it in your code after `FlushLazy()` is executed.

<code-group>
<code-block title="code">
```go
user := ProductEntity{Name: "Shoe"}
engine.FlushLazy(user)
// bug, user.ID is still zero
c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf(""https://mysite.com/product/%d/", user.ID)) 
```
</code-block>

<code-block title="queries">
```
REDIS XAdd orm-lazy-channel event
```
</code-block>
</code-group>

## Enabling UUID

BeeORM provides an option to instruct Entity  to use generated `UUID` instead of MySQL auto incremental value.
Simply add `uuid` tag to `beeorm.ORM` field and define `ID` as `uint64`:

```go{2,9}
type PersonEntity struct {
	beeorm.ORM  `orm:"uuid"`
	ID   uint64
	Name string `orm:"required"`
	Father *PersonEntity
}
```

If you use `uuid` tag in entity which has
`ID` different than `uint64` exception is thrown.

Above entity creates table where `ID` is defined as `bigint unsigned NOT NULL`. 
As you can see `AUTO_INCREMENT` is missing. From now BeeORM is responsible to 
generate ID using function similar to [MySQL uuid_short()](https://dev.mysql.com/doc/refman/8.0/en/miscellaneous-functions.html#function_uuid-short).

There is one limitation. If you are running your application
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

Probably you ask yourself why BeeORM is using `uint64` UUID instead standard `UUID` text implementation (32 hexadecimal).
ID column in MySQL table uses `PRIMARY INDEX` that uses server memory. 32 hexadecimal UUID uses 128 bits, `uint64` uses 64 bits.
So `uint64` implementations uses twice less memory.
 
## Benefits using UUID

It's worth to spend some time and enable UUID in your code, because
you can handle even bigger traffic. Below you can see how
all limitations described at the beginning of this page are solved with
UUID enabled:

<code-group>
<code-block title="code">
```go
father := &PersonEntity{Name: "John Conan"}
son := &PersonEntity{Name: "Adam Smith", Father: father}
engine.Flush(son, father)
```
</code-block>

<code-block title="queries">
```sql
// all these queries are sent as one multi-query to MySQL:
INSERT INTO PersonEntity(ID, Name, Father) VALUES
(28025074678235140", Adam Smith", 28025074678235141),
(28025074678235141, "John Conan", NULL);
```
</code-block>
</code-group>

<code-group>
<code-block title="code">
```go
user := ProductEntity{Name: "Shoe"}
engine.FlushLazy(user)
// user.ID has valid UUID
c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf(""https://mysite.com/product/%d/", user.ID)) 
```
</code-block>

<code-block title="queries">
```
REDIS XAdd orm-lazy-channel event
```
</code-block>
</code-group>

