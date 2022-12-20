# Entity fields

You have learned how to create a simple Entity with a single field, ID. In this section, we will delve into defining other fields and how they are stored in the database.

By default, every public entity field (which starts with an uppercase letter) is stored in MySQL. However, you can specify different storage options for your fields if needed. It is important to carefully consider the types and names of your fields to ensure proper and efficient storage and retrieval of data.

## Integers

Go offers a variety of integer types such as int8, int16, uint, and uint32, and BeeORM supports all of them.
```go{5-6}

type PersonEntity struct {
    beeorm.ORM
    ID                 uint
    Age                uint8
    BankAccountBalance int32
}
```

The table below shows how Go's integer types are mapped to MySQL column types:
| go        | MySQL         | min value  | max value  |
| ------------- |:-------------:| -----:| -----:|
| int8      | tinyint  | -128 | 127 |
| int16      | smallint      |   -32768 | 32767 |
| int32 with tag `orm:"mediumint"` | mediumint      |    -8388608 | 8388607 |
| int32,int,rune | int      |    	-2147483648 | 	2147483647 |
| int64 | bigint      |    	-2<sup>63</sup> | 	2<sup>63</sup>-1 |
| uint8      | tinyint | 0 | 255 |
| uint16      | smallint      |   0 | 65535 |
| uint32 with tag `orm:"mediumint"` | mediumint      |    0 | 16777215 |
| uint32,uint | int      |    	0 | 	4294967295 |
| uint64 | bigint      |    	0 | 	2<sup>64</sup>-1 |
| uint16 with tag `orm:"year"` | year      |    [0 or 1901](https://dev.mysql.com/doc/refman/8.0/en/year.html) | 2155 |

Note that the minimum and maximum values for each type may vary depending on the MySQL version you are using. Refer to the MySQL documentation for more information.

::: tip
Always take the time to carefully analyze your data and choose the best int type for each field:

 * If a field contains only positive numbers, use an unsigned type (e.g. uint, uint16, etc.). 
 * Try to use the smallest possible bit size for each field. For example, using uint16 for the PersonAge field would be incorrect because people do not live longer than 255 years (at least not yet). In this case, uint8 would be a more appropriate choice.
 * It is important to use the correct type for primary keys (such as ID) and fields that are part of a MySQL index. Using a low bit size not only saves MySQL disk space, but also reduces the memory used to cache the index.
:::

If you need to store a NULL value for any of the above MySQL fields, you can use a reference to the corresponding integer type (e.g. *int8, *int16, *int32, *int, *rune, *int64, *uint8, *uint16, *uint32, *uint, *uint64). In MySQL, these fields will be defined as DEFAULT NULL.

```go{7}

type PersonEntity struct {
    beeorm.ORM
    ID       uint
    // null if we don't know how many friends this person has
    // zero if no one likes him:)
    Friends *uint
}
```

## Floats

Working with floating point values can be challenging. In BeeORM, you can use either float32 or float64 as your primitive type. You can then use special tags to specify how the float value should be stored in MySQL.
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
| float32 with tag `orm:"unsigned"` | float unsigned      |
| float64      | double  |
| float64 with tag `orm:"unsigned"` | double unsigned      |
| float32,float64 with tag `orm:"decimal=X,Y"`     | decimal(X,Y)  |
| float32,float64 with tag `orm:"decimal=X,Y;unsigned"`     | decimal(X,Y) unsigned  |

All of the above MySQL fields are defined as NOT NULL. If you need to store a NULL value, you can use a reference to the corresponding floating point type (e.g. *float32, *float64). In MySQL, these fields will be defined as DEFAULT NULL.

## Booleans

Working with boolean values is straightforward in BeeORM. You can use the bool type to store boolean values in MySQL. If you need to allow NULL values in your MySQL field, you can use the *bool type instead.

```go{5-7}

type PersonEntity struct {
    beeorm.ORM
    ID           uint
    Married      bool
    HasChildren  *bool
}
```
In MySQL, the IsActive field will be defined as NOT NULL, while the HasLicense field will be defined as DEFAULT NULL.

| go        | MySQL         |
| ------------- |:-------------:|
| bool      | tinyint(1)  |


## Strings

To store text in Go, you can use the string type. Here is an example of how to use strings in a struct definition:

```go{5-7}

type ProductEntity struct {
    beeorm.ORM
    ID           uint
    Title        string `orm:"required;length=150"`
    Description  string `orm:"required;length=max"`
    Brand        string
}
```

| go        | MySQL         |
| ------------- |:-------------:|
| string      | varchar(255)  |
| string with tag `orm:"required"` | varchar(255) NOT NULL      |
| string with tag `orm:"length=X"` | varchar(X)      |
| string with tag `orm:"length=max"` | mediumtext      |
`
::: tip
When defining string fields in your Go structs, consider adding the orm:"required" tag if the field should never hold an empty string. This can help to save space in the MySQL table where the data is stored, as the database will not need to reserve space for empty strings.
:::

## Dates and Times

To store date or date and time values, use time.Time in your struct::

```go{5-7}

type UserEntity struct {
    beeorm.ORM
    ID              uint
    DateOfBirth     time.Time
    CreatedAt       time.Time `orm:"time"`
    UpdatedAt       *time.Time `orm:"time"`
}
```

The time.Time type will be mapped to a date NOT NULL column in MySQL. If you want to store a datetime value in MySQL, you can use the orm:"time" tag. This will map the time.Time field to a datetime NOT NULL column in MySQL.

If you want to store a nullable date or datetime value in MySQL, you can use a pointer to time.Time. A pointer to time.Time will be mapped to a date column in MySQL, and a pointer to time.Time with the orm:"time" tag will be mapped to a datetime column in MySQL.

Here is a summary of the mapping between Go types and MySQL columns:

| go        | MySQL         |
| ------------- |:-------------:|
| time.Time      | date NOT NULL |
| time.Time with tag `orm:"time"` | datetime NOT NULL      |
| *time.Time      | date |
| *time.Time with tag `orm:"time"` | datetime      |
`

## Binary strings

To store binary strings in your database, use the []uint8 type in your struct:

```go{5}

type UserEntity struct {
    beeorm.ORM
    ID              uint
    CVFileContent   []uint8
}
```

This will map the []uint8 field to a blob column in MySQL. If you want to store a mediumblob or longblob value in MySQL, you can use the orm:"mediumblob" or orm:"longblob" tag, respectively.

Here is a summary of the mapping between Go types and MySQL columns:

| go        | MySQL         |
| ------------- |:-------------:|
| []uint8      | blob |
| []uint8 with tag `orm:"mediumblob"` | mediumblob      |
| []uint8 with tag `orm:"longblob"` | longblob      |

## Enums and Sets

If one of your fields contains a value from a predefined list, you can use the MySQL ENUM or SET field types to store it.

### Using Structs (Recommended)

If you use a struct as a set/enum definition, BeeORM will search for all public fields with a string type in the struct, and use them as values. The first field is used as the default value when the field has the orm:"required" tag.

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
    FavoriteColor   string `orm:"enum=colors;required"`
    HatedColors     []string `orm:"set=colors"`
}

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterEnumStruct("colors", Colors) // default first field "red"
   registry.RegisterEnumStruct("colors_default_blue", Colors, Colors.Blue) // "blue" is used as default
   registry.RegisterEntity(&UserEntity{})
}
```

Here is a summary of the mapping between Go types and MySQL columns:

| go        | MySQL         |
| ------------- |:-------------:|
| string with tag `orm:"enum=colors"` | enum('red', 'blue', 'yellow') DEFAULT NULL     |
| string with tag `orm:"enum=colors;required"` | enum('red', 'blue', 'yellow') NOT NULL DEFAULT 'red'     |
| []string with tag `orm:"set=colors"` | set('red', 'blue', 'yellow') DEFAULT NULL     |
| []string with tag `orm:"set=colors;required"` | enum('red', 'blue', 'yellow') NOT NULL DEFAULT 'red'     |

### Example using list of values:

You can also define an enum or set using a list of values. The second argument is used as the default value when the orm:"required" tag is used.

```go{8-9,14}
package main

