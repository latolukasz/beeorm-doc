# MySQL Indexes

In this section, you will learn how to define MySQL table indexes using BeeORM

## One Field in One Index

In BeeORM, you can easily add each field to a MySQL index using special tags:
 * `orm:"index=IndexName"` for a non-unique index
 * `orm:"unique=IndexName"` for a unique index

For example, the following Go code defines a PersonEntity struct with three indexes:

```go{5-6}
type PersonEntity struct {
    beeorm.ORM
    ID      uint
    Name    string
    Age     uint8 `orm:"index=age"` 
    Email   string `orm:"unique=email;required"` 
    Mother  *PersonEntity
}
```

This will create the following indexes in the MySQL table:

```sql
  KEY `age` (`Age`),
  UNIQUE KEY `email` (`Email`),
  KEY `Mother` (`Mother`),
```

Note that you don't need to define an index for one-to-one references (Mother) in BeeORM. It will create the index automatically, as it is required to create [foreign indexes](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html).

## Many Fields in One Index

Sometimes you may need to add more than one field to a single index. In BeeORM, you can do this by using the same index name for all fields and adding an extra suffix `:X`, where `X` is the position of the field within the index (starting from 1). You can skip the suffix for the first field (which is equivalent to using :1).

For example, the following Go code defines a ShoeEntity struct with a single unique index spanning three fields:

```go{4-6}
type ShoeEntity struct {
    beeorm.ORM
    ID       uint
    Name     string `orm:"unique=model"`
    Color    string `orm:"unique=model:2"`
    Size     uint8 `orm:"unique=model:3"`
}
```

This will create the following unique index in the MySQL table:

```sql
  UNIQUE KEY `model` (`Name`, `Color`, `Size`),
```

## One field in many indexes

If you need to add single field in more than one index separate names with comma:

```go{5-6}
type PersonEntity struct {
    beeorm.ORM
    ID          uint
    FirstName   string `orm:"index=name:2"`
    LastName    string `orm:"index=name,occupation:2;unique=lastname"`
    Occupation  string `orm:"index=occupation"`
}
```

```sql
  KEY `model` (`LastName`, `FirstName`),
  KEY `occupation` (`Occupation`, `LastName`),
  UNIQUE KEY `lastname` (`LastName`),
```

## Defining index in subfields 

There is one scenario where it's not possible to define
indexes using field tags. See below example:

```go
struct Address {
   Country    string
   City       string
   Street     string
   Building   uint
   PostalCode string
}

type UserEntity struct {
    beeorm.ORM
    ID             uint
    HomeAddress    Address
    WorkAddress    Address
}
```

What if we need these indexes:
```sql
KEY `homeStreet` (`HomeAddressStreet`),
KEY `workAddress` (`WorkAddressCity`, `WorkAddressStreet`),
```

BeeORM supports defining indexes as tag attributes for `orm.ORM` field:

```go{2}
type UserEntity struct {
    beeorm.ORM     `orm:"index=homeStreet:HomeAddressStreet|workAddress:WorkAddressCity,WorkAddressStreet"`
    ID             uint
    HomeAdddress   Address
    WorkAddress    Address
}
```
