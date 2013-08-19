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

## API

### Node.clone(node)

Return a cloned version of `node`.

### Node.equal(node1, node2)

Test if the two nodes are of the same type and contain equal children. Both of them can be an array of nodes.

### Node.toNumber(node)

Convert `node` to a number. Return `undefined` if the convertion is impossible.

### Node.toString(node)

Convert `node` to a string. Return `undefined` if the convertion is impossible.

### Node.toBoolean(node)

Convert `node` to a boolean. Return `undefined` if the convertion is impossible.

### Node.toArray(node)

Convert `node` to an array. Return `undefined` if the convertion is impossible.

### Node.toListNode(node)

Convert `node` to a node of type `list`. Return `undefined` if the convertion is impossible.

### Node.perform(operator, left, right)

Perform math operation on nodes `left` and `right`. `operator` can be one of `'+'`, `'-'`, `'*'`, `'/'` and `'%'`. Throw an error if the operation can not be performed.

### Node.toOppositeNode(node)

Convert `node` denoting a position (e.g., `left`) to an opposite position (e.g., `right`). Return original node if the convertion is impossible.