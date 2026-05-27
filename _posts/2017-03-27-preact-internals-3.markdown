---
layout: post
title: "Preact internals #3: some fiddly little bits"
description: "How the virtual dom actually gets rendered to the DOM"
date: 2017-03-27 09:00:00
categories: js ui
---

So far in this series, we’ve [gotten a feel for the Preact repo](/js/ui/2017/03/11/preact-internals-1.html) and looked at [the component model](/js/ui/2017/03/14/preact-internals-2.html) from a high level. When we left off last time, we had just finished our picture of the muturally-recursive process of diffing virtual DOM trees and rendering components:

<figure>
  <img src="/img/preact-internals-3/preact-internals-3-737d2c8f.png" alt="">
</figure>

And we had also made a long list of details that this picture left out, like:

- Crazy DOM special cases, like event binding and XML namespaces
- Pairing DOM children to vnode children and how `key` works
- Recycling DOM nodes for performance
- Functional and higher-order components
- Hydration, mount and unmount callbacks, and `ref`s

These details split nicely between things about the DOM (the first three) and things about components (the last two). We’ll tackle the DOM-related ones in this post, and the component ones next time.

This will be a **much more detailed and code-heavy** post than the ones so far. It’s also **much longer**.

Fortunately for those of us who use Preact, but unfortunately for those of us who want to read it, Jason is a masterful code golfer. A lot of this code is hard to understand because he has made it as short and fast as possible, often by reusing variables or mutating them in unexpected places. As we read through, I’ll do my best to point out and explain these cases.

Are you ready? Let’s do this.

<figure>
  <img src="/img/preact-internals-3/preact-internals-3-82b193da.png" alt="">
</figure>

### Mucking about with the DOM

