# Foreign Keys

By default, BeeORM does not use [foreign keys](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html)
for [One-to-One references](/guide/entity_fields.html#one-to-one-references). However, this plugin allows you to enable foreign keys for specific Entity relations.

By enabling the Foreign Keys plugin, you can ensure referential integrity in your database and avoid orphaned records. 
It is highly recommended to use foreign keys in your database design.

## Enabling the Foreign Keys Plugin

```go
package main

import {
    "github.com/latolukasz/beeorm/v2"
    "github.com/latolukasz/beeorm/v2/plugins/foreign_keys"
}

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterPlugin(foreign_keys.Init(nil)) 
} 
```

## Enabling Foreign Keys in All Entity References

You can instruct the plugin to enable foreign keys in all Entity One-to-One references by providing the `fk` tag for the `beeorm.ORM` field, as shown in the example below:

```go{14}
type CountryEntity struct {
	beeorm.ORM
	ID   uint16
	Name string `orm:"required"`
}

type CityEntity struct {
	beeorm.ORM
	ID   uint32
	Name string `orm:"required"`
}

type AddressEntity struct {
	beeorm.ORM  `orm:"fk"`
	ID     uint32
	Street string `orm:"required"`
	Country *CountryEntity
	City *CityEntity
}
```

In the example above, BeeORM creates two foreign keys in the AddressEntity table:

 * CONSTRAINT database_name:AddressEntity:Country FOREIGN KEY (Country) REFERENCES CountryEntity (ID)
 * CONSTRAINT database_name:AddressEntity:City FOREIGN KEY (City) REFERENCES CityEntity (ID)

You can also change the tag name using plugin options:

```go{1,5}
pluginOptions := &foreign_keys.Options{TagName: "enable-fk"}
registry.RegisterPlugin(foreign_keys.Init(pluginOptions)) 

type CarEntity struct {
    beeorm.ORM `orm:"enable-fk"`
    ID         uint32
    Name       string
}
```

Note that you don't need to define a MySQL index for the Country and City columns. This plugin will create them if needed.

In some scenarios, you may need to disable foreign keys for specific fields. Simply use fk=skip to inform the plugin that a foreign key should not be created for a specific column. For example:

```go{6}
type AddressEntity struct {
	beeorm.ORM  `orm:"fk"`
	ID      uint32
	Street  string `orm:"required"`
	Country *CountryEntity
	City    *CityEntity `orm:"fk=skip"`
}
```

In the example above, only one foreign index is created for the `Street` column.

## Enabling Foreign Keys in Specific Entity References

You can enable foreign keys for specific references by adding the `fk` tag to selected entity fields, as shown in the example below:

```go{5}
type AddressEntity struct {
    beeorm.ORM
	ID      uint32
	Street  string `orm:"required"`
	Country *CountryEntity `orm:"fk"`
	City    *CityEntity
}
```

In the example above, foreign keys are enabled only for the `Country` field.