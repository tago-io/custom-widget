# TagoIO Toolkit to build your own widgets
> Create your amazing widgets and run it inside TagoIO admin.

### How to install?

The simple way to use is add the <script> direct on your project.
```html
<script src="https://admin.tago.io/dist/custom-widget.min.js"></script>
<link rel="stylesheet" href="https://admin.tago.io/dist/custom-widget.min.css"> <!-- OPTIONAL -->
```

Also, you can add it on your project to use with webpack
```bash
$ npm install @tago/custom-widget --save
```

> On top of your entry component
```javascript
import "@tago/custom-widget";
import "@tago/custom-widget/dist/custom-widget.css"; // OPTIONAL
```
