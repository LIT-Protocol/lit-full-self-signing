import { z } from 'zod';

export const signingSimpleLitActionDescription =
  'A Lit Action that signs arbitrary messages.';

/**
 * Descriptions of each parameter for the Signing Simple Lit Action
 * These descriptions are designed to be consumed by LLMs to understand the required parameters
 */
export const SigningSimpleLitActionParameterDescriptions = {
  message: 'The message to sign. This can be any string that you want to be signed by the Lit Action.',
  chainId: 'The ID of the blockchain network to use (e.g. 1 for Ethereum mainnet, 84532 for Base Sepolia).',
  rpcUrl: 'The RPC URL of the blockchain network to connect to (e.g. "https://base-sepolia-rpc.publicnode.com").',
} as const;

/**
 * Parameters required for the Signing Simple Lit Action
 * @property message - The message to be signed
 * @property chainId - The ID of the blockchain network
 * @property rpcUrl - The RPC URL of the blockchain network
 */
export interface SigningSimpleLitActionParameters {
  message: string;
  chainId: string;
  rpcUrl: string;
}

/**
 * Metadata about the Signing Simple Lit Action including its description, parameters, and validation rules
 */
export const SigningSimpleLitActionMetadata = {
  name: 'SigningSimpleLitAction',
  version: '1.0.0',
  description: signingSimpleLitActionDescription,
  parameters: SigningSimpleLitActionParameterDescriptions,
  required: ['message', 'chainId', 'rpcUrl'] as const,
  validation: {
    message: 'Message must not be empty',
    chainId: 'Chain ID must not be empty',
    rpcUrl: 'RPC URL must be a valid URL',
  },
};

/**
 * The schema for validating Signing Simple Lit Action parameters
 */
export const SigningSimpleLitActionSchema = z.object({
  message: z.string().min(1, 'Message must not be empty').refine(
    (val) => val.trim().length > 0,
    'Message cannot be only whitespace'
  ),
  chainId: z.string().min(1, 'Chain ID must not be empty').refine(
    (val) => val.trim().length > 0 && /^\d+$/.test(val),
    'Chain ID must be a numeric string'
  ),
  rpcUrl: z.string()
    .min(1, 'RPC URL must not be empty')
    .url('RPC URL must be a valid URL')
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      'RPC URL must use HTTP or HTTPS protocol'
    ),
});

/**
 * Type guard for SigningSimpleLitActionParameters
 * @param params - The parameters to validate
 * @returns True if the parameters are valid SigningSimpleLitActionParameters
 */
export const isValidSigningSimpleParameters = (
  params: unknown
): params is SigningSimpleLitActionParameters => {
  try {
    SigningSimpleLitActionSchema.parse(params);
    return true;
  } catch {
    return false;
  }
};