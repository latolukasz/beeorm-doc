# Registry

TODO

```go
package main

import "github.com/latolukasz/beeorm"

func main() {
    registry := beeorm.NewRegistry()
    registry.RegisterMySQLPool("user:password@tcp(localhost:3306)/db")
    validatedRegistry, err := registry.Validate()
    if err != nil {
       panic(err)
    }
}  
```

TODO

<code-group>
<code-block title="go">
```go
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
    validatedRegistry, err := registry.Validate()
    if err != nil {
        panic(err)
    }
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

