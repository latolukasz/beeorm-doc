# Entity fields

Now you know how to create simple Entity that contains
only one field `ID`. In this section you will learn how to define
other fields and how these fields are stored in database.

By default, every public entity field (that starts with uppercase letter)
is stored in MySQL.

## Integers

Most go developers use `int` primitive type forgetting go has much more to offer, 
e.g. `int8, int16`, `uint`, `uint32`. BeeORM supports all of them.

```go{5-6}

type PersonEntity struct {
    beeorm.ORM
    ID                 uint
    Age                uint8
    BankAccountBalance int32
}
```

This table describes how integer fields are mapped to MySQL column types:
| go        | MySQL         | min value  | max value  |
| ------------- |:-------------:| -----:| -----:|
| int8      | tinyint  | -128 | 127 |
| int16      | smallint      |   -32768 | 32767 |
| int32 with tag `beeorm:"mediumint"` | mediumint      |    -8388608 | 8388607 |
| int32,int,rune | int      |    	-2147483648 | 	2147483647 |
| int64 | bigint      |    	-2<sup>63</sup> | 	2<sup>63</sup>-1 |
| uint8      | tinyint | 0 | 255 |
| uint16      | smallint      |   0 | 65535 |
| uint32 with tag `beeorm:"mediumint"` | mediumint      |    0 | 16777215 |
| uint32,uint | int      |    	0 | 	4294967295 |
| uint64 | bigint      |    	0 | 	2<sup>64</sup>-1 |
| uint16 with tag `beeorm:"year"` | year      |    [0 or 1901](https://dev.mysql.com/doc/refman/8.0/en/year.html) | 2155 |

::: tip
Always spend extra time to analise your data and choose best `int` type for every field:
 * if field contains only positive numbers always use unsigned type (`uint`, `uint16`...)
 * try to use as low bit type as possible. For example using `uin16` for `PersonAge` is wrong. 
   Use `uint8` because people are living no longer than 255 years. Maybe in near feature it will change 
   but for now it's a right choice:)
 * using correct type for primary keys (`ID`) and fields that are part of MySQL index is very important.
Using low but type is not only saving MySQL disk space but also memory used to cache index. 
:::

All above MySQL fields are defined as `NOT NULL DEFAULT '0'`. If you need to store also `NULL` value use
reference to int primitive type: `*int8`, `*int16`, `*in32`, `*int`, `*rune`, `*int64`, `*uint8`, `*uint16`, `*uin32`, 
`*uint`, `*uint64`. Then fields in MySQL are defined as `DEFAULT NULL`.

```go{7}

type PersonEntity struct {
    beeorm.ORM
    ID         uint
    // null if we don't know how many friends this person has
    // zero if noone likes him:)
    ID         *uint
}
```

## Floats

Working with float values is always challenging. In BeORM you should
use one of `float32` or `float64` primitive types. Then using special tags you
can decide how float value is stored in MySQL. Check example below:

```go{5-7}

type PersonEntity struct {
    beeorm.ORM
    ID          uint
    Balance     float64
    Temperature float32 `orm:"decimal=3,1;unsigned"`
    Weight      float32 `orm:"unsigned"`
}
```

| go        | MySQL         |
| ------------- |:-------------:|
| float32      | float  |
| float32 with tag `beeorm:"unsigned"` | float unsigned      |
| float64      | double  |
| float64 with tag `beeorm:"unsigned"` | double unsigned      |
| float32,float64 with tag `beeorm:"decimal=X,Y"`     | decimal(X,Y)  |
| float32,float64 with tag `beeorm:"decimal=X,Y;unsigned"`     | decimal(X,Y) unsigned  |

All above MySQL fields are defined as `NOT NULL`. If you need to store also `NULL` value use
reference to float primitive type: `*float32`, `*float64`. Then fields in MySQL are defined as `DEFAULT NULL`.

## Booleans

Working with booleans is very simple. Use `bool` type or `*bool` if MySQL
field can hold `NULL` values.

```go{5-7}

type PersonEntity struct {
    beeorm.ORM
    ID           uint
    Married      bool
    HasChidlren  *bool
}
```
| go        | MySQL         |
| ------------- |:-------------:|
| bool      | tinyint(1)  |

## Strings

If you need to store text use `string` type:

```go{5-7}

type ProductEntity struct {
    beeorm.ORM
    ID           uint
    Title        string `beeorm:"required;length=150"`
    Description  string `beeorm:"required;length=max"`
    Brand        string
}
```

| go        | MySQL         |
| ------------- |:-------------:|
| string      | varchar(255)  |
| string with tag `beeorm:"required"` | varchar(255) NOT NULL      |
| string with tag `beeorm:"length=X"` | varchar(X)      |
| string with tag `beeorm:"length=max"` | mediumtext      |
`
::: tip
Always add `beeorm:"required"`tag for `string` fields that never holds empty string.
Thanks to it you can save extra disc space used to store data in MySQL table.
:::

## Dates and time

If you want to store date or date with time use `time.Time`:

```go{5-7}

type UserEntity struct {
    beeorm.ORM
    ID              uint
    DateOfBirth     time.Time
    CreatedAt       time.Time `orm:"time"`
    UpdatedAt       *time.Time `orm:"time"`
}
```

| go        | MySQL         |
| ------------- |:-------------:|
| time.Time      | date NOT NULL |
| time.Time with tag `beeorm:"time"` | datetime NOT NULL      |
| *time.Time      | date |
| *time.Time with tag `beeorm:"time"` | datetime      |
`

## Binary strings

You can store binary strings using `[]uint8` type:

```go{5}

type UserEntity struct {
    beeorm.ORM
    ID              uint
    CVFileContent   []uint8
}
```

| go        | MySQL         |
| ------------- |:-------------:|
| []uint8      | blob |
| []uint8 with tag `beeorm:"mediumblob"` | mediumblob      |
| []uint8 with tag `beeorm:"longblob"` | longblob      |

## Enums and sets

If one of your field contains text from
predefined list you should use MySQL `ENUM` or `SET` field type to store it.

### Example using structs (recommended):

If you use struct as a set/enum definition 
BeeORM search for all public fields with type of `string` int this struct
and use them as values. First field is used as default one when field has 
tag `beeorm:"required"`.

```go{5-13,18-19,24}
package main

import "github.com/latolukasz/beeorm"

var Colors = struct{
	Red    string
	Blue   string
	Yellow string
}{
	Red:    "red",
	Blue:   "blue",
	Yellow: "yellow",
}

type UserEntity struct {
    beeorm.ORM
    ID              uint
    FavoriteColor   string `beeorm:"enum=colors;required"`
    HatedColors     []string `beeorm:"set=colors"`
}

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterEnumStruct("colors", Colors) // default firts field "red"
   registry.RegisterEnumStruct("colors_default_blue", Colors, Colors.Blue) // "blue" is used as default
   registry.RegisterEntity(&UserEntity{})
}
```
| go        | MySQL         |
| ------------- |:-------------:|
| string with tag `beeorm:"enum=colors"` | enum('red', 'blue', 'yellow') DEFAULT NULL     |
| string with tag `beeorm:"enum=colors;required"` | enum('red', 'blue', 'yellow') NOT NULL DEFAULT 'red'     |
| []string with tag `beeorm:"set=colors"` | set('red', 'blue', 'yellow') DEFAULT NULL     |
| []string with tag `beeorm:"set=colors;required"` | enum('red', 'blue', 'yellow') NOT NULL DEFAULT 'red'     |

### Example using list of values:

Second argument is used as default value when `beeorm:"required"` tag is used.

```go{8-9,14}
package main

import "github.com/latolukasz/beeorm"

type UserEntity struct {
    beeorm.ORM
    ID              uint
    FavoriteColor   string `beeorm:"enum=colors;required"`
    HatedColors     []string `beeorm:"set=colors"`
}

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterEnum("colors", []string{"red", "blue", "yellow"}) // default is "red"
   registry.RegisterEnum("colors_default_yellow", []string{"red", "blue", "yellow"}, "yellow") // default is "yellow"
   registry.RegisterEntity(&UserEntity{})
}
```

## One-one reference

In BeORM you can easily define one-one reference between two entities.
All you need to do is define public field with type of referenced entity:

```go{11}
type CategoryEntity struct {
    beeorm.ORM
    ID     uint16
    Name   string  `beeorm:"required"`
}

type ProductEntity struct {
    beeorm.ORM
    ID       uint
    Name     string  `beeorm:"required"`
    Category *CategoryEntity `beeorm:"required"`
}
```

In above example BeORM creates column `Category smallint NOT NULL`.
If field can store `NULL` values simply don't use `beeorm:"required"` tag.

BeORM creates index and [foreign key](https://dev.mysql.com/doc/refman/5.6/en/create-table-foreign-keys.html) 
for every defined one-one reference. 
Foreign key has no [reference actions](https://dev.mysql.com/doc/refman/5.6/en/create-table-foreign-keys.html#foreign-key-referential-actions) 
defined. In some cases it's preferable to define foreign key with `ON DELETE CASCADE` referential action.
BeORM provides special `beeorm:"cascade"` tag which forces ORM to use this action in foreign key:  

```go{9}
type HouseEntity struct {
    beeorm.ORM
    ID     uint16
}

type RoomEntity struct {
    beeorm.ORM
    ID    uint
    House *HouseEntity `beeorm:"cascade"`
}
```

Now when you delete HouseEntity also all rooms referenced to this house are deleted.

## One-many reference

Try to imagine we are developing e-commerce app used to sell shoes. In our app wec can define
a shoe and list of available sizes:

```go
type ShoeEntity struct {
    beeorm.ORM
    ID     uint16
    Name string `beeorm:"required"`
}

type ShoeSizeEntity struct {
    beeorm.ORM
    ID    uint
    Size  uint8
}
```

How we can connect sizes with a shoe? Well, one option is to use many-many table:

```go
type ShoeSizeEntity struct {
    beeorm.ORM
    ID     uint
    Shoe   *ShoeEntity `beeorm:"required"`
    Size   *ShoeSizeEntity `beeorm:"required"`
}
```

Well, it works, but it's far from optimal solutions. Reasons:
 * we need to define another table that takes disk space
 * this extra table uses contains also three indexes (ID, Shoe, Size) that use MySQL memory

So is there better way to define database model for scenario? With BeeORM yes. Simply create
public field with type of slice of referenced entities:

```go{5}
type ShoeEntity struct {
    beeorm.ORM
    ID    uint16
    Name  string `beeorm:"required"`
    Sizes []*ShoeSizeEntity `beeorm:"required"`
}
```

What does it do? BeORM simply creates a column `SIZES JSON NOT NULL` tha holds array with ID of
referenced sizes, for example `[1,23,43]`. 

::: tip
Use this model only in scenarios where number of referenced object is quite small and static.
We recommend to use one-many field if number of values (shoe sizes in our case) is not higher than
100 elements. Otherwise, use many-many (`ShoeSizeEntity`) data model.
  :::

::: tip
BeeORM can't create foreign keys for values stored in this array. If you are deleting
shoe size you should also remove its ID from all related shoe entities.
:::

## Subfields

Very often entity fields can be divided into logical groups that help you
read the code and use field definition in the same or other entities.
In BeeORM simply create struct for them and use it as a type of field:

```go{1-7,12-13,19}
struct Address {
   Country    strig
   City       string
   Street     string
   Building   uint
   PostalCode string
}

type UserEntity struct {
    beeorm.ORM
    ID             uint
    HomeAdddress   Address
    WorkAddress    Address
}

type CompanyEntity struct {
    beeorm.ORM
    ID         uint
    Adddress   Address
}
```

You can also create struct inside struct, as many levels as you want.

BeORM creates MySQL column for each field in struct by adding field name
as a suffix for column name. For example `HomeAdddressCountry varchar(255)`.

## Ignored field

If you have public fields in entity that should not be stored in database use
`beeorm:"ignore"` tag:

```go{4}
type UserEntity struct {
    beeorm.ORM
    ID        uint
    MyField   string `beeorm:"ignore"`
}
```

## JSON field

Any public field with type not mentioned above is mapped to `JSON` MySQL column type
and value of this field is automatically converted to/from JSON:

```go{9-11}
type Options struct {
    Option1 string
    Option2 bool
}

type ProductEntity struct {
    beeorm.ORM
    ID            uint
    Attributes    map[string]string  `beeorm:"required"`
    Specification interface{}
    Options       *Options
}
```

::: tip
Always try to avoid JSON fields if possible. It takes extra time
to marshal/unmarshal JSON value when entity is saved or loaded from database.
:::

## Fake delete

There is a special field `FakeDelete bool` in BeeORM that helps you to deal with scenarios
where entity needs to be deleted, but it's used as reference in other entities 
and of course delete operation it will cause foreign key exception.

Let's imagine this scenario:

```go{5}
type ColorEntity struct {
    beeorm.ORM
    ID         uint16
    Name       string `beeorm:"required"`
    FakeDelete bool
}

type ProductEntity struct {
    beeorm.ORM
    ID      uint
    Name    string `beeorm:"required"`
    Color   *ColorEntity `beeorm:"required"` 
}
```
As you can see we created field with name `FakeDelete` (it's case-sensitive) type of bool.
BeORM thread it as a special case and creates MySQL column `FakeDelete smallint` in `ColorEntity` table.
Notice that type if this column is the same as type of ID column for this entity (uint16).

Now every time you delete this entity using BeeORM (will be described on next pages) what actually
happens row is updated with query:

```sql
UPDATE ColorEntity SET `FakeDelete` = `ID` WHERE `ID` = X
```

If you need to show actual available colors in your app you should search for colors
with query similar to this:

```sql
SELECT ... FROM ColorEntity WHERE `FakeDelete` = 0
```

No worries. You don't need to remember to add `WHERE FakeDelete = 0` in all in your searches.
BeeORM will do it for you automatically in all ORM search methods described on next pages. 

Probably you are asking yourself why BeeORM uses `smallint` instead of `tinyint(1)` (bool) MySQL
column type? This topic is related to [unique index](https://dev.mysql.com/doc/refman/8.0/en/create-index.html#create-index-unique)
usage described on [next page](/guide/mysql_indexes.html).
