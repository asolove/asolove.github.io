---
layout: post
title:  "Deferred method combinator"
date:   2012-09-19 17:43:39
categories: js functional
---

<p>Reg Braithwaite's excellent <a href="https://github.com/raganwald/homoiconic/blob/master/2012/08/method-decorators-and-combinators-in-coffeescript.md">post on method combinators</a> showed how to untangle cross-cutting concerns like security, logging, and event triggering from the definitions of instance methods. The post inspired me to share another fun method combinator: asynchronous method invocation.</p>
<h2 id="whatIs">What is a method combinator?</h2>
<p>A method combinator is a higher-order function which accepts a function as an argument and returns a new function which adds some extra decoration to the original. If you have a lot of code that looks like:</p>

{% highlight javascript %}
Post.prototype.create = function(data){
  if(authSystem.hasPermission(this.user, "create")){
    // actually do the creation
  }
};

Post.prototype.update = function(data){
  if(authSystem.hasPermission(this.user, "update")){
    // actually do the update
  }
};
{% endhighlight %}

<p>You can easily break out the shared, cross-cutting concern into a method combinator:</p>

{% highlight javascript %}
function withPermission(permission, fn){
  return function(){
    if(authSystem.hasPermission(this.user, permission){
      fn.apply(this, arguments);
    }
  };
}
{% endhighlight %}

<p>And then wrap your bare methods with the combinator:</p>

{% highlight javascript %}
Post.prototype = {
  create: withPermission("create", function(){ /* ... */ }),
  update: withPermission("update", function(){ /* ... */ })
};
{% endhighlight %}

<p>Read <a href="https://github.com/raganwald/homoiconic/blob/master/2012/08/method-decorators-and-combinators-in-coffeescript.md">Reg's post</a> for a few more mind-binding ideas.</p>

<h2 id="deferred">What is a deferred?</h2>

<p>A deferred is an object that represents an asynchronous action, something that may or may not have happened yet, or may never happen. jQuery now includes a <a href="http://api.jquery.com/category/deferred-object/">deferred constructor</a>, which is quite simple to use:</p>

{% highlight javascript %}
var deferred = new $.Deferred();
deferred.done(function(){ alert("hooray!"); });
deferred.fail(function(){ alert("aww..."); });
// some time later, we can resolve the deferred...
deferred.resolve(); 
// and the appropriate success or failure callback will be called.
{% endhighlight %}

<p>Because so many of the interesting things in JavaScript involve asynchronous behavior, deferreds can be quite useful. If you have methods that currently accept callbacks, you can simplify things by returning a deferred instead.</p>
<h2 id="deferredCombinator">The deferred combinator</h2>
<p>We can use the behavior of deferreds to create a combinator that defer the execution of a method until later. This is handy when you have a caller who is going to call your method before you're ready to handle their request.</p>
<h3 id="theSetup">The setup</h3>
<p>Let's look at an example. We have an existing class for widgets, small pieces of UI that are rendered inside of another view and aren't really necessary, they're just icing on the cake. The widget class is pretty simple:</p>

{% highlight javascript %}
function Widget(data){
  this.data = data;
}

Widget.prototype.render = function(el){
  el.html(this.template(this.data));
};
{% endhighlight %}

<p>The widget gets initiated somewhere high up in the application and then passed in to a view, which calls it when it's ready:</p>

{% highlight javascript %}
function SomeView(widget){
  this.widget = widget;
}

SomeView.prototype.render = function(){
  this.el.html(this.template(this.data));
  this.widget.render(this.el.find(".widget"));
};
{% endhighlight %}


<p>And we now have lots of different application views, all of which can take any of these widgets and render it, using this interface.</p>
<h3 id="theChallenge">The challenge</h3>
<p>Now we want to create another widget, but this time the data is loaded from a third-party API. It may or may not have come back by the time the view calls our widget's render method. What to do?</p>
<p>Our first option is to change the widget interface to always be asynchronous. The widget can have a dataLoaded deferred object representing whether it has loaded or not and foist the complexity onto every view that wants to render it:</p>

{% highlight javascript %}
SomeView.prototype.render = function(){
  this.el.html(this.template(this.data));
  var self = this;
  this.widget.dataLoaded.then(function(){
    self.widget.render(self.el.find(".widget"));
  });
}
{% endhighlight %}


<p>If there are lots of places that render widgets, that's a lot of unrelated code to change. Instead, we can contain the asynchronous behavior inside the widget itself by making the render method fire-and-forget. The caller will just call render and we'll get around to doing it as soon as we're ready:</p>

{% highlight javascript %}
AsyncWidget.prototype.render = function(el){
  var self = this;
  this.dataLoaded.then(function(){
    el.html(self.template(self.data));
  });
};
{% endhighlight %}

<p>This solution restores the original Widget contract. But notice that the render method now combines two separate concerns: figuring out when to run, and actually rendering. If the object had methods other than render that needed to wait on data, we'd have to duplicate the deferred code in each of them.</p>
<h3 id="theSolution">The solution</h3>
<p>Instead, we can define a method combinator that will fire our methods asynchronously. It returns a function that will remember</p>

{% highlight javascript %}
function whenDataLoaded(fn){
  return function(){
    var self = this, args = arguments;
    this.dataLoaded.then(function(){
      fn.apply(self, args);
    });
  };
};
{% endhighlight %}


<p>And then use it to wrap methods that should wait for our deferred to be ready:</p>

{% highlight javascript %}
AsyncWidget.prototype.render = whenDataLoaded(function(el){
  el.html(this.template(this.data));
});
{% endhighlight %}


<p>Anyone can call render whenever they want, and the body of the method will be carried outside as soon as the data is ready.</p>
<h3 id="otherUses">Other uses</h3>
<p>Now that we have the idea of "saving" method invocations and actually carrying them out later, we could extend it to making the invocation multiple times.&nbsp;</p>

{% highlight javascript %}
function every(ms, fn){
  return function(){
    var self = this, args = arguments;
    setInterval(function(){
      fn.apply(self, args);
    }, ms);
  }
}

AdWidget.prototype.renderRandom = function(el){
  // pick a random ad and render it
});

AdWidget.prototype.render = every(3000, AdWidget.prototype.renderRandom);

{% endhighlight %}

<p>We could just write a render method that did both the rendering of the random ad and the cycling, but by separating them out we have made the code easier to test and understand.</p>