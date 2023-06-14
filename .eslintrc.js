module.exports = {
    root: true,
    env: {
        node: true,
    },
    parserOptions: {
        ecmaVersion: 2021,
    },
    rules: {
        "no-unused-vars": "error",
        "no-unused-expressions": "error",
        "no-unreachable": "error",
        "no-else-return": "error",
        "no-empty-function": "error",
        indent: ["warn", 4],
        quotes: ["warn", "double"],
    },
};
