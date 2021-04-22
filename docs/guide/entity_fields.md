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

```go{6}

type PersonEntity struct {
    beeorm.ORM
    // null if we don't know how many friends this person has
    // zero if noone likes him:)
    ID                 uint
}
```

