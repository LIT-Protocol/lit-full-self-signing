import { Admin as FssAdmin } from '@lit-protocol/full-self-signing';
import { FssSignerError, FssSignerErrorType } from '@lit-protocol/fss-signer';

import { logger } from '../utils/logger';
import { promptAdminInit } from '../prompts/admin/init';
import { promptAdminInsufficientBalance } from '../prompts/admin/insuffcient-balance';
import { promptAdminMenu } from '../prompts/admin/menu';
import { handlePermitTool } from '../handlers/admin/permit-tool';

export class Admin {
  private fssAdmin: FssAdmin;

  private constructor(fssAdmin: FssAdmin) {
    this.fssAdmin = fssAdmin;

    logger.success('Admin role initialized successfully.');
  }

  private static async createFssAdmin(privateKey?: string): Promise<FssAdmin> {
    let fssAdmin: FssAdmin;
    try {
      fssAdmin = await FssAdmin.create({
        type: 'eoa',
        privateKey,
      });
    } catch (error) {
      if (error instanceof FssSignerError) {
        if (error.type === FssSignerErrorType.ADMIN_MISSING_PRIVATE_KEY) {
          const privateKey = await promptAdminInit();
          return Admin.createFssAdmin(privateKey);
        }

        if (error.type === FssSignerErrorType.INSUFFICIENT_BALANCE_PKP_MINT) {
          const hasFunded = await promptAdminInsufficientBalance();
          if (hasFunded) {
            return Admin.createFssAdmin(privateKey);
          }
        }
      }

      logger.error('Failed to initialize Admin role', error as Error);
      process.exit(1);
    }

    return fssAdmin;
  }

  public static async create() {
    logger.info('Initializing Admin role...');
    const fssAdmin = await Admin.createFssAdmin();
    return new Admin(fssAdmin);
  }

  public static async showMenu(admin: Admin) {
    const option = await promptAdminMenu();

    switch (option) {
      case 'permitTool':
        await handlePermitTool(admin.fssAdmin);
        break;
      case 'removeTool':
        logger.info('Executing: Remove Tool');
        break;
      case 'getRegisteredTools':
        logger.info('Executing: Get Registered Tools');
        break;
      case 'getToolPolicy':
        logger.info('Executing: Get Tool Policy');
        break;
      case 'setToolPolicy':
        logger.info('Executing: Set Tool Policy');
        break;
      case 'removeToolPolicy':
        logger.info('Executing: Remove Tool Policy');
        break;
      case 'getDelegatees':
        logger.info('Executing: Get Delegatees');
        break;
      case 'isDelegatee':
        logger.info('Executing: Check if Address is Delegatee');
        break;
      case 'addDelegatee':
        logger.info('Executing: Add Delegatee');
        break;
      case 'removeDelegatee':
        logger.info('Executing: Remove Delegatee');
        break;
      case 'batchAddDelegatees':
        logger.info('Executing: Batch Add Delegatees');
        break;
      case 'batchRemoveDelegatees':
        logger.info('Executing: Batch Remove Delegatees');
        break;
      default:
        logger.error('Invalid option selected');
        process.exit(1);
    }

    await Admin.showMenu(admin);
  }

  public async disconnect() {
    this.fssAdmin.disconnect();
  }
}
