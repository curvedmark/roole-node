var intersperse = require('intersperse');
var RooleError = require('roole-error');
var parser = require('roole-parser');

var Node = exports;

/**
 * Clone the given node
 * Also clone its children if deep is true
 */
Node.clone = function(node, deep) {
	if (deep === undefined) deep = true;

	if (Array.isArray(node)) {
		return node.map(function(node) {
			return Node.clone(node, deep);
		});
	}

	if (node !== Object(node)) return node;

	var clone = {};
	var keys = Object.keys(node);
	for (var i = 0, len = keys.length; i < len; ++i) {
		var key = keys[i];
		clone[key] = node[key];
	}

	if (deep && node.children) clone.children = Node.clone(node.children, deep);

	return clone;
};

/**
 * Test if the two nodes are of the same type and contain equal children
 *
 * Both of them can be an array of nodes
 */
Node.equal = function(node1, node2) {
	if (Array.isArray(node1) || Array.isArray(node2)) {
		if (!Array.isArray(node1) || !Array.isArray(node2)) return false;
		if (node1.length !== node2.length) return false;

		return node1.every(function(childNode1, i) {
			var childNode2 = node2[i];
			return Node.equal(childNode1, childNode2);
		});
	}

	if (node1 !== Object(node1) || node2 !== Object(node2)) return node1 === node2;
	if (node1.type !== node2.type) return false;
	if (!node1.children && !node2.children) return true;
	if (!node1.children || !node2.children) return false;

	switch (node1.type) {
	case 'range':
		return node1.exclusive === node2.exclusive;
	case 'attributeSelector':
		return node1.operator === node2.operator
	}

	return Node.equal(node1.children, node2.children);
};

/**
 * Convert `node` to a number
 *
 * Return `undefined` if the convertion is impossible
 */
Node.toNumber = function(node) {
	switch (node.type) {
	case 'number':
	case 'percentage':
	case 'dimension':
		return node.children[0];
	}
};

/**
 * Convert `node` to a string
 *
 * Return `undefined` if the convertion is impossible.
 */
Node.toString = function(node) {
	if (typeof node === 'string') return node;

	switch (node.type) {
	case 'number':
	case 'identifier':
	case 'string':
		return '' + node.children[0];
	case 'percentage':
		return Node.toNumber(node) + '%';
	case 'dimension':
		return Node.toNumber(node) + node.children[1];
	}
};

/**
 * Convert `node` to a boolean
 *
 * Return `undefined` if the convertion is impossible
 */
Node.toBoolean = function(node) {
	switch (node.type) {
	case 'boolean':
		return node.children[0];
	case 'number':
	case 'percentage':
	case 'dimension':
		return !!node.children[0];
	case 'identifier':
	case 'string':
		return !!node.children[0];
	}
	return true;
};


/**
 * Convert `node` to an array
 *
 * Return `undefined` if the convertion is impossible
 */
Node.toArray = function (node) {
	switch (node.type) {
	case 'list':
		return node.children.filter(function (item, i) {
			if (i % 2 === 0) return true;
		});
	case 'range':
		var from = node.children[0];
		var fromVal = from.children[0];
		var to = node.children[1];
		var toVal = to.children[0];

		if (!node.exclusive) {
			if (fromVal <= toVal) ++toVal;
			else --toVal;
		}
		var items = [];
		if (fromVal <= toVal) {
			for (var i = fromVal; i < toVal; ++i) {
				var clone = Node.clone(from);
				clone.children[0] = i;
				items.push(clone);
			}
		} else {
			for (var i = fromVal; i > toVal; --i) {
				var clone = Node.clone(from);
				clone.children[0] = i;
				items.push(clone);
			}
		}
		return items;
	}
	return [node];
};

/**
 * Convert `node` to a list node
 *
 * Return `undefined` if the convertion is impossible
 */
Node.toListNode = function(node) {
	switch (node.type) {
	case 'list':
		return node;
	case 'range':
		var items = Node.toArray(node);
		var sep =  {
			type: 'separator',
			children: [' '],
			loc: node.loc
		};

		return {
			type: 'list',
			children: intersperse(items, sep),
			loc: node.loc,
		};
	case 'argumentList':
		var sep = {
			type: 'separator',
			children: [','],
			loc: node.loc,
		};

		return {
			type: 'list',
			children: intersperse(node.children, sep),
			loc: node.loc,
		};
	}
	return { type: 'list', children: [node], loc: node.loc };
};

/**
 * Perform math operation on nodes `left` and `right`,
 * `op` can be one of `'+'`, `'-'`, `'*'`, `'/'` and `'%'`
 *
 * Throw an error if the operation can not be performed
 */
