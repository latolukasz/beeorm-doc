# Introduction

```go
package main

import "github.com/latolukasz/beeorm"

func main() {
    registry := &beeorm.Registry{}
    registry.RegisterRedisStream("stream-2", "default")
} 
```
