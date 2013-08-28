# roole-node

A collection of node utility functions for the Roole language

## Example

```javascript
var Node = require('roole-node');
var node = { type: 'null' };
var clone = Node.clone(node);

node !== clone;
clone.type === 'null';
```