# Mysql queries

In this section you will learn how to run SQL queries in MySQL.
First we need to configure MySQL data pools and engine. In our example
we will create two pools - one with name `default` and another with name `users`:

```go
registry := beeorm.NewRegistry()
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/default_db")
registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/users", "users")
validatedRegistry, err := registry.Validate(context.Background())
if err != nil {
    panic(err)
}
engine := validatedRegistry.CreateEngine(context.Background())
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
``EscapeSQLParam()`` method to escape string values:

```go
TODO
```
:::

## Query one row

TODO

## Query many rows

TODO

## Transactions

TODO


TODO do not use because of cache
