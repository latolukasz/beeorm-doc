# Mysql queries

In this section you will learn how to run SQL queries in MySQL.
First we need to configure MySQL data pools and engine. In our example
we will create two pools - one with name `default` and another with name `users`:

```go
registry := beeorm.NewRegistry()
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/default_db")
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users", "users")
validatedRegistry, deferF, err := registry.Validate()
if err != nil {
    panic(err)
}
defer deferF()
engine := validatedRegistry.CreateEngine()
```

## MySQL data pool

Now we are ready to get MySQL data pool that is used to execute all queries.
This pool also provides few useful methods:

```go
db := engine.GetMysql()
config := db.GetPoolConfig()
config.GetCode() // "default"
config.GetDatabase() // "default_db"
config.GetDataSourceURI() // "user:password@tcp(localhost:3306)/default_db"
config.GetVersion() // 5 for MySQL 5.x, 8 for MySQL 8.x and so on
```

## Executing modification queries

Use ``Exec()`` method to run queries that modify data in MySQL:

```go{2,6,10,15}
db := engine.GetMysql()
result := db.Exec("INSERT INTO `Cities`(`Name`, `CountryID`) VALUES(?, ?)", "Berlin", 12)
result.LastInsertId() // 1
result.RowsAffected() // 1

result = db.Exec("INSERT INTO `Cities`(`Name`, `CountryID`) VALUES(?, ?),(?, ?)", "Amsterdam", 13, "Warsaw", 14)
result.LastInsertId() // 3
result.RowsAffected() // 2

result = db.Exec("UPDATE `Cities` SET `Name` = ? WHERE ID = ?", "New York", 1)
result.LastInsertId() // 0
result.RowsAffected() // 1

dbUsers := engine.GetMysql("users")
dbUsers.Exec("DELETE FROM `Users` WHERE `Status` = ?", "rejeceted")
result.LastInsertId() // 0
result.RowsAffected() // 0
```


BeeORM `Exec` supports [multi statements](https://github.com/go-sql-driver/mysql#multistatements)
but be aware you can define attributes (`?`) only in first query. Check below example: 

```go
db := engine.GetMysql()
queries := `
UPDATE Cities SET Name = 'Paris' WHERE ID = 12;
UPDATE Cities SET Name = 'London' WHERE ID = 13;
DELETE FROM Cities WHERE ID > 100;
`
db.Exec(queries) // works

queries = `
UPDATE Cities SET Name = ? WHERE ID = ?;
UPDATE Cities SET Name = 'London' WHERE ID = 13;
`
db.Exec(queries, "Paris", 12) // works

queries = `
UPDATE Cities SET Name = "Paris" WHERE ID = 12;
UPDATE Cities SET Name = ? WHERE ID = ?;
`
db.Exec(queries, "London", 13) // panics
```

:::warning
While BeeORM allows batch queries, it also greatly increases the risk of SQL injections.
Be sure you are always validating and escaping values used in batch query. Especially
`string` values provided by application users (from web form for instance). You can use
``tools.EscapeSQLParam()`` method to escape string values:

```go
import "github.com/latolukasz/beeorm/tools"

query := "UPDATE Cities SET Name =" + tools.EscapeSQLParam(name1) + ";"
query (= "UPDATE Cities SET Name =" + tools.EscapeSQLParam(name2) + ";"
engine.GetMysql().Exec(query)
```
:::

## Query one row

Use ``QueryRow()`` method to run query which returns only one row:

```go{5}
db := engine.GetMysql()
where := beeorm.NewWhere("SELECT ID, Name FROM Cities WHERE ID = ?", 12)
var id uint64
var name string
found := db.QueryRow(where, &id, &name)
```

## Query many rows

Use ``Query()`` method to run query which return many rows:

```go{4}
db := engine.GetMysql()
var id uint64
var name string
results, close := db.Query("SELECT ID, Name FROM Cities WHERE ID > ? LIMIT 100", 20)
results.Columns() // []string{"ID", "Name"}
for results.Next() {
    results.Scan(&id, &name)
}
close() // never forget to close query when finished
```

## Transactions

Working with transaction is very easy:

```go
db := engine.GetMysql()

func() {
    db.Begin() 
    defer db.Rollback()
    db.IsInTransaction() // true
    // execute some queries
    db.Commit()
    db.IsInTransaction() // false
}()
```

:::tip
Always put `defer db.Rollback()` after `db.Begin()`.
:::

Never run modification queries from MySQL data pool (`Exec()`) that
change entities which are using caching layer:

<code-group>
<code-block title="code">
```go{2}
var user *UserEntity
ids := engine.SearchIDs(beeorm.NewWhere("Age >= ?", 18), beeorm.NewPager(1, 10), user)
for _, id := range ids {
    fmt.Printf("ID: %d\n", id)
}
```
</code-block>

<code-block title="sql">
```sql
SELECT `ID` FROM `UserEntity` WHERE FirstName = "Adam" LIMIT 0,10
```
</code-block>
</code-group>
