import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load environment variables from .env
dotenv.config();

interface AppConfig {
  port: number;
  defaultProvider: string;
  defaultModel: string;
  defaultSystemPrompt: string;
  defaultTools: string[];
}

let jsonConfig: Partial<AppConfig> = {};
const configPath = resolve(process.cwd(), 'config.json');

if (existsSync(configPath)) {
  try {
    const rawData = readFileSync(configPath, 'utf8');
    jsonConfig = JSON.parse(rawData);
  } catch (err) {
    console.warn('⚠️ Warning: Failed to parse config.json, using environment/hardcoded fallbacks.', err);
  }
}

export const config = {
  port: Number(process.env.PORT) || jsonConfig.port || 3000,
  defaultProvider: jsonConfig.defaultProvider || 'google',
  defaultModel: jsonConfig.defaultModel || 'gemini-2.5-flash',
  defaultSystemPrompt: jsonConfig.defaultSystemPrompt || 'You are an autonomous AI coding agent.',
  defaultTools: jsonConfig.defaultTools || ['read', 'write', 'edit', 'ls', 'grep', 'bash'],
  
  /**
   * Dynamically resolves the API key for a given provider
   * Checks local configuration parameters, then searches standard ENV patterns.
   */
  getApiKey(provider: string, clientKey?: string): string {
    if (clientKey) return clientKey;
    
    const formattedProvider = provider.toUpperCase();
    return (
      process.env[`${formattedProvider}_API_KEY`] ||
      process.env[`${formattedProvider}_KEY`] ||
      ''
    );
  }
};
