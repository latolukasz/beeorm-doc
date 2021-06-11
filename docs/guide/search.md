# Search

On previous page you learned how to load entities from database using their primary keys.
In this section you will learn how to search and load entities.

## Pager

It's a good practice to always limit number of rows used in search with sql 
``LIMIT`` condition. BeeORM provides special object ``Pager`` used to define 
proper SQL syntax in your queries:

```go
// load first 100 rows
pager := beeorm.NewPager(1, 100) // LIMIT 0, 100
pager.GetPageSize() // 100
pager.GetCurrentPage() // 1

// load next 100 rows (page nr 2)
pager = beeorm.NewPager(2, 100) // LIMIT 100, 100
pager.GetPageSize() // 100
pager.GetCurrentPage() // 2

pager.IncrementPage() // LIMIT 200, 100
pager.GetCurrentPage() // 3
```

## Where

Every SQL search query requires search conditions. 
You can define them with ``beeorm.Where`` object:

```go
// WHERE Email = "bee@beeorm.io" AND Age >= 18
where := beeorm.NewWhere("Email = ? AND Age >= ?", "bee@beeorm.io", 18)
where.String() // "Email = ? AND Age >= ?"
where.GetParameters() // []interface{}{"bee@beeorm.io", 18}

where.SetParameter(1, "lion@beeorm.io")
where.GetParameters() // []interface{}{"lion@beeorm.io", 18}

where.SetParameters("elephant@beeorm.io", 20)
where.GetParameters() // []interface{}{"elephant@beeorm.io", 20}

where.Append("AND Age <= ?", 60)
where.String() // "Email = ? AND Age >= ? AND Age <= ?"
where.GetParameters() // []interface{}{"elephant@beeorm.io", 20, 60}
```

You should also use ``beeorm.Where`` to define ``ORDEBY BY`` in query:

```go
// WHERE 1 ORDER BY Age
where := beeorm.NewWhere("1 ORDER BY Age")
// WHERE 1 ORDER BY Age > 10
where := beeorm.NewWhere("Age > ? ORDER BY Age", 10)
```
When you pass slice as an argument ``beeorm.Where`` converts it into
sql ``IN (?,?...)`` syntax making your life a bit simper:

```go
where := beeorm.NewWhere("Age in ?", []int{18, 20, 30})
where.String() // WHERE Age IN (?,?,?)
where.GetParameters() // []interface{}{18, 20, 30}
```
