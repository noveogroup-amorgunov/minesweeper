const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: {
        main: './src/main.tsx',
        worker: './src/minesweeper/GameWorker.ts'
    },
    devtool: false,
    module: {
        rules: [
            {
                test: /\.ts(x?)$/,
                exclude: /node_modules/,
                use: { loader: 'babel-loader' },
            },
            {
                test: /\.(woff|woff2)$/,
                use: {
                  loader: 'url-loader',
                },
              },
              {
                test: /\.css$/i,
                use: [
                  "style-loader",
                  "css-loader",
                  {
                    loader: "postcss-loader",
                    options: {
                      postcssOptions: {
                        plugins: ["postcss-preset-env"],
                      },
                    },
                  },
                ],
              },
        ],
    },
    output: {
        filename: '[name].js',
    },
    resolve: {
        extensions: ['*', '.js', '.jsx', '.json', '.ts', '.tsx'],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            title: 'minesweeper.exe',
        }),
    ],
    devServer: {
        hot: false,
        liveReload: false,
        compress: false,
        port: 9000,
        historyApiFallback: true,
    },
};
