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

## Enabling UUID

You can solve above issues using special tag `uuid`:

```go{2}
type AddressEntity struct {
	ORM  `orm:"uuid"`
	ID   uint64 // ID must be uint64
	Street string `orm:"required"`
	City string `orm:"required"`
}
```