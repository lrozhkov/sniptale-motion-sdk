const SECURITY_OVERRIDE_KEY =
  /^(?:GITLEAKS(?:_|$)|OSV(?:_|$)|SCALIBR(?:_|$)|NPM_CONFIG_|GIT_|NODE_OPTIONS$|NODE_PATH$)/iu;

export const NPM_REGISTRY = "https://registry.npmjs.org/";
export const NPM_DEPENDENCY_SCOPE = Object.freeze([
  "--include=prod",
  "--include=dev",
  "--include=optional",
  "--include=peer",
]);
export const GITLEAKS_CONFIG_PATH = "tooling/configs/qa/gitleaks.toml";
export const GITLEAKS_IGNORE_PATH = ".tmp/security/no-gitleaks-ignore";

export function createSecurityEnvironment(
  environment = process.env,
  { npmUserConfig = ".tmp/security/npmrc" } = {},
) {
  const sanitized = {};
  for (const [key, value] of Object.entries(environment)) {
    if (!SECURITY_OVERRIDE_KEY.test(key) && value !== undefined) {
      sanitized[key] = value;
    }
  }
  sanitized.NPM_CONFIG_REGISTRY = NPM_REGISTRY;
  sanitized.NPM_CONFIG_USERCONFIG = npmUserConfig;
  return sanitized;
}
