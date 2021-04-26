# MySQL indexes

In this section you will learn how to define MySQL table indexes.

## One field in one index

In BeeORM you can easily add every field into MySQL index using special tags:
 * `orm:"index=IndexName"` for non-unique index
 * `orm:"unique=IndexName"` for unique index

```go{5-6}
type PersonEntity struct {
    beeorm.ORM
    ID      uint
    Name    string
    Age     uint8 `beeorm:"index=age"` 
    Email   string `beeorm:"unique=email;required"` 
    Mother  *PersonEntity
}
```

Above example creates three indexes:

```sql
  KEY `age` (`Age`),
  UNIQUE KEY `email` (`Email`),
  KEY `Mother` (`Mother`),
```


As you can see you don't need to define index for one-one references (`Mother`).
BeeORM creates index automatically, because index is required to create
[foreign indexes](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html).

## Many fields in one index

What if you need to add more than one field to one index. In this case use the same index name
in all index fields and add Extra suffix `:X`, where X is a field 
position in this index (starting from 1). You can skip this suffix for first fields (`:1`):

```go{4-6}
type ShoeEntity struct {
    beeorm.ORM
    ID       uint
    Name     string `beeorm:"unique=model"`
    Color    string `beeorm:"unique=model:2"`
    Size     uint8 `beeorm:"unique=model:3"`
}
```

```sql
  UNIQUE KEY `model` (`Name`, `Color`, `Size`),
```

## One field in many indexes

If you need to add single field in more than one index separate names with comma:

```go{5-6}
type PersonEntity struct {
    beeorm.ORM
    ID          uint
    FistName    string `beeorm:"index=name:2"`
    LastName    string `beeorm:"index=name,occupation:2;unique=lastname"`
    Occupation  string `beeorm:"index=occupation"`
}
```

```sql
  KEY `model` (`LastName`, `FistName`),
  KEY `occupation` (`Occupation`, `LastName`),
  UNIQUE KEY `lastname` (`LastName`),
```

## Complex index in subfields 

TODO

## Removing foreign key

You can instruct BeeORM to not create index
and foreign-key in one-one reference field with special tag `beeorm:"skip_FK"`:

```go{5}
type PersonEntity struct {
    beeorm.ORM
    ID      uint
    Name    string
    Mother  *PersonEntity `beeorm:"skip_FK"` 
}
