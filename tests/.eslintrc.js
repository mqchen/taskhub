module.exports = {
    "extends": "airbnb",
    "plugins": [
        "react",
        "jsx-a11y",
        "import"
    ],
    "rules": {
      "no-console": "off",
      "no-underscore-dangle": "off",
      "comma-dangle": "off",
      "no-param-reassign": ["error", { "props": false }],
      "import/no-extraneous-dependencies": ["error", {"devDependencies": ["**/_story.jsx", "**/*.test.js", "**/*.spec.js"]}]
    }
};
