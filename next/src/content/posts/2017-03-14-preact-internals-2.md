---
layout: post
title: "Preact internals #2: the component model"
description: "What makes React’s component model — composable, stateful, declarative — actually work, and how Preact implements both class-based and functional components"
date: 2017-03-14 09:00:00
categories: js ui
tags: ui
---

In [the first post](/js/ui/2017/03/11/preact-internals-1.html) in this series, we started to build a mental model of the Preact codebase, explored some fringe code for utilities and global options, and saw how JSX becomes virtual dom trees. In this second post, we’ll look at the (P)react component model: what it is, how functional and class-based components work, and how the implementation is structured.

### What (P)react is really about

Let’s start by dismissing a major misconception about the React UI model (and the parts of it implemented by Preact). I still frequently read that the main benefit of React is the performance benefit of using virtual DOM diffing to render HTML. Now, virtual DOM diffing is neat, but it’s just an enabling feature for React’s core idea, which is its component model.

In any view library, the component model sets the rules for how one programmer can build an encapsulated component and how someone else can use it from their code. In the React model, **components are composable, stateful, and declarative.** Let’s look at these three properties in turn:

- **Composable** components can be reused and recombined in ways not deliberately coded for by the component’s author. Users can even pass one component to another to configure what it renders. For example, we should be able to write a generic List component that knows very little about its children, just accepting another component as an argument and rendering a copy of it for each piece of data.
- **Stateful** components are aware of their history and lifecycle. When authoring a component, it is frequently useful to be able to compare current data with previous, to store local state hidden from the parent component, and to run code when an instance is first created or finally destroyed.
- **Declarative** components describe their contents with simple data structures rather than stateful instances. When a declarative component’s data is updated, it returns a brand-new specification of what should be rendered. It doesn’t have to remember previous child components, old versions of their data, or destroying them when no longer used.

Notice that if we want a composable component model, there is a tension between making it stateful and making it declarative. The trade-off is between the power given to a component’s author and the complexity demanded from its users. As the user of a stateful component, we have to instantiate it at the right time, manage its events and updates, and remember to destroy it. On the other hand, if we want to use a child component declaratively, avoiding all of that stateful bookkeeping, there doesn’t seem to be any way for it to store state or manage its lifecycle.

The React component model side-steps this apparent trade-off and gives us all the power of authoring components statefully and all the convenience of using them declaratively.

How is that possible? Remember that a component’s render method doesn’t build DOM nodes or create component instances, but instead only returns a vnode that describe how they *could* be made. The React runtime takes this description and the previously-rendered component instances and determines which vnodes represent new components to be instantiated, which map to existing components that should be updated, and which existing components don’t map to anything in the vnode and should be destroyed. The runtime manages this stateful process in a general and thoroughly-tested way, so our code doesn’t have to worry about it. The result is that a component’s author can write it statefully but its users can take advantage of it declaratively.

**This is the big idea of React: composable components with stateful implementations but declarative usage.** And all that complicated stateful bookkeeping code that our applications don’t need? It’s all been moved to the runtime, which coincidentally is the codebase that we’re trying to understand. It’s going to be fun.

### Component types: class-based and functional components

The React component model has two types of components: objects that inherit from the base `Component` class and simple functions. As of now, functional components are always stateless, just receiving props and context as arguments and returning a virtual DOM node:

```javascript
let Person = (props, _context) =>   <div>{props.name}</div>
```

We could build the same stateless behavior with a class:

```javascript
class Person extends Component {
  render(props, _state, _context) {
    // In React, props/state/context are not passed as arguments,
    // but accessed on `this`. Preact adds them as arguments too.
    return <div>{props.name}</div>;
  }
}
```

We want these two components to have (mostly) the same behavior, but they need to be called in very different ways. How does the runtime code know which components are which?

