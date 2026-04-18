import "server-only";

import { parseServerEnv, type ServerEnv } from "./server-env";

/**
 * RUNTIME ENV SINGLETON.
 *
 * Sözleşme:
 *  - Tüm process ömründe zod parse EXACTLY ONCE çalışır.
 *  - `getConfig()` ilk çağrıda `parseServerEnv()` çağırır; sonucu `Object.freeze`
 *    ile donmuş şekilde module-closure'da tutar. Sonraki çağrılar O(1) aynı
 *    referansı döner.
 *  - Tüm services ve routes bu modül üzerinden `CONFIG` alır; `parseServerEnv`
 *    veya `process.env` doğrudan kullanılmaz.
 *  - Missing/invalid env → yalnızca ilk `getConfig()` çağrısında `Error`. Build
 *    asla crash etmez; import-time side effect yoktur.
 */

let CONFIG: ServerEnv | null = null;
let cachedIssues: string[] | null = null;

export const getConfig = (): ServerEnv => {
  if (CONFIG) {
    return CONFIG;
  }

  const result = parseServerEnv();

  if (!result.ok) {
    cachedIssues = result.issues;
    throw new Error(
      `[runtime-env] Configuration invalid: ${result.issues.join("; ")}`,
    );
  }

  CONFIG = result.data;
  cachedIssues = [];
  return CONFIG;
};

/**
 * Throw-free geçerlilik kontrolü. Instrumentation ve opsiyonel entegrasyonların
 * structured log üretmesi için.
 */
export const getConfigIssues = (): string[] => {
  if (cachedIssues) {
    return cachedIssues;
  }

  const result = parseServerEnv();
  if (result.ok) {
    CONFIG = result.data;
    cachedIssues = [];
  } else {
    cachedIssues = result.issues;
  }
  return cachedIssues;
};

export const isConfigValid = (): boolean => getConfigIssues().length === 0;

export type { ServerEnv } from "./server-env";
