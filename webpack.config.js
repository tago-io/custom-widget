const path = require("path");
const MINIMIZE = !!process.env.MINIMIZE;

module.exports = {
  entry: "./src/customWidget.ts",
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
    filename: MINIMIZE ? "customWidget.min.js" : "customWidget.js",
  },
  resolve: {
    extensions: [".js", ".ts"],
  },
};