import "github.com/latolukasz/beeorm"

type UserEntity struct {
    beeorm.ORM
    ID              uint
    FavoriteColor   string `orm:"enum=colors;required"`
    HatedColors     []string `orm:"set=hated_colors"`
}

func main() {
   registry := beeorm.NewRegistry()
   registry.RegisterEnum("colors", []string{"red", "blue", "yellow"}) // default is "red"
   registry.RegisterEnum("hated_colors", []string{"red", "blue", "yellow"}, "yellow") // default is "yellow"
   registry.RegisterEntity(&UserEntity{})
}
```

## One-to-One References

In BeeORM, you can define a one-to-one reference between two entities by declaring a public field with the type of the referenced entity:

```go{11}
type CategoryEntity struct {
    beeorm.ORM
    ID     uint16
    Name   string  `orm:"required"`
}

type ProductEntity struct {
    beeorm.ORM
    ID       uint
    Name     string  `orm:"required"`
    Category *CategoryEntity `orm:"required"`
}
```

In the example above, BeeORM will create a Category smallint NOT NULL column in the ProductEntity table. If the field is allowed to store NULL values, simply omit the orm:"required" tag.

BeeORM will also create an index and a [foreign key](https://dev.mysql.com/doc/refman/5.6/en/create-table-foreign-keys.html) for every defined one-to-one reference.

You can instruct BeeORM to not create an index and foreign key in a one-to-one reference field by using the orm:"skip_FK" tag:

```go
type PersonEntity struct {
    beeorm.ORM
    ID      uint
    Name    string
    Mother  *PersonEntity `orm:"skip_FK"` 
}
```

By using the orm:"skip_FK" tag, BeeORM will not create an index or foreign key for the Mother field. This can be useful if you do not want to enforce a foreign key constraint in your database.


## One-To-Many References

You can define a one-to-many reference using the `[]Entity` type in the following way:

```go{5}
type RoomEntity struct {
    beeorm.ORM
    ID     uint32
    Name  string `orm:"required"`
}

