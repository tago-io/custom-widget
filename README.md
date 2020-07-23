# TagoIO Toolkit to build your own widgets
Create your amazing widgets and run it inside TagoIO admin.

### How to install?

The simplest way to use is to add the <script> direct on your project.
```html
<script src="https://admin.tago.io/dist/custom-widget.min.js"></script>
<link rel="stylesheet" href="https://admin.tago.io/dist/custom-widget.min.css"> <!-- OPTIONAL -->
```

Also, you can add it on your project to use with webpack
```bash
$ npm install @tago-io/custom-widget --save
```

On top of your entry component
```javascript
import "@tago-io/custom-widget";
import "@tago-io/custom-widget/dist/custom-widget.css"; // OPTIONAL
```

### Projects Examples

- [Boilerplate](https://github.com/tago-io/custom-widget-boilerplate): Basic boilerplate project using preact, it shows the basic usage of the TagoIO Custom Widget.

- [SendData Widget](https://github.com/tago-io/custom-widget-example-send-data): Simple example demonstrating how to send data from your Custom Widget to TagoIO.

- [Wizard Widget](https://github.com/tago-io/custom-widget-example-wizard): Demo showing a wizard built using TagoIO's Custom Widget.
