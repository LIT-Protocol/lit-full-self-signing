import inquirer from 'inquirer';
import type { ToolInfo } from '@lit-protocol/agent-tool-registry';
import {
  getToolFromRegistry,
  isToolSupported,
} from '@lit-protocol/agent-tool-registry';
import { logger } from '../utils/logger';
import { z } from 'zod';

export async function promptForToolPolicy(
  tool: ToolInfo,
  currentPolicy: any | null
): Promise<{ usePolicy: boolean; policyValues?: any }> {
  logger.warn('Tool Policy Configuration');
  logger.log(`Tool: ${tool.name}`);

  if (!isToolSupported(tool.name)) {
    return { usePolicy: false };
  }

  const registryTool = getToolFromRegistry(tool.name);

  const { usePolicy } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'usePolicy',
      message: 'Would you like to configure a policy for this tool?',
      default: false,
    },
  ]);

  if (!usePolicy) {
    return { usePolicy: false };
  }

  try {
    // Get the policy schema from the registry tool
    const policySchema = registryTool.Policy.schema;

    // Create policy values object with default type and version
    const policyValues: Record<string, any> = {
      type: tool.name,
      version: '1.0.0',
    };

    // Get the shape of the schema to determine what fields to prompt for
    const shape = policySchema.shape as Record<string, z.ZodTypeAny>;
    for (const [key, zodField] of Object.entries(shape)) {
      // Skip type and version as they're handled above
      if (key === 'type' || key === 'version') continue;

      // Check if the field is an array
      const isArray = zodField instanceof z.ZodArray;

      if (isArray) {
        // Handle array fields (like allowedTokens, allowedRecipients)
        const { useArray } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useArray',
            message: `Would you like to configure ${key}?`,
            default: false,
          },
        ]);

        const values: string[] = [];
        if (useArray) {
          while (true) {
            const { value } = await inquirer.prompt([
              {
                type: 'input',
                name: 'value',
                message: `Enter a value for ${key} (or leave empty to finish):`,
                validate: (input: string) => {
                  if (!input) return true;
                  try {
                    // For array fields, validate against the array element type
                    (zodField as z.ZodArray<any>).element.parse(input);
                    return true;
                  } catch (err) {
                    const error = err as z.ZodError;
                    return `Invalid value: ${
                      error.errors[0]?.message || 'Unknown error'
                    }`;
                  }
                },
              },
            ]);

            if (!value) break;
            values.push(value);
          }
        }
        policyValues[key] = values;
      } else {
        // Handle scalar fields (like maxAmount)
        const { value } = await inquirer.prompt([
          {
            type: 'input',
            name: 'value',
            message: `Enter ${key}:`,
            validate: (input: string) => {
              try {
                zodField.parse(input);
                return true;
              } catch (err) {
                const error = err as z.ZodError;
                return `Invalid value: ${
                  error.errors[0]?.message || 'Unknown error'
                }`;
              }
            },
          },
        ]);
        policyValues[key] = value;
      }
    }

    // Show policy summary
    logger.info('Policy Summary:');
    Object.entries(policyValues).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        logger.log(`${key}: ${value.length ? value.join(', ') : 'Any'}`);
      } else {
        logger.log(`${key}: ${value}`);
      }
    });

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: 'Would you like to proceed with this policy?',
        default: true,
      },
    ]);

    if (!confirmed) {
      return { usePolicy: false };
    }

    return { usePolicy: true, policyValues };
  } catch (err) {
    const error = err as Error;
    logger.error(`Failed to configure policy: ${error.message}`);
    return { usePolicy: false };
  }
}