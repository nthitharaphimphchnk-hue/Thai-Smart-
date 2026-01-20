import mongoose from "mongoose";
import { ENV } from "./_core/env";

let isConnected = false;

export async function connectMongoDB() {
  if (isConnected) {
    return mongoose.connection;
  }

  if (!ENV.databaseUrl) {
    console.warn("[MongoDB] DATABASE_URL not set, MongoDB connection skipped");
    return null;
  }

  try {
    await mongoose.connect(ENV.databaseUrl);
    isConnected = true;
    console.log("[MongoDB] Connected successfully");
    return mongoose.connection;
  } catch (error) {
    console.error("[MongoDB] Connection error:", error);
    throw error;
  }
}

export async function disconnectMongoDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log("[MongoDB] Disconnected");
  }
}
