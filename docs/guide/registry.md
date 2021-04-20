# Registry

Every journey with BeeORM starts always with method called `beeorm.NewRegistry()` that return.
Returned object is used to configure connections to your databases and register all structs that are used
to represent your data as a go object.


```go
package main

import "github.com/latolukasz/beeorm"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db") 
}  
```

You can also configure `Registry` using data stored in a yaml file with `InitByYaml()` method:

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