Node.perform = function (op, left, right) {
	switch (left.type + ' ' + op + ' ' + right.type) {
	case 'number + number':
	case 'percentage + number':
	case 'percentage + percentage':
	case 'dimension + number':
	case 'dimension + dimension':
	case 'identifier + number':
	case 'identifier + boolean':
	case 'identifier + identifier':
	case 'string + number':
	case 'string + boolean':
	case 'string + identifier':
	case 'string + string':
		var clone = Node.clone(left);
		clone.children[0] += right.children[0];
		return clone;
	case 'number + identifier':
		return {
			type: 'dimension',
			children: [left.children[0], right.children[0]],
			loc: left.loc
		};
	case 'identifier + percentage':
	case 'identifier + dimension':
	case 'string + dimension':
	case 'string + percentage':
		var clone = Node.clone(left);
		clone.children[0] += Node.toString(right);
		return clone;
	case 'number + percentage':
	case 'number + dimension':
	case 'number + string':
	case 'boolean + identifier':
	case 'boolean + string':
	case 'identifier + string':
		var clone = Node.clone(right);
		clone.children[0] = left.children[0] + clone.children[0];
		return clone;
	case 'percentage + string':
	case 'dimension + string':
		var clone = Node.clone(right);
		clone.children[0] = Node.toString(left) + clone.children[0];
		return clone;
	case 'number - number':
	case 'percentage - percentage':
	case 'percentage - number':
	case 'dimension - dimension':
	case 'dimension - number':
		var clone = Node.clone(left);
		clone.children[0] -= right.children[0];
		return clone;
	case 'number - dimension':
	case 'number - percentage':
		var clone = Node.clone(right);
		clone.children[0] = left.children[0] - right.children[0];
		return clone;
	case 'number * number':
	case 'percentage * number':
	case 'dimension * number':
		var clone = Node.clone(left);
		clone.children[0] *= right.children[0];
		return clone;
	case 'number * dimension':
	case 'number * percentage':
		var clone = Node.clone(right);
		clone.children[0] = left.children[0] * right.children[0];
		return clone;
	case 'number / number':
	case 'percentage / number':
	case 'dimension / number':
		var divisor = right.children[0];
		if (divisor === 0) throw new RooleError("Divide by zero", right);
		var clone = Node.clone(left);
		clone.children[0] /= divisor;
		return clone;
	case 'percentage / percentage':
	case 'dimension / dimension':
		var divisor = right.children[0];
		if (divisor === 0) throw new RooleError("Divide by zero", right);
		return {
			type: 'number',
			children: [left.children[0] / divisor],
			loc: left.loc,
		};
	case 'number / dimension':
	case 'number / percentage':
		var divisor = right.children[0];
		if (divisor === 0) throw new RooleError("Divide by zero", right);
		var clone = Node.clone(right);
		clone.children[0] = left.children[0] / divisor;
		return clone;
	case 'number % number':
	case 'percentage % number':
	case 'dimension % number':
		var divisor = right.children[0];
		if (divisor === 0) throw new RooleError("Modulo by zero", right);
		var clone = Node.clone(left);
		clone.children[0] %= right.children[0];
		return clone;
	case 'number % percentage':
	case 'number % dimension':
		var divisor = right.children[0];
		if (divisor === 0) throw new RooleError("Modulo by zero", right);
		var clone = Node.clone(right);
		clone.children[0] = left.children[0] % right.children[0];
		return clone;
	case 'percentage % percentage':
	case 'dimension % dimension':
		var divisor = right.children[0];
		if (divisor === 0) throw new RooleError("Modulo by zero", right);
		return {
			type: 'number',
			children: [left.children[0] % divisor],
			loc: left.loc,
		};
	}
	throw new RooleError("Unsupported binary operation: " + left.type + ' ' + op + ' ' + right.type, left);
};

/**
 * Convert `node` denoting a position (e.g., `left`)
 * to an opposite position (e.g., `right`)
 *
 * Return original node if the convertion is impossible
 */
Node.toOppositeNode = function (node) {
	switch (node.type) {
	case 'string':
	case 'identifier':
		var val = node.children[0];
		var oppVal;
		switch (val) {
			case 'left': oppVal = 'right'; break;
			case 'right': oppVal = 'left'; break;
			case 'top': oppVal = 'bottom'; break;
			case 'bottom': oppVal = 'top'; break;
			default: oppVal = val;
		}

		if (oppVal === val) return node;

		var clone = Node.clone(node);
		clone.children[0] = oppVal;
		return clone;
	case 'list':
		var clone = Node.clone(node, false);
		var children = [];
		for (var i = 0, len = clone.children.length; i < len; ++i) {
			var child = clone.children[i];
			if (i % 2) children.push(child);
			else children.push(Node.toOppositeNode(child));
		}
		clone.children = children;
		return clone;
	default:
		return node;
	}
};

/**
 * Get the separator that would separate two lists if they were to concatenate
 */
Node.getJoinSeparator = function (list1, list2) {
	if (list1.type === 'list' && list1.children.length > 1) {
		return list1.children[list1.children.length - 2];
	}
	if (list2.type === 'list' && list2.children.length > 1) {
		return list2.children[1];
	}
	return { type: 'separator', children: [' '], loc: list1.loc };
}

/**
 * Convert a primary object to node, optionally with loc as the location
 */
Node.toNode = function (val, loc) {
	var node = toNode(val);
	if (node && loc) node.loc = loc;
	return node;
};

function toNode(val) {
	if (val == null) return { type: 'null' };

	var type = typeof val;
	switch (type) {
	case 'function':
		return { type: 'builtin', children: [val] };
	case 'number':
	case 'boolean':
		return { type: type, children: [val] };
	}

	if (Object(val) === val) return val;
	if (typeof val !== 'string' || !val) return;

	try {
		return parser.parse(val, { startRule: 'list' });
	} catch (e) {
		return;
	}
}