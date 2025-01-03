import {
  LitAgent,
  LitAgentError,
  LitAgentErrorType,
} from '@lit-protocol/full-self-signing';
import { ToolInfo } from '@lit-protocol/fss-tool-registry';
import { AgentSigner } from '@lit-protocol/fss-signer';
import inquirer from 'inquirer';
import { logger } from './utils/logger';
import { storage } from './utils/storage';
import {
  promptForOpenAIKey,
  promptForAuthPrivateKey,
  promptForToolPolicyRegistryConfig,
} from './prompts/config';
import { promptForUserIntent } from './prompts/intent';
import { promptForToolPermission } from './prompts/permissions';
import { collectMissingParams } from './prompts/parameters';
import { promptForToolPolicy } from './prompts/policy';
import { ethers } from 'ethers';

export class AgentCLI {
  private litAgent: LitAgent | null = null;

  async start() {
    await this.initializeLitAgent();
    await this.startInteractiveMode();
  }

  private async initializeLitAgent() {
    try {
      // Get configuration
      const authPrivateKey = await promptForAuthPrivateKey();
      const openAiKey = await promptForOpenAIKey();
      const toolPolicyRegistryConfig =
        await promptForToolPolicyRegistryConfig();

      // Initialize the agent
      this.litAgent = new LitAgent(
        authPrivateKey,
        openAiKey,
        undefined,
        toolPolicyRegistryConfig
          ? {
              rpcUrl: toolPolicyRegistryConfig.rpcUrl,
              contractAddress: toolPolicyRegistryConfig.contractAddress,
            }
          : undefined
      );

      await this.litAgent.init();
      logger.success('Successfully initialized Lit Agent');

      // Get and log the PKP address
      const pkpInfo = AgentSigner.getPkpInfoFromStorage();
      if (pkpInfo) {
        logger.info(`Lit Agent Wallet Address: ${pkpInfo.ethAddress}`);
      }
    } catch (error) {
      if (error instanceof LitAgentError) {
        const litError = error as LitAgentError;
        switch (litError.type) {
          case LitAgentErrorType.INSUFFICIENT_BALANCE: {
            const authWallet = storage.getWallet();
            if (!authWallet) throw litError;

            logger.error(
              'Your Auth Wallet does not have enough Lit test tokens to mint the Agent Wallet.'
            );
            logger.info(
              `Please send Lit test tokens to your Auth Wallet: ${authWallet.address} before continuing.`
            );
            logger.log(
              'You can get test tokens from the following faucet: https://chronicle-yellowstone-faucet.getlit.dev/'
            );
            process.exit(1);
            break;
          }
          case LitAgentErrorType.WALLET_CREATION_FAILED: {
            logger.error(`Failed to create agent wallet: ${litError.message}`);
            process.exit(1);
            break;
          }
          default: {
            logger.error(`Failed to initialize Lit Agent: ${litError.message}`);
            process.exit(1);
            break;
          }
        }
      }
      logger.error(
        `Unexpected error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      process.exit(1);
    }
  }

  private async startInteractiveMode() {
    if (!this.litAgent) {
      throw new Error('LitAgent not initialized');
    }

    while (true) {
      try {
        const userIntent = await promptForUserIntent();
        if (!userIntent) {
          break;
        }

        const result = await this.litAgent.analyzeUserIntentAndMatchAction(
          userIntent
        );

        if (!result.matchedTool) {
          logger.error(
            'No matching tool found. Please try rephrasing your request.'
          );
          continue;
        }

        logger.info('Executing tool...');
        const executionResult = await this.litAgent.executeTool(
          result.matchedTool.ipfsCid,
          result.params.foundParams,
          {
            permissionCallback: async (tool: ToolInfo) => {
              const shouldPermit = await promptForToolPermission(tool);
              if (!shouldPermit) {
                logger.info('Operation cancelled by user');
              }
              return shouldPermit;
            },
            parameterCallback: async (
              tool: ToolInfo,
              missingParams: string[]
            ) => {
              const allParams = await collectMissingParams(tool, {
                foundParams: result.params.foundParams,
                missingParams,
              });
              return allParams;
            },
            setNewToolPolicyCallback: async (
              tool: ToolInfo,
              currentPolicy: any
            ) => {
              const handlePolicySetup = async (
                tool: ToolInfo,
                currentPolicy: any | null
              ): Promise<{ usePolicy: boolean; policyValues?: any }> => {
                const { usePolicy, policyValues } = await promptForToolPolicy(
                  tool,
                  currentPolicy
                );
                if (!usePolicy) {
                  const { proceedWithoutPolicy } = await inquirer.prompt([
                    {
                      type: 'confirm',
                      name: 'proceedWithoutPolicy',
                      message:
                        'Would you like to proceed without a policy? This means there will be no restrictions on tool usage.',
                      default: false,
                    },
                  ]);
                  if (proceedWithoutPolicy) {
                    return { usePolicy: false };
                  }
                  // If they don't want to proceed without a policy, try again
                  return handlePolicySetup(tool, currentPolicy);
                }
                return { usePolicy: true, policyValues };
              };
              const result = await handlePolicySetup(tool, currentPolicy);
              if (result.usePolicy && result.policyValues) {
                // Get the PKP address to show in the prompt
                const pkpInfo = AgentSigner.getPkpInfoFromStorage();
                if (pkpInfo) {
                  let hasEnoughBalance = false;
                  while (!hasEnoughBalance) {
                    try {
                      // Check the actual balance using the litAgent
                      const balance = await this.litAgent!.getLitTokenBalance();
                      const minimumBalance = ethers.utils.parseEther('0.01');

                      if (balance.lt(minimumBalance)) {
                        logger.warn(
                          `Your Lit Agent Wallet (${
                            pkpInfo.ethAddress
                          }) has ${ethers.utils.formatEther(
                            balance
                          )} LIT. Minimum required is 0.01 LIT.`
                        );
                        logger.info(
                          'Please fund your wallet with Lit test tokens from: https://chronicle-yellowstone-faucet.getlit.dev/'
                        );

                        const { hasFunded } = await inquirer.prompt([
                          {
                            type: 'confirm',
                            name: 'hasFunded',
                            message:
                              'Have you funded your wallet with more tokens?',
                            default: false,
                          },
                        ]);

                        if (!hasFunded) {
                          return { usePolicy: false };
                        }
                        // Continue the loop to check new balance
                      } else {
                        hasEnoughBalance = true;
                      }
                    } catch (error) {
                      logger.error(
                        'Failed to check Lit Agent Wallet balance. Please ensure you have sufficient Lit test tokens.'
                      );
                      if (error instanceof Error) {
                        logger.error(`Error: ${error.message}`);
                      }
                      return { usePolicy: false };
                    }
                  }

                  logger.info('Registering policy on chain...');
                }
              }
              return result;
            },
            onPolicyRegistered: (txHash: string) => {
              logger.success(
                `Policy successfully registered! Transaction hash: ${txHash}`
              );
            },
          }
        );

        if (!executionResult.success) {
          if (executionResult.reason) {
            logger.error(`Tool execution failed: ${executionResult.reason}`);
          }
          continue;
        }

        logger.success('Tool execution completed');
        logger.log(
          `Result: ${JSON.stringify(executionResult.result, null, 2)}`
        );
      } catch (error) {
        if (error instanceof LitAgentError) {
          const litError = error as LitAgentError;
          switch (litError.type) {
            case LitAgentErrorType.TOOL_EXECUTION_FAILED:
              logger.error(`Tool execution failed: ${litError.message}`);
              break;
            case LitAgentErrorType.INVALID_PARAMETERS:
              logger.error(`Invalid parameters: ${litError.message}`);
              break;
            case LitAgentErrorType.TOOL_VALIDATION_FAILED:
              logger.error(`Policy validation failed: ${litError.message}`);
              break;
            case LitAgentErrorType.TOOL_POLICY_REGISTRATION_FAILED:
              logger.error(`Failed to set tool policy: ${litError.message}`);
              if (litError.details?.originalError instanceof Error) {
                logger.error(
                  `Reason: ${litError.details.originalError.message}`
                );
              }
              break;
            default:
              logger.error(`Operation failed: ${litError.message}`);
          }
        } else {
          logger.error(
            `Unexpected error: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
        continue;
      }
    }
  }
}
