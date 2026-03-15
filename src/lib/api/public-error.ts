export type PublicApiErrorBody<TCode extends string = string> = {
  code: TCode;
  error: string;
};

export const toPublicErrorBody = <TCode extends string>(
  code: TCode,
  error: string,
): PublicApiErrorBody<TCode> => ({
  code,
  error,
});
