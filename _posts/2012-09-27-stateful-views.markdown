---
layout: post
title:  "Stateful views"
date:   2012-09-27 17:43:39
categories: js view
---

<p>I want to discuss a distinction between two types of view-level components we can write in JavaScript:</p>
<ol>
<li> Application views, which map user events to application changes.</li>
<li> Stateful views, which map low-level user inputs to higher-level inputs suitable for consumption by application views.</li>
</ol>
<p>While application views are conveniently modeled in MV*-pattern JavaScript frameworks, stateful views are harder to write and can be better modeled using state machines.</p>
<h2>The distinction</h2>
<p><em>An application-level view</em> maps user inputs into actions in the data model. The mapping is usually one-to-one: one browser event generates one call to a model method. A text input's change event fires setting an attribute; submitting a form fires an ajax save. These event bindings are generally stateless: they are always bound, it does not matter in what order they are triggered. They always do the same thing.</p>
<p>In contrast, <em>a stateful view</em> listens to events in a particular sequence or combination before outputting a single, higher-level event. A drag-and-drop reorderable list view, for example, listens to a mousedown, several mousemoves, and a mouseup before it has anything to tell the model. It is stateful because it tracks the user inputs through this process and binds or unbinds event handlers at each step.</p>
<p>Why make this distinction? Because the two tasks are best solved in two different ways. Backbone, and other MV* frameworks, provide an easy way to declare stateless event bindings and map them to model-level methods. But they don't provide a pattern for writing stateful views, and trying to write them using the normal pattern will result in some ugly code.</p>
<p>A good pattern is to layer our views: creating one stateful view that turns low-level events (like "mouseup") into higher-level events (like "reordered") and then an application view which listens to these higher-level events and updates the model.</p>
<h2>An example stateful view</h2>
<p>Let's consider the outline of a simple, naive implementation of drag and drop:</p>

{% highlight javascript %}
var draggable = $("#drag");
var handle = draggable.find(".handle");
handle.on("mousedown.drag", function mousedown(e){
  handle.off("mousedown.drag");
  
  draggable.animate({ opacity: 0.5 });
  draggable.on("mouseup.drag", function mouseup(e){
    draggable.off("mouseup.drag");
    $("body").off("mousemove.drag");
    handle.on("mousedown", mousedown);
 
    draggable.animate({ opacity: 1 });  
    // detect location and possibly do something
  });
  $("body").on("mousemove.drag", _.throttle(function(e){
    draggable.css({ left: e.pageX, top: e.pageY });
  }, 100));
});
{% endhighlight %}

<p>There are lots of things we can make better about this code. But even after we refactor each callback into its own method and clean up the access to dom elements, we will still have code with the same shape: manually binding and unbinding events, implicitly tracking the view's state. It's easy to leave events bound which shouldn't be and thereby create memory leaks. And adding even one new state or transition into the mix will require careful thought and some refactoring.</p>
<h2>States and transitions</h2>
<p>What if we take the state implicit in the imperative code and make it explicit? Our view has two states: inactive and dragging. While inactive, it is listening for a mousedown to enter the dragging state. While dragging, it is listening for a mouseup to transition back to inactive, or a mousemove to trigger some behavior and remain in the dragging state.</p>
<p>So let's write that description out as code, a state machine:</p>

{% highlight javascript %}
var Dragger = StatefulView.extend({
  states: {
    "dragging": function(e){ el.css({ opacity: 0.5 }) },
    "inactive": function(e){ el.css({ opacity: 1 }); }
  },
  transitions: {
    "mousedown .handle": ["inactive", "dragging"],
    "mouseup": ["dragging", "inactive"],
    "mousemove": ["dragging", "dragging", function(e){
      el.css({ left: e.pageX, top: e.pageY });
    }
  }
});
{% endhighlight %}

<p>The core feature of the view: its states, and the allowed transitions between them, are now explicit. The tedious work of knowing when to bind and unbind event handlers (important for garbage collection as well as logical correctless) can be handled by library code.</p>
<p>Each state has a function describing what to do when we wnter the state, and each transition can have a function describing what to do when it is triggered. We could add other features, like callbacks when leaving states, transitions with multiple states, etc.</p>
<p>As the events involved in the interaction become more numerous, the strength of separating the states and transitions from our reaction to them becomes clearer. Users should be able to cancel a drag by pressing "Escape." In the imperative code, this will require refactoring our event handlers and figuring out when to bind and unbind events. In the state machine code, it's just one more transition.</p>
<p>There are several available libraries for writing views as state machines:</p>
<ol>
<li><a href="https://github.com/lucaong/jquery-machine"> jQuery-Machine</a> is a simple jQuery plugin</li>
<li><a href="https://github.com/sebpiq/backbone.statemachine">Backbone.StateMachine</a> provides a mixin that works similar to the pseudocode above.</li>
</ol>
<p>Just a warning: I haven't used either of these libraries in anger, so do your normal research before adopting them.</p>
<ol> </ol>
<p>Our state machine pseudocode also exposes one other idea, which is worth exploring.</p>
<h2>First-class events</h2>
<p>Notice that the state machine's description includes strings like "mousedown .handle," a format used for declaring delegated events in Backbone. The use of these strings suggests something interesting: we are trying to create a value which represents a stream of events, without actually binding to the event.</p>
<p>There is no value in JavaScript that represents the idea of an event. To bind to an event, we need a target object, the string name of the event type, and the appropriate bind function, either document.addEventListener, jQuery's $.fn.on, or Backbone's Backbone.Event.prototype.on.</p>
<p>It would be really convenient if we could pass around an anonymous event, the way we can an anonymous function, and bind a callback to it without knowing what type of event it is. Even more convenient would be the ability to write our own higher-order events, like state machines, that also conform to this interface. More on this to come.</p>