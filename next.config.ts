import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.0.20"],
};

export default function NextConfig() {
  return nextConfig;
}