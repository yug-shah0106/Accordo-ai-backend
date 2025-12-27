export default [
    {
        ignores: ["node_modules/**", "logs/**"],
    },
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off",
        },
    },
];
