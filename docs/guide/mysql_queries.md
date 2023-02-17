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
defer close()
results.Columns() // []string{"ID", "Name"}
for results.Next() {
    results.Scan(&id, &name)
}
```

:::warning
Remember to include a `defer close()` after every `db.Query()` call. Failing to do so will result in the inability to run queries to MySQL, as all open database connections will be occupied.
:::

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

## Prepared statements

Using MySQL prepared statements  with BeeORM is straightforward:

```go
db := engine.GetMysql()
preparedStatement, close := db.Prepare("INSERT INTO `UserEntity(`Name`, `Age`)` VALUES(?,?)")
defer close()
res := preparedStatement.Exec("Tom", 12)
res.LastInsertId() // 1
res = preparedStatement.Exec("Ivona", 33)
res.LastInsertId() // 2
```

```go
db := engine.GetMysql()
preparedStatement, close := db.Prepare("SELECT `ID`, `Name` FROM `UserEntity WHERE `ID` = ?")
defer close()
id := 0
name := "
preparedStatement.QueryRow([]interface{}{1}, &id, &name)
preparedStatement.QueryRow([]interface{}{2}, &id, &name)
```

```go
db := engine.GetMysql()
preparedStatement, close := db.Prepare("SELECT `ID`, `Name` FROM `UserEntity WHERE `ID` > ?")
defer close()
id := 0
name := "
results, queryClose := preparedStatement.Query(2)
defer queryClose()
for results.Next() {
    results.Scan(&id, &name)
}
```
