# Registry

The beeorm.Registry object is the starting point for using BeeORM. It allows you to configure your database connections and register structs that represent your data. You can initialize a 
beeorm.Registry object using the beeorm.NewRegistry() method, as shown in the following example:
```go
package main

import "github.com/latolukasz/beeorm"

func main() {
    // Initialize a new Registry
    registry := beeorm.NewRegistry()
    
    // Register a MySQL connection pool
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db") 
} 
```

Alternatively, you can configure the beeorm.Registry object using data from a YAML file, as shown in the following example:

<code-group>
<code-block title="go">
```go{20}
package main

import (
    "github.com/latolukasz/beeorm"
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
</code-block>

<code-block title="config.yaml">
```yml
default:
  mysql: user:password@tcp(localhost:3306)/db
```
</code-block>
</code-group>
