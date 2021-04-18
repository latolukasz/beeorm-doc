# Introduction

```go
package main

import "github.com/latolukasz/beeorm"

func main() {
    registry := &beeorm.Registry{}
    registry.RegisterRedisStream("stream-2", "default")
} 
```


<code-group>
<code-block title="GO">
```go
package main

import "github.com/latolukasz/beeorm"

func main() {
registry := &beeorm.Registry{}
registry.RegisterRedisStream("stream-2", "default")
}
```
</code-block>

<code-block title="YAML">
```yaml
{
    registry: localhost
}
```
</code-block>
</code-group>
