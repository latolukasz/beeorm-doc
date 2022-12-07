# UUID

By default all MySQL tables use `PRIMARY KEY AUTO_INCREMENT. It means
that MySQL server is responsible to automatically generate new unique number (ID) for
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

Rest soon...