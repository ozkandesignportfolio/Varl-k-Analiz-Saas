import type { User } from "@supabase/supabase-js";

type UserLike = Pick<User, "app_metadata" | "user_metadata"> | null | undefined;

const readStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter(Boolean);
};

const hasAdminRole = (value: unknown) => {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "admin" || normalized === "fraud_admin" || normalized === "super_admin";
};

const metadataFlagsAdmin = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const metadata = value as Record<string, unknown>;

  return (
    metadata.is_admin === true ||
    metadata.admin === true ||
    hasAdminRole(metadata.role) ||
    hasAdminRole(metadata.user_role) ||
    readStringList(metadata.roles).some(hasAdminRole) ||
    readStringList(metadata.permissions).some((permission) => permission === "fraud_dashboard:read")
  );
};

export const isAdminUser = (user: UserLike) =>
  metadataFlagsAdmin(user?.app_metadata) || metadataFlagsAdmin(user?.user_metadata);
