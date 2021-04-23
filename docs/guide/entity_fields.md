# Entity fields

Now you know how to create simple Entity that contains
only one field `ID`. In this section you will learn how to define
other fields and how these fields are stored in database.

By default, every public entity field (that starts with uppercase letter)
is stored in MySQL.

## Integers

Most go developers use `int` primitive type forgetting go has much more to offer, 
e.g. `int8, int16`, `uint`, `uint32`. BeeORM supports all of them.

```go{5-7}

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

## Enums

TODO

## Sets

TODO

## Subfields

TODO

## Single reference

TODO

## Multi reference

TODO

## Ignored field

TODO

## Fake delete

TODO

## Other struct

TODO