Remember that each vnode has a `nodeName`, which can be either a string representing an HTML element (like “div”) or a function designating a component. If it’s a function, we need to know whether that function is a constructor for a Component class instance, or just a plain old pure functional component. To find out, `src/vdom/functional-component.js` defines [`isFunctionalComponent`](https://github.com/developit/preact/blob/de70e6b219db5d97fc9bb82b2ef9250389062732/src/vdom/functional-component.js#L6), which looks for a `render` method on the prototype of the function. For a class-based component, that method will exist. For functional components, it won’t.

### The Component base class

The component above was stateless, just returning a vdom tree for its props. But we can also use class-based components to add local state and handle lifecycle callbacks. (The best guide to the full `Component` API is [the React docs](https://facebook.github.io/react/docs/react-component.html#the-component-lifecycle).) In this section, we’ll read through the declaration of the Preact `Component` class that your stateful components can extend.

The base `Component` is defined as an ES5-style constructor in [`src/component.js`](https://github.com/developit/preact/blob/de70e6b219db5d97fc9bb82b2ef9250389062732/src/component.js). This file contains the interface and a few required methods, but leaves out many optional lifecycle methods.

- There is a commented-out versions of [`shouldComponentUpdate`](https://github.com/developit/preact/blob/de70e6b219db5d97fc9bb82b2ef9250389062732/src/component.js#L35) and an empty version of [`render`](https://github.com/developit/preact/blob/de70e6b219db5d97fc9bb82b2ef9250389062732/src/component.js#L93), both of which may be overridden in the components you write.
- [`setState`](https://github.com/developit/preact/blob/de70e6b219db5d97fc9bb82b2ef9250389062732/src/component.js#L73) merges new state values into the component’s existing state, then queues the component to be rendered asynchronously. (Local state changes, unlike changes to props passed from a parent, are always rendered asynchronously.)
- [`forceUpdate`](https://github.com/developit/preact/blob/de70e6b219db5d97fc9bb82b2ef9250389062732/src/component.js#L88) causes a synchronous render of the component.

And that’s it for the `Component` class that you can extend. Most of the interesting component implementation lives in a separate file, `src/vdom/component.js`, which is responsible for managing component instances and calling their lifecycle methods at the right times.

### Implementing the Component lifecycle

So far, we’ve described *what* the runtime does for us, and seen the stateful class that our components extend. But *how* does the runtime work? There is a lot of complexity to the implementation, so before reading the code let’s build a picture of the functions involved and what each of them does.

Throughout this implementation overview, we’re going to be dealing with DOM nodes, vnodes, and actual component instances, often representing the same abstract thing. To avoid confusion, I’ve added some color-coding to help us keep them straight: blue for DOM nodes, green for vnodes, and orange for component instances.

The process starts when we have a vnode tree that we want to diff with a dom node and put inside a parent node.

<figure>
  <img src="/img/preact-internals-2/preact-internals-2-cba42946.png" alt="diff(dom, vnode, domParent)">
  <figcaption>diff(dom, vnode, domParent)</figcaption>
</figure>

**`diff`** takes care of some bookkeeping and then hands control to a helper function `idiff` to actually do the diffing. After `idiff` is done, `diff` will make sure the updated node gets put into the right parent.

<figure>
  <img src="/img/preact-internals-2/preact-internals-2-a459f032.png" alt="">
  <figcaption>idiff(dom, vnode) mutates the DOM</figcaption>
</figure>

**`idiff`**'s behavior depends on the type of vnode it’s given. If the vnode describes a regular HTML element, then `idiff` updates the DOM to have the right element and attributes. Once the current level of the DOM matches the current level of the vnode, `idiff` calls `innerDiffNode` to diff the DOM node’s children against the vnode’s children.

<figure>
  <img src="/img/preact-internals-2/preact-internals-2-49b0486d.png" alt="">
  <figcaption>innerDiffNode(dom, vnodes) pairs & diffs children</figcaption>
</figure>

For each of the child virtual nodes, **`innerDiffNode`** finds or creates a matching child node of the current DOM node. The matching process is a bit complex, and this is where the use of `key` on child components can make things a lot faster. Once the DOM and vnode children are paired up, the function calls `idiff` on them to change the child DOM to match the description.

Recursive calls between `idiff` and `innerDiffNode` can therefore change a whole tree of DOM nodes to match a whole tree of vnodes describing HTML elements. But what happens when `idiff` reaches a vnode that represents a component? It needs to know what content the component wants to render. To do that, it calls `buildComponentFromVNode`.

<figure>
  <img src="/img/preact-internals-2/preact-internals-2-8582a39c.png" alt="">
</figure>

**`buildComponentFromVNode`** looks for an existing component instance that corresponds to the vnode or creates a new one. Once it has a component instance, it needs to set the vnode’s attributes as the new props on that instance, by calling `setComponentProps`.

<figure>
  <img src="/img/preact-internals-2/preact-internals-2-0ba068d5.png" alt="">
  <figcaption>setComponentProps sets instance props</figcaption>
</figure>

**`setComponentProps`** does some bookkeeping to update the instance’s props while also keeping the old ones around. Now that the component instance has new data, it might want to update what it renders, so it calls `renderComponent` to actually manage the lifecycle callbacks and rendering.

<figure>
  <img src="/img/preact-internals-2/preact-internals-2-df9dcacd.png" alt="">
  <figcaption>renderComponent sets component content & calls lifecycle methods</figcaption>
</figure>

**`renderComponent`** calls the lifecycle methods on the component instance to tell it that it will receive new props and ask if it wants to update. If so, `renderComponent` calls the instance’s `render` method to get the content it wants to display.

Now it has a new vnode of content to render into the DOM. How can it do that? Fortunately, we have a function for exactly that purpose: `diff`.

<figure>
  <img src="/img/preact-internals-2/preact-internals-2-715f98b6.png" alt="">
</figure>

**And that’s all. The circle of Preact is complete!**

It looks like it might go on forever. But eventually all your components bottom out at rendering regular html elements, so eventually `idiff` will bottom out at making DOM changes rather than needing to get a component’s content.

I hope that this map gives you a solid high-level understanding of what happens inside Preact. We’ll regularly refer back to it as we drop into code to see how it works at a deeper level.

Meanwhile, you probably still have lots of questions because I’ve left out a lot of details. For example:

- Functional components and higher-order components
- Pairing DOM children to vnode children and how `key` works
- Crazy DOM special cases, like event binding and XML namespaces
- Recycling unused components and DOM nodes for performance
- Hydration, mount and unmount callbacks, and refs

How Preact handles these complexities is precisely [where we will pick up in the next post.](/js/ui/2017/03/27/preact-internals-3.html)

In the mean time, if you enjoyed this walkthrough of the React component model and would like to learn more about different models of UI programming, enjoy the appendex with links to lots more reading material:

### Appendix: further reading in UI programming

In my description of the React component model, I may have misled you into thinking that it is an absolutely new and singular idea. This is completely untrue. If you are interested in other approaches to UI programming, you might be interested in:

- **Some theory**: In a 2005 [comment on Lambda the Ultimate](http://lambda-the-ultimate.org/node/563#comment-4520), Prof. Peter Van Roy described a theoretical web UI system that in retrospect looks pretty similar to React. He explains that the system would use declarative trees of elements, like HTML, but with real data in their attributes rather than just strings, and with a runtime to interpret them as stateful objects. *Sometimes a little theory can see a long way into the future.* I highly recommend [his book on different programming models](https://www.info.ucl.ac.be/~pvr/book.html). It has an entire chapter on stateful & declarative UI programming, especially in the presence of concurrency.
- **Some bleeding-edge tech**: In the first post of the series, we saw Preact’s basic support for asynchronous rendering, currently a major area of exploration. The original React model renders an entire DOM tree at once. If we could instead break up and prioritize the work, we might be able to quickly render the most important content, or update short animations, rather than allowing them to be slowed down by less-important content. [React Fiber](https://github.com/facebook/react/issues/7942) is a reimplementation of React with a concurrency model that makes it possible to do chunked, prioritized, and speculative rendering. Get started by watching Lin Clark’s amazing talk [“A cartoon intro to Fiber.”](https://www.youtube.com/watch?v=S8HXkEnA48g&feature=youtu.be&t=1h51m25s) And expect to hear a lot more about Fiber in the next year.
- **A totally-different programming model**: [Elm](http://elm-lang.org) is a statically-typed, pure functional language for building web UIs. There is a thorough and well-written [guide to Elm UI architecture](https://guide.elm-lang.org/architecture/), which makes a strong case for types and purity in UI development. Individual Elm components cannot encapsulate local state or behavior. This enables some amazing tooling, like a time-travelling debugger that always works. But it also poses a barrier to certain kinds of component encapsulation and reuse. If you are conversant in Haskell and want to see how typed functional components can have local state at the cost of some interesting type signatures, you might explore [PureScript’s Halogen](https://github.com/slamdata/purescript-halogen/blob/master/docs/2%20-%20Defining%20a%20component.md#state).

Prefer a different component model I forgot to mention? Want to share other UI programming theory I ought to be aware of? **Please leave a comment!**

---

<small>*Originally published on [Medium](https://asolove.medium.com/preact-internals-2-the-component-model-36a05e32957b).*</small>
