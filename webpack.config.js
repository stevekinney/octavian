module.exports = {
  entry: './index.js',
  output: {
    filename: 'octavian.js'
  },
  module: {
    loaders: [
      { test: /\.js$/, exclude: '/node_modules/', loader: 'babel-loader' }
    ]
  },
  resolve: {
    extensions: ['', '.js', '.json']
  }
};