type HouseEntity struct {
    beeorm.ORM
    ID    uint16
    Name  string `orm:"required"`
    Rooms []*RoomEntity
}
```

::: tip
Keep in mind that this model should only be used in scenarios where the number of referenced objects is relatively small and static. We recommend using the one-to-many field only if the number of values is not higher than 100 elements. For larger datasets, consider using a many-to-many data model instead:
```go
type RoomHouseEntity struct {
    beeorm.ORM
    ID     uint32
    House  *HouseEntity `orm:"required"`
    Room   *RoomEntity `orm:"required"`
}
```
:::

::: tip
Note that BeeORM does not support creating foreign keys for values stored in this array. If you delete a shoe size, you will need to manually remove its ID from all related entities.
:::

## Subfields

It is often useful to divide entity fields into logical groups, as this can help improve code readability and facilitate reuse of field definitions in other entities. In BeeORM, you can do this by creating a struct for the subfields and using it as the type of a field. For example:
```go{1-7,12-13,19}
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

type CompanyEntity struct {
    beeorm.ORM
    ID         uint
    Address    Address
}
```

You can also nest structs within structs to any desired level of complexity.

When working with structs in BeeORM, a MySQL column is created for each field in the struct, with the field name added as a suffix to the column name. For example, the field HomeAddressCountry would be stored in a column named HomeAddressCountry varchar(255).

## Anonymous Subfields

In addition to using named structs as subfields, you can also define fields using anonymous structs. For example:

```go{12}
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
    Address
}
```

When using anonymous structs in BeeORM, the fields are represented in the MySQL table without a suffix. For example, the field Country would be stored in a column named `Country varchar(255)`.

## Ignored Fields

Sometimes you may have public fields in an entity that should not be stored in the database. To instruct BeeORM to ignore a field, you can use the `orm:"ignore"` tag:

```go{4}
type UserEntity struct {
    beeorm.ORM
    ID        uint
    MyField   string `orm:"ignore"`
}
```

With this tag, BeeORM will not create a column for the `MyField` field in the MySQL table for the `UserEntity` entity. This can be useful in cases where you want to store additional information in the struct that is not relevant to the database.

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
    Attributes    map[string]string  `orm:"required"`
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
and of course delete operation will cause foreign key exception.

Let's imagine this scenario:

```go{5}
type ColorEntity struct {
    beeorm.ORM
    ID         uint16
    Name       string `orm:"required"`
    FakeDelete bool
}

type ProductEntity struct {
    beeorm.ORM
    ID      uint
    Name    string `orm:"required"`
    Color   *ColorEntity `orm:"required"` 
}
```
As you can see we created field with name `FakeDelete` (it's case-sensitive) type of bool.
BeeORM threads it as a special case and creates MySQL column `FakeDelete smallint` in `ColorEntity` table.
Notice that type in this column is the same as type of ID column for this entity (uint16).

Now every time you delete this entity using BeeORM (will be described on next pages), what actually
happens is that row is updated with a query:

```sql
UPDATE ColorEntity SET `FakeDelete` = `ID` WHERE `ID` = X
```

If you need to show actual available colors in your app you should search for colors
with query similar to this:

```sql
SELECT ... FROM ColorEntity WHERE `FakeDelete` = 0
```

No worries. You don't need to remember to add `WHERE FakeDelete = 0` in all of your searches.
BeeORM will do it for you automatically in all ORM search methods described on next pages. 

Probably you are asking yourself, why BeeORM uses `smallint` instead of `tinyint(1)` (bool) MySQL
column type? This topic is related to [unique index](https://dev.mysql.com/doc/refman/8.0/en/create-index.html#create-index-unique)
usage described on [next page](/guide/mysql_indexes.html).
