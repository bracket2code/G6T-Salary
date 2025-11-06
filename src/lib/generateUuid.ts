export const generateUuid = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const random = Math.random() * 16;
    const value =
      char === "x" ? Math.floor(random) : (Math.floor(random) & 0x3) | 0x8;
    return value.toString(16);
  });
};

