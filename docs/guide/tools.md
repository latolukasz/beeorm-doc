# Tools

BeeORM provides `tools` library with many useful features:

```go
import "github.com/latolukasz/beeorm/tools"
```

## Escape SQL param

As described in [Executing modification queries](/guide/mysql_queries.html#executing-modification-queries)
section you may need to escape `string` parameters in your SQL multi-statement query. Tools library
provides `EscapeSQLParam` function that do exactly this:

```go{3-4}
import "github.com/latolukasz/beeorm/tools"

query := "UPDATE Cities SET Name =" + tools.EscapeSQLParam(name1) + ";"
query (= "UPDATE Cities SET Name =" + tools.EscapeSQLParam(name2) + ";"
engine.GetMysql().Exec(query)
```
:::

## Redis server statistics

TODO

## Redis streams statistics

TODO

## Redis search statistics

TODO


