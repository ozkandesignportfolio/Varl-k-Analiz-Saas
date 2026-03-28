/* eslint-disable @typescript-eslint/no-require-imports */
const { loadTestEnv, validateRequiredSuiteEnv } = require("./load-test-env.cjs");

loadTestEnv();
validateRequiredSuiteEnv("stable", { target: "trial" });
process.env.STABLE_SUITE_TARGET = "trial";
require("./run_stable_full_suite.cjs");


