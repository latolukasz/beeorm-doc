# Registry

The beeorm.Registry object is the starting point for using BeeORM. It allows you to configure your database connections and register structs that represent your data. You can initialize a 
beeorm.Registry object using the beeorm.NewRegistry() method, as shown in the following example:
```go
package main

import "github.com/latolukasz/beeorm/v3"

func main() {
    // Initialize a new Registry
    registry := beeorm.NewRegistry()
    
    // Register a MySQL connection pool
    registry.RegisterMySQL("user:password@tcp(localhost:3306)/db", beeorm.DefaultPoolCode, nil) 
} 
```

Alternatively, you can configure the beeorm.Registry object using data from a YAML file, as shown in the following example:

```go{20}
package main

import (
    "github.com/latolukasz/beeorm/v3"
    "io/ioutil"
    "gopkg.in/yaml.v2"
)

func main() {
    data, err := ioutil.ReadFile("./config.yaml")
    if err != nil {
        panic(err)
    }
    var parsedYaml map[string]interface{}
    err = yaml.Unmarshal(yamlFileData, &parsedYaml)
    if err != nil {
        panic(err)
    }
    registry := beeorm.NewRegistry()
    registry.InitByYaml(parsedYaml)
}
```

```yml
default:
  mysql: 
    uri: user:password@tcp(localhost:3306)/db
```