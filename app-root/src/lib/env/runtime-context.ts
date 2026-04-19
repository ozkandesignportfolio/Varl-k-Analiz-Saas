import { Runtime } from "./runtime";

export const isClientRuntime = (): boolean => Runtime.isClient();

export const isEdgeRuntime = (): boolean => Runtime.isEdge();

export const isServerRuntime = (): boolean => Runtime.isServer();

export const isBuildPhase = (): boolean => Runtime.isBuild();
