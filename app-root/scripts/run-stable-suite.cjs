/* eslint-disable @typescript-eslint/no-require-imports */
const { loadTestEnv, validateRequiredSuiteEnv } = require("./load-test-env.cjs");

loadTestEnv();

const target = String(process.argv[2] || process.env.STABLE_SUITE_TARGET || "both").toLowerCase();
validateRequiredSuiteEnv("stable", { target });

process.env.STABLE_SUITE_TARGET = target;
require("./run_stable_full_suite.cjs");
