export function loadConfig() {
  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3000', 10),
  };
}

export type Config = ReturnType<typeof loadConfig>;
