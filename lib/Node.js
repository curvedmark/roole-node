var intersperse = require('intersperse');
var RooleError = require('roole-error');

var Node = exports;

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

Node.toNumber = function(node) {
	switch (node.type) {
	case 'number':
	case 'percentage':
	case 'dimension':
		return node.children[0];
	}
};

Node.toString = function(node) {
	if (typeof node === 'string') return node;

	switch (node.type) {
	case 'number':
		return '' + +node.children[0].toFixed(3);
	case 'identifier':
	case 'string':
		return '' + node.children[0];
	case 'percentage':
		return Node.toNumber(node) + '%';
	case 'dimension':
		return Node.toNumber(node) + node.children[1];
	}
};

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

Node.toListNode = function(node, sep) {
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
};

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