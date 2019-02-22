module.exports = {
    "extends": "airbnb",
    "plugins": [
        "react",
        "jsx-a11y",
        "import",
        "ava"
    ],
    "rules": {
      "no-console": "off",
      "no-underscore-dangle": "off",
      "comma-dangle": "off",
      "import/no-extraneous-dependencies": ["error", {"devDependencies": ["**/_story.jsx", "**/*.test.js", "**/*.spec.js"]}]
    }
};
