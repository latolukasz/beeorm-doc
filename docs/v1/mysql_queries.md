# MySQL Queries

In this section, you will learn how to run SQL queries in MySQL. First, we need to configure the MySQL data pools and engine. In our example, we will create two pools - one with the name `default` and another with the name `users`:

```go
registry := beeorm.NewRegistry()
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/default_db")
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users", "users")
validatedRegistry, err := registry.Validate()
if err != nil {
    panic(err)
}
engine := validatedRegistry.CreateEngine()
```

## MySQL Data Pool

Now we are ready to get the MySQL data pool that will be used to execute all queries. This pool also provides a few useful methods:

```go
db := engine.GetMysql()
config := db.GetPoolConfig()
config.GetCode() // "default"
config.GetDatabase() // "default_db"
config.GetDataSourceURI() // "user:password@tcp(localhost:3306)/default_db"
config.GetVersion() // 5 for MySQL 5.x, 8 for MySQL 8.x and so on
```

## Executing Modification Queries

To run queries that modify data in MySQL, use the `Exec()` method:

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
dbUsers.Exec("DELETE FROM `Users` WHERE `Status` = ?", "rejected")
result.LastInsertId() // 0
result.RowsAffected() // 0
```



BeeORM's `Exec()` method supports [multi-statements](https://github.com/go-sql-driver/mysql#multistatements), but keep in mind that you can only define attributes (`?`) in the first query. See the following example:

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


:::tip
Avoid running modification queries that change entities which are using the caching layer, as it will result in the entity data in the cache not being updated with the latest changes in MySQL. Instead, you should always use `Flush()` or `FlashLazy()`. Alternatively, after running a modification query with `Exec()`, you should clear the entity cache by, for example, clearing the Redis database. This will ensure that the cache reflects the most recent changes made to the data in MySQL.
:::

## Querying a Single Row

To run a query that returns only one row, use the `QueryRow()` method:

```go{5}
db := engine.GetMysql()
where := beeorm.NewWhere("SELECT ID, Name FROM Cities WHERE ID = ?", 12)
var id uint64
var name string
found := db.QueryRow(where, &id, &name)
```

## Querying Multiple Rows

To run a query that returns multiple rows, use the `Query()` method:

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

Working with transactions is straightforward:

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

:::warning
When using transactions, remember to use one instance of the engine for every transaction.
You can use `engine.Clone()`:

```go{10}
engine := .....
go func() {
    db := engine.GetMysql()
    db.Begin()
    ...
    db.Commit()
}()
go func() {
    //in second goroutine we are cloning engine
    db := engine.Clone().GetMysql()
    db.Begin()
    ...
    db.Commit()
}()
```
:::

## Setting a Query Execution Time Limit

By default, all MySQL queries have no time limitation. If a query takes 2 minutes, the `Query()` function will take 2 minutes to execute. You can define a time limit for all queries run from a single engine instance using the `SetQueryTimeLimit()` method:

```go
engine := .....
engine.SetQueryTimeLimit(5) //limit set to 5 seconds
engine.SetQueryTimeLimit(0) //limit removed (default value)
```

If a query takes longer than the specified time limit, BeeORM will panic with the message `query exceeded limit of X seconds`.
