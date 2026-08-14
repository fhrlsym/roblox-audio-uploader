import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the project root explicitly. Without this, Next.js can infer the wrong
    // workspace root (e.g. the user's home directory when a stray package-lock.json
    // exists above the project), which makes Tailwind's content scanner read binary
    // files (like .freebuff/*.db) and emit corrupted CSS classes that fail to parse.
    root: process.cwd(),
  },
};

export default nextConfig;
