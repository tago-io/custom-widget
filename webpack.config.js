const path = require("path");
const MINIMIZE = !!process.env.MINIMIZE;

module.exports = {
  entry: "./src/custom-widget.ts",
  mode: "production",
  stats: "verbose",
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: `${__dirname}/node_modules/ts-loader`,
        options: {
          configFile: `${__dirname}/tsconfig.json`,
        },
      },
    ],
  },
  optimization: {
    concatenateModules: true,
    minimize: MINIMIZE,
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: MINIMIZE ? "custom-widget.min.js" : "custom-widget.js",
  },
  resolve: {
    extensions: [".js", ".ts"],
  },
};
