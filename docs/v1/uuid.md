# UUID

By default, all MySQL tables use `PRIMARY KEY AUTO_INCREMENT`, which means that the MySQL server automatically generates a new, unique number (ID) every time a new row is created. While this is simple and easy to use, it also comes with a few limitations:

 * When one entity holds a reference to another entity and you are inserting both entities at the same time, two queries need to be executed. First, the referenced entity is added, and when the ID is generated, this ID is used in the second entity. For example:

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

 * When a new entity is [flushed lazy](/guide/lazy_crud.html#lazy-flush), the ID is not generated and you cannot use it in your code after FlushLazy() is executed. For example:

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

BeeORM provides an option to use generated UUID instead of MySQL's auto-incrementing values for the ID of an entity. To do this, simply add the `uuid` tag to the `beeorm.ORM` field and define the ID field as a `uint64`:

```go{2,3}
type PersonEntity struct {
	beeorm.ORM  `orm:"uuid"`
	ID   uint64
	Name string `orm:"required"`
	Father *PersonEntity
}
```

If you use the uuid tag in an entity with an ID field that is not a uint64, an exception will be thrown.

The above entity will create a table with an ID column defined as bigint unsigned NOT NULL. As you can see, AUTO_INCREMENT is missing, and BeeORM will be responsible for generating the ID using a function similar to [MySQL's uuid_short()](https://dev.mysql.com/doc/refman/8.0/en/miscellaneous-functions.html#function_uuid-short).

There is one limitation to using uuid: if you are running your application with more than one binary at the same time, you must define a unique `UUIDServerID` in each application:

```go
// first applications
beeorm.SetUUIDServerID(0)
// second applications
beeorm.SetUUIDServerID(1)
```

You can define the `UUIDServerID` to be any value between 0 and 255. This means you can run up to 256 binary applications at the same time with the uuid functionality enabled.
 
## Benefits of using UUID

With UUID enabled, all of the limitations described at the beginning of this page can be solved, as demonstrated in the following examples:


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

