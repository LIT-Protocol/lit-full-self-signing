/**
 * Default development CIDs for different environments.
 * @type {Object.<string, NetworkCids>}
 * @property {NetworkCids} datil-dev - CIDs for the development environment.
 * @property {NetworkCids} datil-test - CIDs for the test environment.
 * @property {NetworkCids} datil - CIDs for the production environment.
 */
const DEFAULT_CIDS = {
  'datil-dev': {
    tool: 'DEV_TOOL_IPFS_CID',
    defaultPolicy: 'DEV_POLICY_IPFS_CID',
  },
  'datil-test': {
    tool: 'TEST_TOOL_IPFS_CID',
    defaultPolicy: 'TEST_POLICY_IPFS_CID',
  },
  datil: {
    tool: 'PROD_TOOL_IPFS_CID',
    defaultPolicy: 'PROD_POLICY_IPFS_CID',
  },
} as const;

/**
 * Tries to read the IPFS CIDs from the build output.
 * Falls back to default development CIDs if the file is not found or cannot be read.
 * @type {Record<keyof typeof DEFAULT_CIDS, NetworkCids>}
 */
let deployedCids = DEFAULT_CIDS;

function isNode(): boolean {
  return typeof process !== 'undefined' && 
         process.versions != null && 
         process.versions.node != null;
}

if (isNode()) {
  try {
    const path = require('path');
    const fs = require('fs');
    const url = require('url');
    
    const __filename = url.fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const ipfsPath = path.join(__dirname, '../../../dist/ipfs.json');
    
    if (fs.existsSync(ipfsPath)) {
      const ipfsJson = require(ipfsPath);
      deployedCids = ipfsJson;
    }
  } catch (error) {
    throw new Error(
      'Failed to read ipfs.json. You should only see this error if you are running the monorepo locally. You should run pnpm deploy:tools to update the ipfs.json files.'
    );
  }
}

/**
 * IPFS CIDs for each network's Lit Action.
 * @type {Record<keyof typeof DEFAULT_CIDS, NetworkCids>}
 */
export const IPFS_CIDS = deployedCids;
