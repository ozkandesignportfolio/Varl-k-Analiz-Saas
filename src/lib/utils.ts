type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | { [key: string]: boolean | null | undefined };

function flatten(input: ClassValue, output: string[]) {
  if (!input) {
    return;
  }

  if (typeof input === "string" || typeof input === "number") {
    output.push(String(input));
    return;
  }

  if (Array.isArray(input)) {
    for (const value of input) {
      flatten(value, output);
    }
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      output.push(key);
    }
  }
}

export function cn(...inputs: ClassValue[]) {
  const classes: string[] = [];

  for (const input of inputs) {
    flatten(input, classes);
  }

  return classes.join(" ");
}