We know that `idiff` is responsible for mutating the one DOM node to match a vnode. But most of the actual manipulation is done through helper functions defined in [`src/dom/index.js`](https://github.com/developit/preact/blob/8567c8bc13bc7fc60eeff4cad3bc9217822b4577/src/dom/index.js). There are a couple easy ones, for removing a node from the DOM:

```javascript
/** Removes a given DOM Node from its parent. */
export function removeNode(node) {
  let p = node.parentNode;
  if (p) p.removeChild(node);
}
```

There’s another for safely setting DOM attributes without throwing exceptions: (although I wonder if it should at least log these to let the developer know)

```javascript
/** Attempt to set a DOM property to the given value.
 *  IE & FF throw for certain property-value combinations.
 */
function setProperty(node, name, value) {
  try {
    node[name] = value;
  } catch (e) { }
}
```

And a wrapper for DOM event handlers that exposes a global hook for normalizing events, if you should desire. (We’ll see why the indirection of `eventProxy` is useful in just a little while.)

```javascript
/** Proxy an event to hooked event handlers
 *  @private
 */
function eventProxy(e) {
  return this._listeners[e.type](options.event && options.event(e) || e);
}
```

But the real business of this file is in the exported function `setAccessor`, which is used to set an arbitrary key/value pair from a vnode’s props onto a real DOM node. The function’s signature includes some extra information that is sometimes needed, like the vdom value previously assigned for this attribute, and whether we’re inside an SVG context:

```javascript
/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *  If `value` is `null`, the attribute/handler will be removed.
 *  @param {Element} node   An element to mutate
 *  @param {string} name    The name/key to set, such as an event or attribute name
 *  @param {any} old        The last value that was set for this name/node pair
 *  @param {any} value      An attribute value, such as a function to be used as an event handler
 *  @param {Boolean} isSvg  Are we currently diffing inside an svg?
 *  @private
 */
export function setAccessor(node, name, old, value, isSvg) {
```

The function then proceeds to consider a bunch of different cases for the `name` and `value` that we want to set on the node.

Preact supports setting classes with the prop key `class` or `className`, so it normalizes those to the same name. It also supports setting classes via an object, like `hashToClassName({button: true, active: false }) === "button"` so it converts objects to a string if we’re setting the class:

```
if (name==='className') name = 'class';
```

```
if (name==='class' && value && typeof value==='object') {   value = hashToClassName(value);}
```

The `key` attribute is used by the diffing algorithm but not intended to be rendered to the DOM, so it’s ignored:

```
if (name==='key') {  // ignore
```

If we’re setting the class, it’s already normalized to a string so just set it:

```
} else if (name==='class' && !isSvg) {  node.className = value || '';}
```

If we’re setting the node’s styles, we first need to clear off the previous styles and then set the new ones, either via a string or an object of property/value pairs. Note the bit about `NON_DIMENSION_PROPS`. That’s so you can use numerical values like `{ width: 10 }` and Preact will automatically add the `'px'` for you, unless the property name is in that list of non-dimensioned property names.

```javascript
else if (name==='style') {
  if (!value || isString(value) || isString(old)) {
    node.style.cssText = value || '';
  }
  if (value && typeof value==='object') {
    if (!isString(old)) {
      for (let i in old) if (!(i in value)) node.style[i] = '';
    }
    for (let i in value) {
      node.style[i] = typeof value[i]==='number' && !NON_DIMENSION_PROPS[i] ? (value[i]+'px') : value[i];
    }
  }
}
```

Next up is dangerously setting a string as inner html:

```
else if (name==='dangerouslySetInnerHTML') {  if (value) node.innerHTML = value.__html || '';}
```

Setting event handlers is an interesting optimization. Rather than re-set event handlers every time we render, which could be expensive, we save a map from event names to user-defined handlers on the DOM node as `node._listeners`. Then we only add/remove DOM event listeners if the set of events that is being listened to changes. The actual event handler attached to the DOM is just `eventProxy`, which we saw above, which looks into our map of event handlers to call the right one.

```javascript
else if (name[0]=='o' && name[1]=='n') {
  let l = node._listeners || (node._listeners = {});
  name = toLowerCase(name.substring(2));
```

```
// adding a callback to a new event
if (value) {
  if (!l[name]) node.addEventListener(name, eventProxy, !!NON_BUBBLING_EVENTS[name]);
}
```

```
// removing a callback from an event no longer listened to
else if (l[name]) {
  node.removeEventListener(name, eventProxy, !!NON_BUBBLING_EVENTS[name]);
}
l[name] = value;
}
```

If we haven’t hit on the property name yet, then it might be a plain old DOM property, which we set directly, using the `setProperty` helper that we saw earlier. If the value is `undefined`, `null`, or `false`, then we just remove the attribute.

```
else if (name!=='list' && name!=='type' && !isSvg && name in node) {
  setProperty(node, name, value==null ? '' : value);
  if (value==null || value===false) node.removeAttribute(name);
}
```

There’s one final case: SVG attributes. For these, we need to use the special namespace-aware attribute methods:

```javascript
else {
  let ns = isSvg && name.match(/^xlink\:?(.+)/);
  if (value==null || value===false) {
    if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', toLowerCase(ns[1]));
    else node.removeAttribute(name);
  }
  else if (typeof value!=='object' && !isFunction(value)) {
    if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', toLowerCase(ns[1]), value);
    else node.setAttribute(name, value);
  }
}
```

And that’s it. Those are the special cases that of attributes that can be set to the DOM from keys in the vnode’s props. To review, the cases Preact supports are:

- `class` and `className`, with either a string or an object, to set the class
- `style`, either a string or an object, to set style properties
- `dangerouslySetInnerHTML` for setting a string as the innerHTML of a node
- event handlers via `onEventName`
- DOM properties
- SVG attributes

Now that we understand what `setAccessor` does to set individual DOM attributes, let’s see how it’s used. It’s called by `diffAttributes`, which lives in the vdom diffing code and is called by `idiff` as it changes a node to match a vdom specification. That’s this part of our diagram:

<figure>
  <img src="/img/preact-internals-3/preact-internals-3-82b193da.png" alt="">
</figure>

[The source of ](https://github.com/developit/preact/blob/8567c8bc13bc7fc60eeff4cad3bc9217822b4577/src/vdom/diff.js#L305)[`diffAttributes`](https://github.com/developit/preact/blob/8567c8bc13bc7fc60eeff4cad3bc9217822b4577/src/vdom/diff.js#L305) is pretty simple. It runs through any attributes in the previous state but not the current one and removes them, then goes through all the attributes in the current state and sets them. But there are a couple slightly crazy bits we need to remember.

First, [certain attributes don’t even get sent to ](https://github.com/developit/preact/blob/8567c8bc13bc7fc60eeff4cad3bc9217822b4577/src/vdom/diff.js#L317)[`setAccessor`](https://github.com/developit/preact/blob/8567c8bc13bc7fc60eeff4cad3bc9217822b4577/src/vdom/diff.js#L317) because we don’t want to even try to set them on the DOM. `children` and `innerHTML` get filtered out, since we never want to try to render them. Then there’s one additional test the attribute has to pass:

```
// either it's a new attribute, or ...
!(name in old) ||
  // its value is not equal to ...
  attrs[name] !==
    // if it's a DOM form value
    (name === 'value' || name === 'checked' ?
      // then the value on the DOM node
      dom[name] :
      // otherwise, the previous version of the prop
      old[name])
```

That boolean expression had me scratching my head for a while. But what it’s trying to say is:

- If the current value is the same as the previous one, there’s no need to set it again.
- Unless it’s `value` or `checked`, because those might have been changed by user interaction since the last render. So to see if we need to re-set this attribute, we need to check against what’s on the real node, not what’s in the old props.
- And unless this prop wasn’t in the old props, because then we definitely need to re-render it and can avoid running the logic above.

That’s it for the first bit of complexity about `diffAttributes`, how it decides which attributes to send on to `setAccessor`.

The second bit of complexity is an extra responsibility that `diffAttributes` has. When removing attributes that were in the old state but not the new one, `diffAttributes` calls `setAccessor` this way:

```
setAccessor(dom, name, old[name], old[name] = undefined, svgMode);
```

And when updating an attribute, it calls it this way:

```
setAccessor(dom, name, old[name], old[name] = attrs[name], svgMode);
```

Note that in both places, it doesn’t just pass in a value to set for this attribute on the DOM node, but also mutates the `old` object to have the new value. To understand why, we need to understand another little detail that we haven’t gotten to yet. In order to do faster diffing, and especially in order to respect the `key` property when diffing children, Preact needs access to the vnode properties used the last time it rendered a specific DOM node. So it caches these properties as an attribute on the node. And in this head-scratching code above, it turns out that `old` isn’t just an object of the old attributes. It’s actually the cache of attribute properties that is saved on the DOM node. Which means that `diffAttributes` is, in this weirdly indirect way, also responsible for updating the prop cache as it updates the DOM attributes. (Remember, this is some seriously-golfed code. Don’t write your application logic like this.)

We already knew that `idiff` is responsible for updating a DOM node to match a vdom tree. And now we know all the details of how it makes the attributes on the DOM node match the properties of the vnode. That’s a big chunk of the codebase, so savor the feeling of understanding it! Go get some chocolate or stand up and stretch. Seriously. The rest will still be here when you get back.

<figure>
  <img src="/img/preact-internals-3/preact-internals-3-603ae4d5.png" alt="">
</figure>

### Pairing children, or: how key works

We now understand how `idiff` makes one DOM node’s attributes match one vdom node. The next thing to do is to make that DOM node’s children match the vdom node’s children. Most of the work — actually updating the childrens’ properties — will happen by calling `idiff` recursively. But before that can happen, `innerDiffNode` needs to decide which DOM child node to pair with each of the vdom children.

Here’s the overall plan of attack:

1. Index the existing DOM children to make them easier to look up.
1. For each vnode, use those indexes to try to find a matching DOM node.
1. Diff the vnode and (possible) matching DOM node so they match.
1. Insert the DOM node into the right place in the DOM, if necessary.
1. Clean up any old DOM nodes that didn’t get used.

Let’s walk through the code and look at how that happens. First we set up the necessary variables, especially ones that track the state of our indexes of the existing child DOM nodes:

```javascript
function innerDiffNode(dom, vchildren, context, mountAll, absorb) {
  let originalChildren = dom.childNodes,
      children = [],   // array of old child DOM nodes without keys
      min = 0,         // minimum index in `children` that has a node
      childrenLen = 0, // length of `children`
      keyed = {},      // object of old child DOM nodes by key
      keyedLen = 0,    // how many nodes are in `keyed`
      len = originalChildren.length,
      vlen = vchildren && vchildren.length,
      j, c, vchild, child;
```

Then we iterate through all the old DOM children and sort them into the right index:

```javascript
if (len) {
  for (let i=0; i<len; i++) {
    let child = originalChildren[i],
        props = child[ATTR_KEY], // props from last render
        key = vlen ? ((c = child._component) ? c.__key : props ? props.key : null) : null; // key from last render
```

```
    // if it had a key, added it to index by key
    if (key!=null) {
      keyedLen++;
      keyed[key] = child;
    }
    // otherwise, add it to the list of non-keyed old children
    else if (hydrating || absorb || props || child instanceof Text) {
      children[childrenLen++] = child;
    }
  }
}
```

Now that we’ve indexed all the DOM nodes, we loop through all the child vnodes and try to find each of them a match. If the vnode has a key, we look for a match in the `keyed` index; otherwise, we look for a matching tag in `children`.

```javascript
for (let i=0; i<vlen; i++) {
  vchild = vchildren[i]; // current vnode seeking a match
  child = null;          // the matched DOM node

  // attempt to find a node based on key matching
  let key = vchild.key;
  if (key!=null) {
    if (keyedLen && key in keyed) {
      child = keyed[key];
      keyed[key] = undefined; // remove used DOM node from index
      keyedLen--;             // and decrement the size of the index
    }
  }
```

```
// attempt to find a node of the same type from children
else if (!child && min<childrenLen) {
  for (j=min; j<childrenLen; j++) {
    c = children[j];
    if (c && isSameNodeType(c, vchild)) {
      child = c;
      children[j] = undefined;
      if (j===childrenLen-1) childrenLen--;
      if (j===min) min++;
      break;
    }
  }
}
```

(When this code block ends, we’re still inside the `for` loop over vnodes. The next block is still inside that loop.)

Notice that the state changes of `children` in the `else` case is a bit tricky. We start out with `children` being an array with entries `0` through `childrenLen-1`. As those children are paired with vnodes, holes are created in the middle fo the array. Or, if we remove the first or last item, we need to narrow the array range by incrementing `min` or decrementing `childrenLen`.

So we’re considering the child vnode `vchild`, and we may have found it a matching DOM node in `child`. The first thing to do is make their attributes match by recursively calling `idiff` on them:

```
child = idiff(child, vchild, context, mountAll);
```

If we hadn’t found a matching child DOM node, `idiff` created a new one, and either way the DOM node that it updated is returned back to us. The status of that node in the DOM is currently uncertain. It may be that it already is a child of the parent node and in the right place among the siblings. It may be that we reused a node, but it should now be at a new spot among the siblings. Or `idiff` may have made a brand-new node, and it needs to be placed inside the parent in the right place. Sorting out these cases and putting the node where it needs to go are handled next:

```
if (child && child!==dom) {
  // if the current child is past old DOM length, we can just append
  if (i>=len) {
    dom.appendChild(child);
  }
  // if the current child differs from what used to be at this index
  else if (child!==originalChildren[i]) {
    if (child===originalChildren[i+1]) {
      // I don't think this line is necessary?
      removeNode(originalChildren[i]);
    }
    dom.insertBefore(child, originalChildren[i] || null);
  }
}
```

And that’s the end of the work we need to do for each of the child vnodes. We exit out of that loop and just need to clean up any lingering DOM nodes that aren’t needed anymore. Remember that when we picked DOM node to use in the new content, we removed them from the `keyed` or `children` collections. So anything still left in them needs to be removed from the DOM. For now, we can just assume that `recollectNodeTree` makes sure the element is detached from the DOM and destroyed.

```javascript
if (keyedLen) {  for (let i in keyed)    if (keyed[i]) recollectNodeTree(keyed[i]);}
```

```
while (min<=childrenLen) {  child = children[childrenLen--];  if (child) recollectNodeTree(child);}
```

And that’s the end of `innerDiffNode`. It has paired up the new vnode children with existing DOM nodes, made them match, and now cleaned up any unneeded child nodes.

But what exactly does `recollectNodeTree` do? Preact’s support for recycling DOM nodes and component instances is what we’ll look at next.

### Recycling DOM nodes

While performing diffing, Preact often needs to create or remove DOM nodes. A lot of those nodes are of the same type, like `<div>`s. Rather than constantly destroy and instantiate new nodes, Preact maintains a cache of unused nodes that are available for reuse. To make this work, the diffing code never directly creates or removes DOM nodes, but instead uses helper functions exported from `src/dom/recycler.js`.

The cache of reusable nodes is stored in an object keyed by element name:

```javascript
const nodes = {};
```

The function `collectNode` removes a node from the DOM and adds it to the cache for elements of its node name:

```javascript
export function collectNode(node) {
  removeNode(node);

  if (node instanceof Element) {
    node._component = node._componentConstructor = null;

    let name = node.normalizedNodeName || toLowerCase(node.nodeName);
    (nodes[name] || (nodes[name] = [])).push(node);
  }
}
```

When the diff algorithm needs a new node, it calls `createNode`, which looks in the cache for a suitable node to recycle, or else instantiates a new one:

```javascript
export function createNode(nodeName, isSvg) {
  let name = toLowerCase(nodeName),
      node = nodes[name] && nodes[name].pop() ||
        (isSvg ? document.createElementNS(svgNS, nodeName) : document.createElement(nodeName));
  node.normalizedNodeName = name;
  return node;
}
```

The diffing algorithm frequently needs to compare node types. But the DOM [`nodeName`](http://ejohn.org/blog/nodename-case-sensitivity/)[ method is a little confused](http://ejohn.org/blog/nodename-case-sensitivity/) about whether to return capitalized or lowercase names, so it’s convenient to have access to a version of the name that we know will be normalized to lowercase. That’s stored as `node.normalizedNodeName` for use elsewhere.

Now we know how to recycle individual DOM nodes. But when the diffing algorithm finds a node it no longer needs, it doesn’t just need to get rid of that node, but all of its children too. And that’s what [the ](https://github.com/developit/preact/blob/8567c8bc13bc7fc60eeff4cad3bc9217822b4577/src/vdom/diff.js#L275)[`recollectNodeTree`](https://github.com/developit/preact/blob/8567c8bc13bc7fc60eeff4cad3bc9217822b4577/src/vdom/diff.js#L275)[ function](https://github.com/developit/preact/blob/8567c8bc13bc7fc60eeff4cad3bc9217822b4577/src/vdom/diff.js#L275) is for. When a whole DOM tree is no longer needed, it walks through the tree recycling each node and also unmounting any component that may have rendered it.

The code for this is pretty clear:

```javascript
export function recollectNodeTree(node, unmountOnly) {
  let component = node._component;
  if (component) {
    // if node is owned by a Component, just unmount it
    // to let callbacks run before node is removed
    unmountComponent(component, !unmountOnly);
  } else {
    // null out ref pointing to this node
    if (node[ATTR_KEY] && node[ATTR_KEY].ref)
      node[ATTR_KEY].ref(null);
```

```
    // recycle node unless asked to only handle unmounting
    if (!unmountOnly) {
      collectNode(node);
    }
```

```javascript
    // recurse on child nodes: `lastChild` is faster than other ways
    let c;
    while ((c=node.lastChild)) recollectNodeTree(c, unmountOnly);
  }
}
```

And now we understand how `innerDiffNode` deals with no-longer-needed children: it calls `recollectNodeTree` on them and that walks through the tree unmounting the component instances and recycling the nodes.

### Next time

In part four, we’ll continue looking at the helpers that surround the main render/diff loop, by examining code that helps with rendering component contents.

---

<small>*Originally published on [Medium](https://asolove.medium.com/preact-internals-3-some-fiddly-little-bits-f353b1ad7abc).*</small>
